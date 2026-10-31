/** Frame-index audit complements blackdetect's timestamp intervals at EOF.
 * FFmpeg blackframe logs zero-based frame/pblack fields:
 * https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/vf_blackframe.c
 */
export function blackFrameIntervals(log, fps) {
  if (!Number.isFinite(fps) || fps <= 0) throw Error('Invalid audit frame rate');
  const frames=[...new Set([...log.matchAll(/frame:\s*(\d+)\s+pblack:\s*(\d+)/g)]
    .filter(m=>Number(m[2])>=99).map(m=>Number(m[1])))].sort((a,b)=>a-b);
  const runs=[];
  for(const frame of frames) {
    const last=runs.at(-1);
    if(last && frame===last.lastFrame+1) last.lastFrame=frame;
    else runs.push({firstFrame:frame,lastFrame:frame});
  }
  return runs.map(run=>({...run,start:run.firstFrame/fps,end:(run.lastFrame+1)/fps,
    duration:(run.lastFrame-run.firstFrame+1)/fps}));
}
