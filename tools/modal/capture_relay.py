"""Poll Modal agent requests and relay GPU evidence. No local browser."""
import argparse, concurrent.futures, hashlib, io, json, os, re, signal, subprocess, tarfile, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STOP_REQUESTED = False

def request_stop(*_):
    global STOP_REQUESTED
    STOP_REQUESTED = True

DEADLINE = 1793439600  # 2026-10-31 05:40 ET; final packaging is separate.
SHOTS = set('probe perf route kilnroute hub orbit fox gait worldgait stills water shade turntable updraft wind growth levels windgap marshmouth reed crown flow showcase reach reachview reachsafe finale feel'.split())

def cli(args, **kw):
    return subprocess.run(args, text=True, capture_output=True, timeout=60, **kw)

def capture_request(stream, request, folder):
    folder.mkdir(parents=True, exist_ok=True)
    (folder/'request.json').write_text(json.dumps(request, indent=2))
    if not isinstance(request,dict): raise ValueError('Request must be a JSON object')
    ref=request.get('ref', request.get('sha',''))
    if not isinstance(ref,str): raise ValueError('ref must be a string')
    ref=ref.lower()
    latest_file=folder.parents[1]/f'{stream}-request.json'
    if latest_file.exists() and request.get('stage')!='before':
        latest=json.loads(latest_file.read_text())
        if isinstance(latest,dict) and latest.get('ref',latest.get('sha'))!=ref:
            return {'status':'superseded','reason':'Newer immutable ref queued before this job started; no GPU launched'}
    shots=request.get('shots','stills')
    if isinstance(shots,list) and all(isinstance(s,str) for s in shots): shots=','.join(shots)
    if not isinstance(shots,str): raise ValueError('shots must be a string or list of strings')
    if not shots: raise ValueError('shots must not be empty')
    if time.time() >= DEADLINE: raise ValueError('Relay deadline reached; request expired')
    if request.get('gpu','A10') not in {'A10','L4'}: raise ValueError('Only A10 or L4 GPUs supported')
    for key,limit in [('route_seconds',600),('orbit_seconds',60)]:
        val=request.get(key.replace('_','-'),request.get(key,1))
        if not isinstance(val,(int,float)) or not 0 < val <= limit: raise ValueError(f'{key} must be between 1 and {limit}')
    if not re.fullmatch('[0-9a-fA-F]{40}',ref) or not set(shots.split(',')) <= SHOTS:
        result={'status':'rejected','reason':'ref must be an immutable pushed 40-character SHA; shots must be supported'}
    else:
        if cli(['git','cat-file','-e',ref+'^{commit}'],cwd=ROOT).returncode:
            fetched=cli(['git','fetch','origin',ref],cwd=ROOT)
            if fetched.returncode:raise ValueError('Requested commit is not fetchable from origin')
        source=tempfile.TemporaryDirectory(prefix='fox-relay-tools-')
        source_root=Path(source.name)
        bundle=subprocess.check_output(['git','archive',ref,'tools'],cwd=ROOT)
        with tarfile.open(fileobj=io.BytesIO(bundle)) as tar:tar.extractall(source_root,filter='data')
        if shots == 'gait' and os.environ.get('FOX_GAIT_CAPTURE_SCRIPT'):
            (source_root/'tools/gpu-capture.mjs').write_bytes(Path(os.environ['FOX_GAIT_CAPTURE_SCRIPT']).read_bytes())
        command=['modal','run','--detach',str(source_root/'tools/modal/gpu_capture.py'),'--ref',ref,'--shots',shots,'--out',str(folder/'evidence')]
        options={'size':'1920x1080' if 'gait' in shots.split(',') else '1280x720','fps':60,'route-seconds':120}
        for key,default in options.items():
            value=request.get(key,request.get(key.replace('-','_'),default))
            command += ['--'+key,str(value)]
        for key in ['route-from','route-to','orbit-seconds','quality','gpu']:
            value=request.get(key,request.get(key.replace('-','_')))
            if value is not None:command+=['--'+key,str(value)]
        capture_env=dict(os.environ)
        capture_env.pop('FOX_CAPTURE_SCRIPT',None)
        with (folder/'modal.log').open('w') as log:
            proc=subprocess.run(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,timeout=max(1,DEADLINE-time.time()),env=capture_env)
        source.cleanup()
        evidence=folder/'evidence'
        result={'status':'captured' if proc.returncode==0 else 'capture-failed','exit':proc.returncode,'ref':ref,'shots':shots,'path':str(evidence)}
        for name in ['run.json','report.json']:
            p=evidence/name
            if p.exists():
                data=json.loads(p.read_text())
                result[name]={k:data[k] for k in ['status','commit','gpu','failures','errors','captureToolSha'] if k in data}
        run=json.loads((evidence/'run.json').read_text()) if (evidence/'run.json').exists() else {}
        report=json.loads((evidence/'report.json').read_text()) if (evidence/'report.json').exists() else {}
        if run.get('commit')!=ref or run.get('shots')!=shots or not run.get('captureToolSha') or run.get('captureToolSha')!=report.get('captureToolSha'):
            result.update(status='capture-failed',verificationError='Missing or mismatched commit, shot or tool identity')
        elif run.get('status')=='failed' or report.get('failures') or report.get('errors'):
            result['status']='capture-failed'
        elif run.get('status')=='success':
            result['status']='captured'
            if proc.returncode:result['transportWarning']=f'Client exit {proc.returncode}; verified durable capture succeeded'
        archive=folder/'evidence.tar'
        with tarfile.open(archive,'w') as tar:
            if evidence.exists():tar.add(evidence,arcname='evidence')
            tar.add(folder/'modal.log',arcname='modal.log')
        uploaded=cli(['modal','volume','put','fox-agent-streams',str(archive),f'{stream}/captures/{folder.name}.tar','--force'])
        result['archive']=f'{stream}/captures/{folder.name}.tar' if uploaded.returncode==0 else None
    return result

def publish(stream, folder, result):
    result.update({'requestId':folder.name})
    request=json.loads((folder/'request.json').read_text())
    if isinstance(request,dict):result.update({k:request[k] for k in ['ref','reason','stage'] if k in request})
    archive=folder/'evidence.tar'
    if archive.exists() and not result.get('archive'):
        remote=f'{stream}/captures/{folder.name}.tar'
        if cli(['modal','volume','put','fox-agent-streams',str(archive),remote,'--force']).returncode==0:result['archive']=remote
    feedback=folder/'feedback.md'
    feedback.write_text('# GPU relay result\n\n'+json.dumps(result,indent=2)+'\n\nVisual verdict: NOT ASSESSED. Download the archive, inspect PNGs and state traces; machine success does not establish visual quality.\n')
    result['feedbackUploaded']=cli(['modal','volume','put','fox-agent-streams',str(feedback),f'{stream}/feedback.md','--force']).returncode==0
    (folder/'result.json').write_text(json.dumps(result,indent=2))
    print(json.dumps({'stream':stream,**result}),flush=True)

def process(stream, request, folder):
    try:
        result=capture_request(stream,request,folder)
    except Exception as exc:
        result={'status':'relay-error','error':str(exc)}
        if isinstance(exc,subprocess.TimeoutExpired):
            log=(folder/'modal.log').read_text() if (folder/'modal.log').exists() else ''
            apps=re.findall(r'https://modal.com/apps/[^/]+/[^/]+/(ap-[A-Za-z0-9]+)',log)
            for app in set(apps):cli(['modal','app','stop',app])
    try:publish(stream,folder,result)
    except Exception as exc:
        result['publishError']=str(exc)
        (folder/'result.json').write_text(json.dumps(result,indent=2))
        print(json.dumps(result),flush=True)

def republish_safe(stream,folder,result=None):
    try:
        if result is None:result=json.loads((folder/'result.json').read_text())
        if not result.get('feedbackUploaded') or (folder/'evidence.tar').exists() and not result.get('archive'):publish(stream,folder,result)
    except Exception as exc:print(f'republish {stream}/{folder.name}: {exc}',flush=True)

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--streams',default='loco,loco-glide,fox-ember,hub,reach,route-clear,camera,water-restore,shade')
    ap.add_argument('--once',action='store_true')
    ap.add_argument('--workers',type=int,default=2,choices=[1,2,4])
    args=ap.parse_args();args.out=args.out.resolve();args.out.mkdir(parents=True,exist_ok=True)
    pool=concurrent.futures.ThreadPoolExecutor(max_workers=args.workers);pending={}
    active=set()
    def enqueue(stream,request):
        key=hashlib.sha256(json.dumps(request,sort_keys=True).encode()).hexdigest()[:12]
        folder=args.out/stream/key
        if folder in active:return
        if (folder/'result.json').exists():
            republish_safe(stream,folder)
            return
        if (folder/'modal.log').exists():
            republish_safe(stream,folder,{'status':'interrupted','reason':'Prior client interrupted; recover printed durable run ID instead of duplicating GPU work'})
            return
        folder.mkdir(parents=True,exist_ok=True);active.add(folder);(folder/'queued.json').write_text(json.dumps(request,indent=2))
        print(f'queued {stream} {key}',flush=True)
        pending[pool.submit(process,stream,request,folder)]=folder
    signal.signal(signal.SIGTERM,request_stop);signal.signal(signal.SIGINT,request_stop)
    while time.time()<DEADLINE and not STOP_REQUESTED:
        roster=args.out/'streams.txt'
        names=roster.read_text().replace(',',' ').split() if roster.exists() else args.streams.split(',')
        for stream in names:
            if not re.fullmatch(r'[a-z0-9-]+',stream):continue
            target=args.out/f'{stream}-request.json'
            try:got=cli(['modal','volume','get','fox-agent-streams',f'{stream}/capture-request.json',str(target),'--force'])
            except (subprocess.TimeoutExpired,OSError) as exc:
                print(f'poll {stream}: {exc}',flush=True);continue
            if got.returncode:continue
            try:request=json.loads(target.read_text())
            except (ValueError,OSError):continue
            enqueue(stream,request)
            if isinstance(request,dict):
                for shot in request.get('followup_shots',[]):
                    follow={k:request[k] for k in ['ref','size','fps','quality'] if k in request}
                    follow.update(shots=shot,reason=f'Follow-up {shot} for {request.get("ref")}')
                    enqueue(stream,follow)
                if isinstance(request.get('also'),dict):enqueue(stream,request['also'])
        for task,folder in list(pending.items()):
            if task.done():
                try:task.result()
                except Exception as exc:print(f'relay worker: {exc}',flush=True)
                active.discard(folder);del pending[task]
        if args.once:break
        time.sleep(60)
    pool.shutdown(wait=True,cancel_futures=True)

if __name__=='__main__':main()
