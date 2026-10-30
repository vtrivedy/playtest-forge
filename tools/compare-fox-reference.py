#!/usr/bin/env python3
"""Build a labelled three-panel game/game/real-fox reference study."""
import argparse,json,subprocess,tempfile
from pathlib import Path


def escaped(path):return str(path.resolve()).replace('\\','\\\\').replace(':','\\:').replace("'","\\'")


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('left',type=Path);p.add_argument('right',type=Path);p.add_argument('--out',required=True,type=Path)
    p.add_argument('--reference-dir',type=Path,default=Path('/workspace/siyu/playtest-forge-artifacts/sprint2/ref/fox-gait'))
    args=p.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    left=json.loads((args.left/'gait-script.json').read_text());right=json.loads((args.right/'gait-script.json').read_text())
    if left['segments']!=right['segments']:raise ValueError('Different game input scripts')
    refs=[('walk','direct-register.mp4',4,1,1),('trot','trot-run.mp4',10,1,1),('gallop','trot-run.mp4',2,1,1),('gallop-quarter-speed','trot-run.mp4',2,4,1),('jump-land','pounce-action.mp4',0,1,2)]
    manifest={'purpose':'Qualitative anatomy/motion comparison; not phase aligned or calibrated for biological timing. Game panels are tracked crops of the actual capture. Documentary panels retain source framing.','clips':[]}
    with tempfile.TemporaryDirectory(prefix='fox-reference-',dir=args.out) as work:
        work=Path(work);clips=[]
        for index,(name,filename,source_start,real_factor,game_factor) in enumerate(refs):
            segment=next(s for s in left['segments'] if s['name']==name)
            game_duration=segment['seconds'];duration=game_duration*game_factor
            source=args.reference_dir/filename
            if not source.exists():raise FileNotFoundError(source)
            labels=[f's2-loco | {name} | game playback x{1/game_factor:g}',f's2-loco-sol | {name} | game playback x{1/game_factor:g}',f'REAL FOX | {filename} | source playback x{1/real_factor:g}']
            filters=[]
            for number,label in enumerate(labels):
                label_file=work/f'label-{index}-{number}.txt';label_file.write_text(label)
                crop='crop=900:900:550:100,scale=960:960' if number<2 else 'scale=960:960:force_original_aspect_ratio=decrease,pad=960:960:(ow-iw)/2:(oh-ih)/2:color=0x211b16'
                factor=game_factor if number<2 else real_factor
                filters.append(f"[{number}:v]setpts={factor}*(PTS-STARTPTS),{crop},fps=60,tpad=stop_mode=clone:stop_duration=1,trim=duration={duration},pad=960:1020:0:60:color=0x211b16,drawtext=textfile='{escaped(label_file)}':x=12:y=14:fontsize=18:fontcolor=white[v{number}]")
            filters.append('[v0][v1][v2]hstack=inputs=3[v]')
            target=work/f'{index:02d}.mp4';clips.append(target)
            command=['ffmpeg','-y','-hide_banner','-loglevel','error','-ss',str(segment['start']/60),'-t',str(game_duration),'-i',str(args.left/'gait.mp4'),'-ss',str(segment['start']/60),'-t',str(game_duration),'-i',str(args.right/'gait.mp4'),'-ss',str(source_start),'-t',str(duration/real_factor),'-i',str(source),'-filter_complex_threads','1','-filter_complex',';'.join(filters),'-map','[v]','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(target)]
            subprocess.run(command,check=True)
            manifest['clips'].append({'segment':name,'gameStartSeconds':segment['start']/60,'gamePlaybackMultiplier':1/game_factor,'referenceFile':str(source),'referenceStartSeconds':source_start,'referencePlaybackMultiplier':1/real_factor,'outputSeconds':duration})
        listing=work/'concat.txt';listing.write_text(''.join(f"file '{clip.name}'\n" for clip in clips))
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','concat','-safe','1','-i',str(listing),'-c','copy','-movflags','+faststart',str(args.out/'gait-vs-real-fox.mp4')],check=True)
    (args.out/'reference-edit.json').write_text(json.dumps(manifest,indent=2));print(args.out/'gait-vs-real-fox.mp4')


if __name__=='__main__':main()
