"""Poll Modal agent requests and relay GPU evidence. No local browser."""
import argparse, concurrent.futures, hashlib, io, json, os, re, signal, subprocess, tarfile, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STOP_REQUESTED = False

def request_stop(*_):
    global STOP_REQUESTED
    STOP_REQUESTED = True

DEADLINE = 1793439600  # 2026-10-31 05:40 ET; final packaging is separate.
SHOTS = set('probe perf route kilnroute hub orbit fox gait worldgait worldstrides stills water shade turntable updraft wind growth levels windgap marshmouth reed crown flow showcase reach reachview reachsafe finale feel'.split())

def cli(args, **kw):
    return subprocess.run(args, text=True, capture_output=True, timeout=60, **kw)

def identity_failures(run, report, ref, shots):
    failures = []
    if run.get('commit') != ref:
        failures.append('run.commit differs from requested ref or is absent')
    if run.get('shots') != shots:
        failures.append('run.shots differs from requested shots or is absent')
    if not run.get('captureToolSha'):
        failures.append('run.captureToolSha is absent')
    elif run.get('captureToolSha') != report.get('captureToolSha'):
        failures.append('report.captureToolSha differs from run or is absent')
    return failures

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
        wrapper=source_root/'tools/modal/gpu_capture.py'
        requested_wrapper=wrapper.read_text()
        canonical=(ROOT/'tools/modal/gpu_capture.py').read_text()
        (folder/'requested-gpu_capture.py').write_text(requested_wrapper)
        applied_wrapper=canonical
        wrapper.write_text(applied_wrapper)
        (folder/'applied-gpu_capture.py').write_text(applied_wrapper)
        mounts=sorted(p.name for p in (source_root/'tools').glob('*.mjs'))
        (folder/'packaging.json').write_text(json.dumps({'patch':'canonical transport wrapper; requested game and JS modules unchanged','modules':mounts,'gameSha':ref},indent=2))
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
        capture_env['FOX_CAPTURE_APP']=f'fox-relay-{stream}-{folder.name}'
        with (folder/'modal.log').open('w') as log:
            proc=subprocess.run(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,timeout=max(1,DEADLINE-time.time()),env=capture_env,start_new_session=True)
        source.cleanup()
        evidence=folder/'evidence'
        result={'status':'captured' if proc.returncode==0 else 'capture-failed','exit':proc.returncode,'ref':ref,'shots':shots,'path':str(evidence),'moduleMounts':mounts}
        metadata={}
        for name in ['run.json','report.json']:
            p=evidence/name
            try:
                data=json.loads(p.read_text()) if p.exists() else {}
                metadata[name]=data
                result[name]={k:data[k] for k in ['status','commit','gpu','failures','errors','captureToolSha'] if k in data}
            except (ValueError,OSError) as exc:
                metadata[name]={}
                result.setdefault('metadataErrors',{})[name]=str(exc)
        run=metadata['run.json'];report=metadata['report.json']
        if not run or not report:
            result.update(status='capture-incomplete',verificationError='Completion metadata absent or unreadable; inspect cancellation/download log, not an identity verdict')
        elif identity_failures(run,report,ref,shots):
            result.update(status='capture-failed',verificationError='Commit, shot or tool identity disagreement',identity={'requestedRef':ref,'actualCommit':run.get('commit'),'requestedShots':shots,'actualShots':run.get('shots'),'runTool':run.get('captureToolSha'),'reportTool':report.get('captureToolSha')})
        elif run.get('status')=='failed' or report.get('failures') or report.get('errors'):
            result['status']='capture-failed'
        elif proc.returncode or not (evidence/'.download-complete').exists():
            result.update(status='capture-incomplete',verificationError='Client exit or absent atomic download completion marker')
        elif run.get('status')=='success':
            result['status']='captured'
        archive=folder/'evidence.tar'
        with tarfile.open(archive,'w') as tar:
            if evidence.exists():tar.add(evidence,arcname='evidence')
            tar.add(folder/'modal.log',arcname='modal.log')
            for provenance in ['request.json','packaging.json','requested-gpu_capture.py','applied-gpu_capture.py']:
                if (folder/provenance).exists():tar.add(folder/provenance,arcname=provenance)
        uploaded=cli(['modal','volume','put','fox-agent-streams',str(archive),f'{stream}/captures/{folder.name}.tar','--force'])
        result['archive']=f'{stream}/captures/{folder.name}.tar' if uploaded.returncode==0 else None
    return result

def publish(stream, folder, result):
    result.update({'requestId':folder.name})
    request=json.loads((folder/'request.json').read_text())
    if isinstance(request,dict):
        result.update({k:request[k] for k in ['ref','stage'] if k in request})
        result['requestReason']=request.get('reason')
        if 'reason' not in result:result['reason']=request.get('reason')
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
        if len(pending)>=args.workers:return
        folder.mkdir(parents=True,exist_ok=True);active.add(folder);(folder/'queued.json').write_text(json.dumps(request,indent=2))
        print(f'queued {stream} {key}',flush=True)
        pending[pool.submit(process,stream,request,folder)]=folder
    signal.signal(signal.SIGTERM,request_stop);signal.signal(signal.SIGINT,request_stop)
    while time.time()<DEADLINE and not STOP_REQUESTED:
        for task,folder in list(pending.items()):
            if task.done():
                try:task.result()
                except Exception as exc:print(f'relay worker: {exc}',flush=True)
                active.discard(folder);del pending[task]
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
