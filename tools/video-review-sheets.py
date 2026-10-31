"""Decode every retained video frame into numbered contact sheets; no browser."""
import argparse,hashlib,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('video',type=Path);p.add_argument('--out',required=True,type=Path)
p.add_argument('--width',type=int,default=320);p.add_argument('--columns',type=int,default=6);p.add_argument('--rows',type=int,default=10)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
if not 80<=a.width<=640 or not 1<=a.columns<=10 or not 1<=a.rows<=12:p.error('Invalid sheet dimensions')
for old in a.out.glob('frames-*.png'):old.unlink()
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_streams','-of','json',str(a.video)],text=True))['streams'][0]
filters=f"scale={a.width}:-2,drawtext=text='%{{n}}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.7,tile={a.columns}x{a.rows}:padding=2:margin=2"
subprocess.run(['ffmpeg','-y','-v','error','-i',str(a.video),'-an','-vf',filters,'-fps_mode','passthrough',str(a.out/'frames-%03d.png')],check=True)
frames=int(probe['nb_read_frames']);per=a.columns*a.rows
meta={'source':str(a.video.resolve()),'sha256':hashlib.file_digest(a.video.open('rb'),'sha256').hexdigest(),'frames':frames,'fps':probe['avg_frame_rate'],'method':'All decoded frames, source frame n labelled before tiling; final sheet may have blank slots. No automated artistic or visibility verdict.','sheets':[{'file':f.name,'fromFrame':i*per,'toFrame':min(frames-1,(i+1)*per-1)} for i,f in enumerate(sorted(a.out.glob('frames-*.png')))]}
if len(meta['sheets']) != (frames+per-1)//per:raise RuntimeError('Sheet count does not cover decoded frames exactly')
(a.out/'index.json').write_text(json.dumps(meta,indent=2));print(json.dumps({'frames':frames,'sheets':len(meta['sheets']),'out':str(a.out)}))
