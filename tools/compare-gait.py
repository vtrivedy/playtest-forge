#!/usr/bin/env python3
"""Compare two matched gait captures; generate independent landmark metrics and a side-by-side MP4.
python3 tools/compare-gait.py LEFT/gait RIGHT/gait --out REVIEW
"""
import argparse,json,math,statistics,subprocess
from pathlib import Path


def describe(values):
    if not values:return None
    ordered=sorted(values)
    return {'samples':len(values),'median':statistics.median(values),'p95':ordered[min(len(ordered)-1,int(.95*len(ordered)))],'max':max(values)}


def analyze(folder):
    data=json.loads((folder/'gait.json').read_text())
    script=json.loads((folder/'gait-script.json').read_text())
    metadata=json.loads((folder/'run.json').read_text())
    trace=data['trace']
    if len(trace)!=data['frames']:raise ValueError('Per-frame trace required')
    idle=[row for row in trace if row['frame']<script['segments'][0]['end']]
    clearances={}
    for foot in ['LF','RF','LH','RH']:
        vals=[row['state'].get('capture',{}).get('feet',{}).get(foot,{}).get('clearance') for row in idle]
        vals=[v for v in vals if v is not None and math.isfinite(v)]
        if not vals:raise ValueError(f'{folder}: independent {foot} landmark is missing')
        clearances[foot]=statistics.median(vals)
    pitches=[row['state'].get('capture',{}).get('body',{}).get('pitch') for row in idle if row['state'].get('capture',{}).get('body')]
    rest_pitch=statistics.median(pitches) if pitches else None
    segments={}
    for segment in script['segments']:
        rows=trace[segment['start']:segment['end']]
        slip=[];support_gap=[];penetration=[];pitch_error=[];reported_residual=[]; speeds=[]; gaits={}
        prev=None
        for row in rows:
            state=row['state'];sample=state.get('capture',{}); speeds.append(math.hypot(state['vel'][0],state['vel'][2])); gait=state.get('gait') or state.get('locomotion',{}).get('gait') or state.get('anim','unreported'); gaits[gait]=gaits.get(gait,0)+1
            # Exclude only the first 0.15 output seconds after an explicitly staged reset.
            eligible=not segment.get('reset') or row['frame']-segment['start']>=9
            if segment['name'].startswith('slope') and (not sample.get('body') or abs(sample['body']['floorPitch'])<.05): eligible=False
            if state['grounded'] and eligible:
                foot_errors=[]
                for foot,point in sample.get('feet',{}).items():
                    clearance=point.get('clearance')
                    if clearance is None:continue
                    error=clearance-clearances[foot];foot_errors.append(error)
                    if prev and abs(error)<=.03:
                        old=prev['state'].get('capture',{}).get('feet',{}).get(foot,{})
                        if old.get('clearance') is not None and abs(old['clearance']-clearances[foot])<=.03 and prev['state']['grounded']:
                            x,_,z=point['position'];ox,_,oz=old['position'];slip.append(math.hypot(x-ox,z-oz)/row['dt'])
                if foot_errors:
                    support_gap.append(min(abs(error) for error in foot_errors))
                    penetration.append(max(0,-min(foot_errors)))
                body=sample.get('body')
                if body and rest_pitch is not None:
                    pitch_error.append((body['pitch']-rest_pitch-body['floorPitch'])*180/math.pi)
                reported=state.get('locomotion',{}).get('maxResidual')
                if reported is not None:reported_residual.append(reported)
            prev=row
        segments[segment['name']]={'nearGroundPawSpeed_m_s':describe(slip),'closestPawJointHeightDeviation_m':describe(support_gap),'pawJointDropBelowIdle_m':describe(penetration),'torsoPitchVsFloor_deg':{'meanOffset':statistics.mean(pitch_error),'peakToPeak':max(pitch_error)-min(pitch_error),'samples':len(pitch_error)} if pitch_error else None,'branchReportedResidual_m':describe(reported_residual),'speed_m_s':describe(speeds),'gaitFrames':gaits,'nearGroundSpeedAbove03Fraction':sum(v>.3 for v in slip)/len(slip) if slip else None}
    return {'commit':metadata['commit'],'frames':data['frames'],'fps':metadata['fps'],'viewport':[int(v) for v in metadata['size'].split('x')], 'quality':metadata['quality'], 'backend':metadata['backend'], 'captureToolSha':metadata.get('captureToolSha'), 'gpu':metadata['gpu'],'idlePawClearance_m':clearances,'idleBodyPitch_rad':rest_pitch,'segments':segments},script


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('left',type=Path);parser.add_argument('right',type=Path)
    parser.add_argument('--out',required=True,type=Path)
    parser.add_argument('--left-label',default='s2-loco');parser.add_argument('--right-label',default='s2-loco-sol')
    parser.add_argument('--metrics-only',action='store_true')
    parser.add_argument('--tool-sources',nargs=2,type=Path,help='Auditable exact source pair when only the inactive turntable block differs')
    args=parser.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    left,ls=analyze(args.left);right,rs=analyze(args.right)
    if any(left[k]!=right[k] for k in ['frames','fps','viewport','quality','backend']):raise ValueError('Captures have different timing/dimensions/quality')
    tool_proof=None
    if left['captureToolSha']!=right['captureToolSha']:
        if not args.tool_sources:raise ValueError('Different capture tools; exact source proof is required')
        import hashlib
        sources=[source.read_bytes() for source in args.tool_sources]
        for source,data in zip(sources,[left,right]):
            if hashlib.sha256(source).hexdigest()!=data['captureToolSha']:raise ValueError('Tool source hash does not match capture metadata')
        def active(source):
            text=source.decode();return text.split("  if (wants('turntable')) {",1)[0]+text[text.index('} catch (e) { report.failures'): ]
        if active(sources[0])!=active(sources[1]):raise ValueError('Active gait/boot/video code differs')
        tool_proof={'sources':[str(p) for p in args.tool_sources],'activeCodeSha':hashlib.sha256(active(sources[0]).encode()).hexdigest(),'difference':'Only the inactive turntable shot differs; all boot/video/gait code is byte-identical'}
    if not left['captureToolSha']:raise ValueError('Capture tool identity is missing; recapture both refs with current tooling')
    if ls['gym']!=rs['gym']:raise ValueError('Different gym configuration')
    if ls['segments']!=rs['segments']:raise ValueError('Captures use different input scripts')
    summary={'left':left,'right':right,'toolEquivalenceProof':tool_proof,'method':'Solved paw-bone heads (fore: carpus, hind: MTP joint), not pads or toe mesh. Near-ground means within 3cm of idle JOINT clearance on two consecutive body-grounded frames; swing/landing can enter this band, so this is a motion proxy, not measured contact/skating. Joint height deviation is not mesh penetration; gallop suspension can raise every joint. Torso mean offset vs idle/floor and oscillation are separate. Slope rows use only actual incline frames; first 9 frames after staged resets are excluded. Ns, speed and gait histograms are reported. Human pad/toe judgment and readability scoring remain necessary.'}
    (args.out/'comparison.json').write_text(json.dumps(summary,indent=2))
    lines=['# Matched gait measurements','',str(tool_proof) if tool_proof else 'Exact capture-tool hashes match.','',summary['method'],'',f"Left: {args.left} / {left['commit']}",f"Right: {args.right} / {right['commit']}",'','| Segment | Candidate | Near-height joint speed p95 (m/s), N | Closest joint height dev p95 (m) | Torso mean offset / oscillation (deg) | Speed median | Gaits (frames) |','|---|---|---:|---:|---:|---:|---|']
    def value(metric):return 'n/a' if metric is None else f"{metric['p95']:.3f}"
    for segment in left['segments']:
        for label,data in [(args.left_label,left),(args.right_label,right)]:
            item=data['segments'][segment]
            motion=item['nearGroundPawSpeed_m_s'];pitch=item['torsoPitchVsFloor_deg']
            pitch_text='n/a' if pitch is None else f"{pitch['meanOffset']:.2f} / {pitch['peakToPeak']:.2f}"
            lines.append(f"| {segment} | {label} | {value(motion)}, N={motion['samples'] if motion else 0} | {value(item['closestPawJointHeightDeviation_m'])} | {pitch_text} | {item['speed_m_s']['median']:.2f} | {item['gaitFrames']} |")
    (args.out/'MEASUREMENTS.md').write_text('\n'.join(lines)+'\n')
    if not args.metrics_only:
        # Labels use text files so punctuation cannot become filter syntax.
        (args.out/'left-label.txt').write_text(f'{args.left_label} | {left["commit"][:7]}')
        (args.out/'right-label.txt').write_text(f'{args.right_label} | {right["commit"][:7]}')
        left_text=str((args.out/'left-label.txt').resolve()).replace('\\','\\\\').replace(':','\\:').replace("'","\\'")
        right_text=str((args.out/'right-label.txt').resolve()).replace('\\','\\\\').replace(':','\\:').replace("'","\\'")
        filters=f"[0:v]scale=1920:1080,pad=1920:1140:0:60:color=0x211b16,drawtext=textfile='{left_text}':x=16:y=10:fontsize=28:fontcolor=white,drawtext=text='frame %{{n}}':x=16:y=40:fontsize=18:fontcolor=white[l];[1:v]scale=1920:1080,pad=1920:1140:0:60:color=0x211b16,drawtext=textfile='{right_text}':x=16:y=10:fontsize=28:fontcolor=white,drawtext=text='frame %{{n}}':x=16:y=40:fontsize=18:fontcolor=white[r];[l][r]hstack=inputs=2[v]"
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(args.left/'gait.mp4'),'-i',str(args.right/'gait.mp4'),'-filter_complex_threads','1','-filter_complex',filters,'-map','[v]','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(args.out/'gait-ab.mp4')],check=True)
    print(args.out.resolve())


if __name__=='__main__':main()
