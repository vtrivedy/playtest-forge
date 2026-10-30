"""Run a Blender Python script on a Modal GPU (Cycles OptiX) — keeps Blender renders off the shared box.

modal run tools/modal/blender_render.py --script tools/blender/scripts/fox_review.py \
    --inputs assets/hero/spirit_fox.glb,assets/concept/fox-turnaround.jpg --out /path/to/dir [--args "a b c"]

Inputs are uploaded flat into /work/in (the script sees them by basename via $BLENDER_IN); the script
writes into $BLENDER_OUT (/work/out), which is downloaded into --out.
"""
from pathlib import Path
import modal

app = modal.App('fox-blender-render')
BLENDER = 'blender-4.2.5-linux-x64'
image = (
    modal.Image.debian_slim(python_version='3.11')
    .apt_install('curl', 'xz-utils', 'libx11-6', 'libxrender1', 'libxi6', 'libxkbcommon0', 'libsm6',
                 'libgl1', 'libxxf86vm1', 'libxfixes3', 'libegl1', 'libglu1-mesa')
    .run_commands(f'curl -sL https://download.blender.org/release/Blender4.2/{BLENDER}.tar.xz | tar -xJ -C /opt')
    .env({'NVIDIA_DRIVER_CAPABILITIES': 'all'})
)


@app.function(image=image, gpu='L4', cpu=8, memory=16384, timeout=1800, scaledown_window=2)
def render(script: bytes, inputs: dict, args: list) -> dict:
    import os, subprocess
    work = Path('/work'); (work / 'in').mkdir(parents=True); (work / 'out').mkdir()
    for name, data in inputs.items():
        (work / 'in' / name).write_bytes(data)
    (work / 'script.py').write_bytes(script)
    env = dict(os.environ, BLENDER_IN=str(work / 'in'), BLENDER_OUT=str(work / 'out'), BLENDER_GPU='1')
    proc = subprocess.run([f'/opt/{BLENDER}/blender', '-b', '--python', str(work / 'script.py'), '--', *args],
                          env=env, capture_output=True, text=True)
    log = proc.stdout[-20000:] + '\n--- stderr ---\n' + proc.stderr[-8000:]
    files = {p.name: p.read_bytes() for p in (work / 'out').iterdir() if p.is_file()}
    files['blender.log'] = log.encode()
    if proc.returncode:
        print(log)
    return files


@app.local_entrypoint()
def main(script: str, inputs: str = '', out: str = '', args: str = ''):
    root = Path(__file__).resolve().parents[2]
    ins = {Path(p).name: (root / p if not Path(p).is_absolute() else Path(p)).read_bytes()
           for p in inputs.split(',') if p}
    files = render.remote((root / script).read_bytes(), ins, args.split())
    dest = Path(out or '/tmp/blender-render'); dest.mkdir(parents=True, exist_ok=True)
    for name, data in files.items():
        (dest / name).write_bytes(data)
    print(f'{len(files)} files -> {dest}:', ', '.join(sorted(files)))
