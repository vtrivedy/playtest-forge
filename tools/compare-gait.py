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
        slip=[];support_gap=[];penetration=[];pitch_error=[];reported_residual=[]
        prev=None
        for row in rows:
            state=row['state'];sample=state.get('capture',{})
            # Exclude only the first 0.15 output seconds after an explicitly staged reset.
            eligible=not segment.get('reset') or row['frame']-segment['start']>=9
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
                    pitch_error.append(abs(body['pitch']-rest_pitch-body['floorPitch'])*180/math.pi)
                reported=state.get('locomotion',{}).get('maxResidual')
                if reported is not None:reported_residual.append(reported)
            prev=row
        segments[segment['name']]={'nearGroundPawSpeed_m_s':describe(slip),'nearestSupportHeightError_m':describe(support_gap),'lowestPawPenetrationFromRest_m':describe(penetration),'bodyVsFloorPitchError_deg':describe(pitch_error),'branchReportedResidual_m':describe(reported_residual)}
    return {'commit':metadata['commit'],'frames':data['frames'],'fps':metadata['fps'],'viewport':[int(v) for v in metadata['size'].split('x')],'idlePawClearance_m':clearances,'idleBodyPitch_rad':rest_pitch,'segments':segments},script


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('left',type=Path);parser.add_argument('right',type=Path)
    parser.add_argument('--out',required=True,type=Path)
    parser.add_argument('--left-label',default='s2-loco');parser.add_argument('--right-label',default='s2-loco-sol')
    parser.add_argument('--metrics-only',action='store_true')
    args=parser.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    left,ls=analyze(args.left);right,rs=analyze(args.right)
    if any(left[k]!=right[k] for k in ['frames','fps','viewport']):raise ValueError('Captures have different timing/dimensions')
    if ls['segments']!=rs['segments']:raise ValueError('Captures use different input scripts')
    summary={'left':left,'right':right,'method':'Actual paw-bone heads after IK. Idle-calibrated clearance. Near-ground = within 3cm of idle clearance on two consecutive grounded frames; this is a slip proxy, not a contact sensor. Support gap is the nearest paw to its idle ground clearance; swing feet are not labelled contact. Torso is pelvis-to-chest relative to idle and sampled floor pitch. Excludes first 9 frames after staged resets. Human scoring/readability must be added after viewing.'}
    (args.out/'comparison.json').write_text(json.dumps(summary,indent=2))
    lines=['# Matched gait measurements','',summary['method'],'',f"Left: {args.left} / {left['commit']}",f"Right: {args.right} / {right['commit']}",'','| Segment | Candidate | Near-ground paw speed p95 (m/s) | Support gap p95 (m) | Pitch error p95 (deg) |','|---|---|---:|---:|---:|']
    def value(metric):return 'n/a' if metric is None else f"{metric['p95']:.3f}"
    for segment in left['segments']:
        for label,data in [(args.left_label,left),(args.right_label,right)]:
            item=data['segments'][segment]
            lines.append(f"| {segment} | {label} | {value(item['nearGroundPawSpeed_m_s'])} | {value(item['nearestSupportHeightError_m'])} | {value(item['bodyVsFloorPitchError_deg'])} |")
    (args.out/'MEASUREMENTS.md').write_text('\n'.join(lines)+'\n')
    if not args.metrics_only:
        # Labels use text files so punctuation cannot become filter syntax.
        (args.out/'left-label.txt').write_text(f'{args.left_label} | {left["commit"][:7]}')
        (args.out/'right-label.txt').write_text(f'{args.right_label} | {right["commit"][:7]}')
        left_text=str((args.out/'left-label.txt').resolve()).replace('\\','\\\\').replace(':','\\:').replace("'","\\'")
        right_text=str((args.out/'right-label.txt').resolve()).replace('\\','\\\\').replace(':','\\:').replace("'","\\'")
        filters=f"[0:v]scale=960:540,pad=960:580:0:40:color=0x211b16,drawtext=textfile='{left_text}':x=16:y=10:fontsize=22:fontcolor=white[l];[1:v]scale=960:540,pad=960:580:0:40:color=0x211b16,drawtext=textfile='{right_text}':x=16:y=10:fontsize=22:fontcolor=white[r];[l][r]hstack=inputs=2[v]"
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(args.left/'gait.mp4'),'-i',str(args.right/'gait.mp4'),'-filter_complex_threads','1','-filter_complex',filters,'-map','[v]','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(args.out/'gait-ab.mp4')],check=True)
    print(args.out.resolve())


if __name__=='__main__':main()
