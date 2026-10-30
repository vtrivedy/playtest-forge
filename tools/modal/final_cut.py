"""Assemble the sprint trailer on a Modal GPU; source manifest supplies exact local clips."""
import json, os
from pathlib import Path
import modal
app=modal.App('fox-sprint-final-cut')
volume=modal.Volume.from_name('fox-sprint-final',create_if_missing=True)
image=modal.Image.debian_slim().apt_install('ffmpeg')
manifest_path=os.environ.get('FOX_FINAL_MANIFEST')
if modal.is_local() and manifest_path:
    for i,clip in enumerate(json.loads(Path(manifest_path).read_text())['clips']):
        image=image.add_local_file(clip['path'],f'/sources/{i}.mp4')
@app.function(image=image,gpu='A10',cpu=4,memory=8192,timeout=1800,volumes={'/final':volume})
def assemble(spec:dict,run_id:str):
    import subprocess,tarfile
    out=Path('/final')/run_id;out.mkdir(parents=True,exist_ok=True)
    encoders=[]
    for i,clip in enumerate(spec['clips']):
        source=f'/sources/{i}.mp4';target=out/f'part-{i}.mp4'
        base=['ffmpeg','-y','-v','error','-ss',str(clip['start']),'-i',source,'-t',str(clip['seconds']),'-an','-vf','scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1','-pix_fmt','yuv420p']
        proc=subprocess.run(base+['-c:v','h264_nvenc','-b:v','6M',str(target)],capture_output=True,text=True)
        codec='h264_nvenc'
        if proc.returncode:
            subprocess.run(base+['-c:v','libx264','-preset','fast','-crf','18',str(target)],check=True)
            codec='libx264 (NVENC unavailable; GPU container)'
        encoders.append(codec)
    listing=out/'concat.txt';listing.write_text('\n'.join(f"file '{out/f'part-{i}.mp4'}'" for i in range(len(spec['clips']))))
    subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(out/'trailer-50s.mp4')],check=True)
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(out/'trailer-50s.mp4')]))
    (out/'trailer-sources.json').write_text(json.dumps({**spec,'encoders':encoders,'probe':probe},indent=2))
    archive=Path('/final')/f'{run_id}.tar'
    with tarfile.open(archive,'w') as tar:
        for name in ['trailer-50s.mp4','trailer-sources.json']:tar.add(out/name,arcname=name)
    volume.commit();return {'runId':run_id,'seconds':probe['format']['duration']}
@app.local_entrypoint()
def main(out:str):
    import uuid,tarfile
    spec=json.loads(Path(os.environ['FOX_FINAL_MANIFEST']).read_text());run_id=f'final-{uuid.uuid4().hex[:12]}'
    print(assemble.remote(spec,run_id))
    target=Path(out);target.mkdir(parents=True,exist_ok=True);archive=target/'trailer.tar'
    with archive.open('wb') as f:
        for chunk in volume.read_file(f'{run_id}.tar'):f.write(chunk)
    with tarfile.open(archive) as tar:tar.extractall(target,filter='data')
    archive.unlink()
