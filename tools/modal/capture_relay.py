"""Poll Modal agent requests and relay GPU evidence. No local browser."""
import argparse, concurrent.futures, hashlib, json, re, subprocess, tarfile, time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SHOTS = set('probe perf route orbit fox gait stills water shade turntable updraft wind growth levels windgap marshmouth reed crown flow showcase reach reachview reachsafe finale feel'.split())

def cli(args, **kw):
    return subprocess.run(args, text=True, capture_output=True, **kw)

def process(stream, request, folder):
    folder.mkdir(parents=True, exist_ok=True)
    (folder/'request.json').write_text(json.dumps(request, indent=2))
    ref=request.get('ref', request.get('sha',''))
    shots=request.get('shots','stills')
    if isinstance(shots,list): shots=','.join(shots)
    if not re.fullmatch('[0-9a-fA-F]{40}',ref) or not set(shots.split(',')) <= SHOTS:
        result={'status':'rejected','reason':'ref must be an immutable pushed 40-character SHA; shots must be supported'}
    else:
        command=['modal','run','--detach','tools/modal/gpu_capture.py','--ref',ref,'--shots',shots,'--out',str(folder/'evidence')]
        options={'size':'1280x720','fps':60,'route-seconds':120}
        for key,default in options.items():
            value=request.get(key,request.get(key.replace('-','_'),default))
            command += ['--'+key,str(value)]
        for key in ['route-from','route-to','orbit-seconds','quality','gpu']:
            value=request.get(key,request.get(key.replace('-','_')))
            if value is not None:command+=['--'+key,str(value)]
        with (folder/'modal.log').open('w') as log:
            proc=subprocess.run(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
        evidence=folder/'evidence'
        result={'status':'captured' if proc.returncode==0 else 'capture-failed','exit':proc.returncode,'ref':ref,'shots':shots,'path':str(evidence)}
        for name in ['run.json','report.json']:
            p=evidence/name
            if p.exists():
                data=json.loads(p.read_text())
                result[name]={k:data[k] for k in ['status','commit','gpu','failures','errors','captureToolSha'] if k in data}
        archive=folder/'evidence.tar'
        with tarfile.open(archive,'w') as tar:
            if evidence.exists():tar.add(evidence,arcname='evidence')
            tar.add(folder/'modal.log',arcname='modal.log')
        uploaded=cli(['modal','volume','put','fox-agent-streams',str(archive),f'{stream}/captures/{folder.name}.tar','--force'])
        result['archive']=f'{stream}/captures/{folder.name}.tar' if uploaded.returncode==0 else None
    (folder/'result.json').write_text(json.dumps(result,indent=2))
    feedback=folder/'feedback.md'
    feedback.write_text('# GPU relay result\n\n'+json.dumps(result,indent=2)+'\n\nVisual verdict: NOT ASSESSED. Download the archive, inspect PNGs and state traces; machine success does not establish visual quality.\n')
    cli(['modal','volume','put','fox-agent-streams',str(feedback),f'{stream}/feedback.md','--force'])
    print(json.dumps({'stream':stream,**result}),flush=True)

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--streams',default='loco,loco-glide,fox-ember,hub,reach,route-clear,camera,water-restore,shade')
    ap.add_argument('--once',action='store_true')
    args=ap.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    pool=concurrent.futures.ThreadPoolExecutor(max_workers=1);pending=[]
    while datetime.now().astimezone().timestamp()<1793440500:
        for stream in args.streams.split(','):
            target=args.out/f'{stream}-request.json'
            got=cli(['modal','volume','get','fox-agent-streams',f'{stream}/capture-request.json',str(target),'--force'])
            if got.returncode:continue
            try:request=json.loads(target.read_text())
            except (ValueError,OSError):continue
            key=hashlib.sha256(json.dumps(request,sort_keys=True).encode()).hexdigest()[:12]
            folder=args.out/stream/key
            if folder.exists():continue
            folder.mkdir(parents=True);(folder/'queued.json').write_text(json.dumps(request,indent=2))
            print(f'queued {stream} {key}',flush=True)
            pending.append(pool.submit(process,stream,request,folder))
        for task in pending:
            if task.done():task.result()
        pending=[p for p in pending if not p.done()]
        if args.once:break
        time.sleep(90)
    pool.shutdown(wait=True)

if __name__=='__main__':main()
