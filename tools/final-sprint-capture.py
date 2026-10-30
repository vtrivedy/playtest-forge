#!/usr/bin/env python3
"""Pin settled main once, render final gameplay/hero on Modal, then assemble trailer."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json,subprocess,shutil,os
ROOT=Path(__file__).resolve().parents[1]
ART=Path('/workspace/siyu/playtest-forge-artifacts/sprint2')
OUT=ART/'final'
def run(args,**kwargs):return subprocess.run(args,cwd=ROOT,check=True,**kwargs)
def main():
    OUT.mkdir(parents=True,exist_ok=True)
    sha=subprocess.check_output(['git','ls-remote','--heads','origin','main'],cwd=ROOT,text=True).split()[0]
    (OUT/'COMMIT.txt').write_text(sha+'\n')
    def capture(shot,size,fps):
        with (OUT/f'{shot}.log').open('w') as log:
            return subprocess.run(['python3','tools/review-capture.py',sha,'--shots',shot,'--size',size,'--fps',str(fps),'--out',str(OUT/'raw'/shot)],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,env=dict(os.environ,FOX_CAPTURE_APP=f'fox-sprint-final-{shot}')).returncode
    with ThreadPoolExecutor(max_workers=2) as pool:
        jobs=[pool.submit(capture,'finale','1280x720',30),pool.submit(capture,'fox','1920x1080',60)]
        codes=[job.result() for job in jobs]
    (OUT/'capture-exits.json').write_text(json.dumps(codes))
    raw=OUT/'raw/finale/finale'
    for name in ['gameplay-60s.mp4','final-gameplay.json']:
        if (raw/name).exists():shutil.copy2(raw/name,OUT/name)
    hero=OUT/'hero-stills';hero.mkdir(exist_ok=True)
    for grade in ['sepia','restored']:
        for angle in ['front','three_q','side']:
            source=OUT/f'raw/fox/fox/fox-{grade}-{angle}.png'
            if source.exists():shutil.copy2(source,hero/source.name)
    sources=[
      (raw/'fox-closeup-run.mp4',sha,0,6,'Latest-main close run, staged start'),
      (ART/'loco-sol/showcase-clear/showcase.mp4',None,0,6,'Authored walk/trot/gallop; staged cuts; NEEDS REVISION critic'),
      (ART/'loco-sol/showcase-clear/showcase.mp4',None,9,11,'Authored jumps/slope/dash; obstructed turn span omitted editorially'),
      (ART/'levels-opus/summit-r4/route/route-segment-staged-58-78.mp4',None,None,14,'Summit root + heat restoration; staged start'),
      (ART/'levels-sol/reach-v3-retry/reach-first-crossing.mp4',None,None,13,'Reach first crossing; staged summit start'),
    ]
    clips=[]
    for path,commit,start,seconds,label in sources:
        metadata=json.loads((path.parent/'run.json').read_text());commit=commit or metadata['commit']
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(path)]))
        duration=float(probe['format']['duration'])
        start=max(0,duration-seconds) if start is None else start
        if duration-start<seconds-.05:raise ValueError(f'Trailer source too short: {path}')
        clips.append({'path':str(path),'commit':commit,'start':start,'seconds':seconds,'label':label})
    spec={'latestMain':sha,'clips':clips,'editorial':True,'audio':'Silent fixed-clock captures; no recorded soundtrack'}
    manifest=OUT/'trailer-manifest.json';manifest.write_text(json.dumps(spec,indent=2))
    run(['modal','run','--detach','tools/modal/final_cut.py','--out',str(OUT)],env=dict(os.environ,FOX_FINAL_MANIFEST=str(manifest)))
    (OUT/'README.md').write_text(f'''# Sprint2 final footage\n\nLatest main: `{sha}`. GPU capture exits: {codes}.\n\n`gameplay-60s.mp4`: three20-second chapters, Arrival Meadow → Windmill Rise → Reedmarsh shrine approach. Chapter starts after the opening are staged; movement afterward is real controller/autopilot input, with no forced solves. Lanternhollow hub is not implemented, so Arrival Meadow is the disclosed substitute. State/deaths are in `final-gameplay.json`; this is not a continuous completed route or feel approval.\n\n`trailer-50s.mp4`: editorial6+6+11+14+13s cut (occluded showcase turn span omitted). Every source commit, in/out time, and encoder is in `trailer-sources.json` and `trailer-manifest.json`. Earlier-build footage is intentionally identified; it is not represented as latest-main gameplay. The showcase source has a NEEDS REVISION critique. No soundtrack was recorded.\n\nSix1080p hero stills are in `hero-stills/`, three angles in each grade. Raw reports, traces, videos and contact sheets are in `raw/`. Visual review and remaining failures are recorded in `REVIEW.md` after inspection.\n''')
if __name__=='__main__':main()
