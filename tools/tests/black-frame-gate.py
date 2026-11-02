"""Positive and negative controls for the decoded-frame gate (requires ffmpeg)."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import shutil

spec = importlib.util.spec_from_file_location('blackcheck', Path(__file__).parents[1] / 'check-black-frames.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ffmpeg = shutil.which('ffmpeg')
if not ffmpeg:
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
with tempfile.TemporaryDirectory() as folder:
    for name, values, expected in [('bright', [120] * 30, []), ('single-flash', [120] * 15 + [0] + [120] * 14, [15]), ('blank', [0] * 30, list(range(30)))]:
        video = Path(folder) / (name + '.mkv')
        subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', '32x18', '-r', '30', '-i', 'pipe:0', '-c:v', 'ffv1', str(video)], input=b''.join(bytes([v]) * 576 for v in values), check=True)
        result = module.scan(video, ffmpeg)
        assert [frame['frame'] for frame in result['darkFrames']] == expected, result
        assert result['decodedFrames'] == 30, result
        assert result['pass'] == (not expected), result
        print(name, 'PASS', result['darkFrameCount'], 'dark frames')
