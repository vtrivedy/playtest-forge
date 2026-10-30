"""Run a Blender Python script on a Modal GPU (Cycles OptiX) — keeps Blender renders off the shared box.

modal run tools/modal/blender_render.py --script tools/blender/scripts/fox_review.py \
    --inputs assets/hero/spirit_fox.glb,assets/concept/fox-turnaround.jpg --out /path/to/dir [--args "a b c"]

Inputs are uploaded flat into /work/in (the script sees them by basename via $BLENDER_IN); the script
writes into $BLENDER_OUT (/work/out), which is downloaded into --out.
"""
from pathlib import Path
import modal

app = modal.App('fox-blender-render')
results = modal.Volume.from_name('fox-blender-reviews', create_if_missing=True)
BLENDER = 'blender-4.2.5-linux-x64'
image = (
    modal.Image.debian_slim(python_version='3.11')
    .apt_install('curl', 'xz-utils', 'libx11-6', 'libxrender1', 'libxi6', 'libxkbcommon0', 'libsm6',
                 'libgl1', 'libxxf86vm1', 'libxfixes3', 'libegl1', 'libglu1-mesa')
    .run_commands(f'curl -sL https://download.blender.org/release/Blender4.2/{BLENDER}.tar.xz | tar -xJ -C /opt')
    .env({'NVIDIA_DRIVER_CAPABILITIES': 'all'})
)


@app.function(image=image, gpu=['L4', 'A10', 'L40S', 'T4'], cpu=8, memory=16384, timeout=1800, scaledown_window=2,
              volumes={'/reviews': results})
def render(script: bytes, inputs: dict, args: list, run_id: str) -> dict:
    import os, subprocess, tarfile
    work = Path('/work'); (work / 'in').mkdir(parents=True); (work / 'out').mkdir()
    for name, data in inputs.items():
        (work / 'in' / name).write_bytes(data)
    (work / 'script.py').write_bytes(script)
    env = dict(os.environ, BLENDER_IN=str(work / 'in'), BLENDER_OUT=str(work / 'out'), BLENDER_GPU='1')
    proc = subprocess.run([f'/opt/{BLENDER}/blender', '-b', '--python', str(work / 'script.py'), '--', *args],
                          env=env, capture_output=True, text=True)
    log = proc.stdout[-20000:] + '\n--- stderr ---\n' + proc.stderr[-8000:]
    (work / 'out' / 'blender.log').write_text(log)
    archive = Path('/reviews') / f'{run_id}.tar'
    with tarfile.open(archive, 'w') as tar:
        tar.add(work / 'out', arcname='.')
    results.commit()
    return {'archive': archive.name, 'exitCode': proc.returncode,
            'files': sorted(p.name for p in (work / 'out').iterdir() if p.is_file())}


@app.local_entrypoint()
def main(script: str, inputs: str = '', out: str = '', args: str = '', fetch_only: str = ''):
    import tarfile, uuid, time
    root = Path(__file__).resolve().parents[2]
    ins = {Path(p).name: (root / p if not Path(p).is_absolute() else Path(p)).read_bytes()
           for p in inputs.split(',') if p}
    dest = Path(out or '/tmp/blender-render'); dest.mkdir(parents=True, exist_ok=True)
    run_id = fetch_only or f'fox-review-{time.strftime("%Y%m%d-%H%M%S")}-{uuid.uuid4().hex[:8]}'
    print(f'Run ID: {run_id}', flush=True)
    meta = None if fetch_only else render.remote((root / script).read_bytes(), ins, args.split(), run_id)
    target = dest / f'{run_id}.tar'
    for attempt in range(3):
        try:
            with target.open('wb') as f:
                for chunk in results.read_file(f'{run_id}.tar'): f.write(chunk)
            with tarfile.open(target) as tar: tar.extractall(dest, filter='data')
            target.unlink()
            break
        except Exception:
            if attempt == 2:
                print(f'Recover with --fetch-only {run_id}', flush=True)
                raise
    print(f'Review files -> {dest}', meta or run_id)
    if meta and meta['exitCode']: raise RuntimeError(f'Blender failed; inspect {dest / "blender.log"}')
