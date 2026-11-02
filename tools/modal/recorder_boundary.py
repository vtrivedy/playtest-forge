"""Matched GPU native/staged MediaRecorder and independent compositor diagnostic.

GH_TOKEN=... modal run tools/modal/recorder_boundary.py --ref PUSHED_SHA --seconds 120
Artifacts persist on keeping-swarm5-captures/reed/<job>. No game deployment.
"""
import os
from pathlib import Path
import modal

ROOT = Path(__file__).resolve().parents[2]
app = modal.App('russet-vale-recorder-boundary')
volume = modal.Volume.from_name('keeping-swarm5-captures')
image = (modal.Image.from_registry('node:22-bookworm-slim', add_python='3.12')
    .apt_install('git', 'ffmpeg', 'libvulkan1', 'libegl1', 'libgles2', 'libgl1', 'libglx0', 'libgbm1')
    .run_commands('mkdir -p /opt/browser && cd /opt/browser && npm init -y && npm install playwright@1.64.1',
                  'cd /opt/browser && npx playwright install --with-deps chromium')
    .env({'NVIDIA_DRIVER_CAPABILITIES': 'all', 'PLAYWRIGHT_BROWSERS_PATH': '/ms-playwright'})
    .run_commands('cd /opt/browser && npx playwright install chromium'))
if modal.is_local():
    for module in sorted((ROOT / 'tools').glob('*.mjs')):
        image = image.add_local_file(module, f'/opt/browser/{module.name}')
    image = image.add_local_file(ROOT / 'tools/check-black-frames.py', '/opt/check-black-frames.py')


@app.function(image=image, gpu='T4', cpu=8, memory=16384, timeout=1800,
              volumes={'/captures': volume}, scaledown_window=2)
def capture(ref: str, seconds: int, job: str):
    import subprocess
    import tempfile
    import json
    import re
    if not re.fullmatch(r'[0-9a-f]{40}', ref):
        raise ValueError('Use an immutable 40-character pushed SHA')
    out = Path('/captures/reed') / job
    out.mkdir(parents=True, exist_ok=False)
    def run(args, **kwargs):
        return subprocess.run(args, check=True, text=True, **kwargs)
    gpu = run(['nvidia-smi', '--query-gpu=name,driver_version', '--format=csv,noheader'], capture_output=True).stdout.strip()
    ask = Path('/tmp/recorder-askpass')
    ask.write_text('#!/bin/sh\ncase "$1" in *Username*) echo x-access-token;; *) printf "%s\\n" "$GH_TOKEN";; esac\n')
    ask.chmod(0o700)
    try:
        with tempfile.TemporaryDirectory(prefix='recorder-boundary-') as folder:
            run(['git', 'init', folder])
            run(['git', '-C', folder, 'remote', 'add', 'origin', 'https://github.com/vtrivedy/playtest-forge.git'])
            run(['git', '-C', folder, 'fetch', '--depth=1', 'origin', ref], env=dict(os.environ, GIT_ASKPASS=str(ask), GIT_TERMINAL_PROMPT='0'))
            run(['git', '-C', folder, 'checkout', '--detach', 'FETCH_HEAD'])
            # Build processes do not receive the repository credential.
            clean_env = {k: v for k, v in os.environ.items() if k != 'GH_TOKEN'}
            run(['npm', 'ci', '--no-audit', '--no-fund'], cwd=folder, env=clean_env)
            run(['npx', 'vite', 'build', '--config', 'games/fox-spirit/vite.config.ts'], cwd=folder, env=clean_env)
            command = ['node', '/opt/browser/recorder-boundary-capture.mjs', '--repo', folder, '--out', str(out), '--route-seconds', str(seconds), '--backend', 'egl', '--fps', '30', '--size', '1280x720']
            with (out / 'capture.log').open('w') as log:
                run(command, env=clean_env, stdout=log, stderr=subprocess.STDOUT)
            audits = {}
            for stream in ['native', 'staged']:
                audit = subprocess.run(['python3', '/opt/check-black-frames.py', str(out / f'{stream}.webm'), '--out', str(out / f'{stream}-blackcheck.json')], capture_output=True, text=True)
                if audit.returncode not in [0, 1]:
                    raise RuntimeError(audit.stderr)
                audits[stream] = json.loads(audit.stdout)
            run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-framerate', '10', '-i', str(out / 'compositor/frame-%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(out / 'compositor-sampled.mp4')])
            compositor = subprocess.run(['python3', '/opt/check-black-frames.py', str(out / 'compositor-sampled.mp4'), '--out', str(out / 'compositor-blackcheck.json')], text=True, capture_output=True)
            if compositor.returncode not in [0, 1]:
                raise RuntimeError(compositor.stderr)
            audits['compositor'] = json.loads(compositor.stdout)
            result = {'ref': ref, 'gpu': gpu, 'job': job, 'audits': audits}
            (out / 'run.json').write_text(json.dumps(result, indent=2))
            return result
    finally:
        ask.unlink(missing_ok=True)
        volume.commit()


@app.local_entrypoint()
def main(ref: str, seconds: int = 120):
    import time
    import uuid
    import json
    if not os.environ.get('GH_TOKEN'):
        raise ValueError('GH_TOKEN required in environment (passed only as ephemeral Modal secret)')
    job = f'boundary-{ref[:10]}-{time.strftime("%H%M%S")}-{uuid.uuid4().hex[:6]}'
    print('Artifacts: keeping-swarm5-captures/reed/' + job, flush=True)
    result = capture.with_options(secrets=[modal.Secret.from_dict({'GH_TOKEN': os.environ['GH_TOKEN']})]).remote(ref, seconds, job)
    print(json.dumps(result, indent=2))
