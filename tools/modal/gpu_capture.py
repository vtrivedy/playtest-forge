"""Real-GPU Russetvale capture. No local browser or permanent deployment.

modal run tools/modal/gpu_capture.py --ref main --shots all
--shots probe | perf | route | orbit | all (or comma-separated); --fetch-only RUN_ID
Design/operating notes: /tmp/sol-gpu/DESIGN.md during initial implementation.
"""
from pathlib import Path
import modal

ROOT = Path(__file__).resolve().parents[2] if modal.is_local() else Path('/tmp/game')
app = modal.App('russetvale-gpu-capture')
results = modal.Volume.from_name('russetvale-gpu-captures', create_if_missing=True)
image = (
    modal.Image.from_registry('node:22-bookworm-slim', add_python='3.12')
    .apt_install('git', 'ffmpeg', 'libvulkan1', 'libegl1', 'libgles2', 'libgl1', 'libglx0', 'vulkan-tools', 'curl')
    .run_commands('mkdir -p /opt/browser && cd /opt/browser && npm init -y && npm install playwright@1.64.1',
                  'cd /opt/browser && npx playwright install --with-deps chromium')
    .env({'NVIDIA_DRIVER_CAPABILITIES': 'all', 'PLAYWRIGHT_BROWSERS_PATH': '/ms-playwright'})
    .run_commands('cd /opt/browser && npx playwright install chromium')
)
if modal.is_local():
    image = image.add_local_file(ROOT / 'tools/gpu-capture.mjs', '/opt/browser/gpu-capture.mjs')

@app.function(image=image, gpu=['L4', 'A10'], cpu=8, memory=16384,
              timeout=10800, volumes={'/captures': results}, scaledown_window=2)
def capture(ref: str, shots: str, run_id: str, route_seconds: int, orbit_seconds: int) -> dict:
    import os, subprocess, time, json, tarfile
    started = time.monotonic()
    out = Path('/captures') / run_id
    out.mkdir(parents=True)
    def run(args, **kw):
        return subprocess.run(args, check=True, text=True, **kw)
    try:
        gpu = run(['nvidia-smi', '--query-gpu=name,driver_version', '--format=csv,noheader'], capture_output=True).stdout.strip()
        (out / 'nvidia-smi.txt').write_text(gpu + '\n')
        print('GPU:', gpu, flush=True)
        print(run(['sh', '-c', 'ldconfig -p | grep -E "libEGL_nvidia|libGLX_nvidia|libnvidia-glcore" || true'], capture_output=True).stdout, flush=True)
        # No token in argv, remote URL, disk, logs, or git configuration.
        ask = Path('/tmp/git-askpass')
        ask.write_text('#!/bin/sh\ncase "$1" in *Username*) echo x-access-token;; *) printf "%s\\n" "$GH_TOKEN";; esac\n')
        ask.chmod(0o700)
        env = dict(os.environ, GIT_ASKPASS=str(ask), GIT_TERMINAL_PROMPT='0')
        repo = Path('/tmp/game')
        run(['git', 'init', str(repo)])
        run(['git', '-C', str(repo), 'remote', 'add', 'origin', 'https://github.com/vtrivedy/playtest-forge.git'])
        run(['git', '-C', str(repo), 'fetch', '--depth=1', 'origin', ref], env=env)
        run(['git', '-C', str(repo), 'checkout', '--detach', 'FETCH_HEAD'])
        sha = run(['git', '-C', str(repo), 'rev-parse', 'HEAD'], capture_output=True).stdout.strip()
        run(['npm', 'ci', '--no-audit', '--no-fund'], cwd=repo)
        run(['npx', 'vite', 'build', '--config', 'games/fox-spirit/vite.config.ts'], cwd=repo)
        built = time.monotonic()
        run(['node', '/opt/browser/gpu-capture.mjs', '--repo', str(repo), '--out', str(out),
             '--shots', shots, '--route-seconds', str(route_seconds), '--orbit-seconds', str(orbit_seconds)], env=dict(os.environ, DEBUG='pw:browser'))
        metadata = {'ref': ref, 'commit': sha, 'gpu': gpu, 'shots': shots, 'runId': run_id,
                    'buildSeconds': round(built-started, 2), 'captureSeconds': round(time.monotonic()-built, 2),
                    'totalSeconds': round(time.monotonic()-started, 2)}
        (out / 'run.json').write_text(json.dumps(metadata, indent=2))
        return metadata
    finally:
        archive = Path('/captures') / f'{run_id}.tar'
        with tarfile.open(archive, 'w') as tar:
            tar.add(out, arcname='.')
        results.commit()

@app.local_entrypoint()
def main(ref: str = 'main', shots: str = 'all', route_seconds: int = 360,
         orbit_seconds: int = 20, fetch_only: str = '', out: str = ''):
    import subprocess, time, json, tarfile, re
    if shots != 'all' and not set(shots.split(',')) <= {'probe', 'perf', 'route', 'orbit'}:
        raise ValueError('shots: all, probe, perf, route, orbit or comma-separated')
    run_id = fetch_only or f'{re.sub(r"[^a-zA-Z0-9_.-]", "_", ref)[:64]}-{time.strftime("%Y%m%d-%H%M%S")}'
    destination = Path(out) if out else ROOT.parent / 'playtest-forge-artifacts/gpu' / re.sub(r'[^a-zA-Z0-9_.-]', '_', ref)
    destination.mkdir(parents=True, exist_ok=True)
    print(f'Run ID: {run_id}; output: {destination}', flush=True)
    error = None
    if not fetch_only:
        resolved_ref = ref
        if re.fullmatch(r'[0-9a-fA-F]{7,39}', ref):
            resolved_ref = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', '--verify', f'{ref}^{{commit}}'], text=True).strip()
        token = subprocess.check_output(['gh', 'auth', 'token'], text=True).strip()
        try:
            meta = capture.with_options(secrets=[modal.Secret.from_dict({'GH_TOKEN': token})]).remote(resolved_ref, shots, run_id, route_seconds, orbit_seconds)
            print(json.dumps(meta, indent=2))
        except Exception as exc:
            error = exc
    target = destination / f'{run_id}.tar'
    try:
        with target.open('wb') as f:
            for chunk in results.read_file(f'{run_id}.tar'):
                f.write(chunk)
        with tarfile.open(target) as tar:
            tar.extractall(destination, filter='data')
        target.unlink()
        print(f'Downloaded results to {destination}', flush=True)
    except Exception:
        print(f'Recover with --fetch-only {run_id}', flush=True)
        raise
    if error:
        raise error
