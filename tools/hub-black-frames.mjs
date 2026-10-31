/** Frame-index audit complements blackdetect's timestamp intervals at EOF.
 * FFmpeg blackframe logs zero-based frame/pblack fields:
 * https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/vf_blackframe.c
 */
export function classifyBlackPixels(data, width, height) {
  if(!Number.isInteger(width) || !Number.isInteger(height) || width<=0 || height<=0 || data.length!==width*height*4)
    throw Error('Invalid RGBA capture sample');
  let maxChannel=0,dark=0;
  for(let i=0;i<data.length;i+=4) {
    const r=data[i],g=data[i+1],b=data[i+2];
    maxChannel=Math.max(maxChannel,r,g,b);
    // Conservative precheck for the encoded video's limited-range Y20 audit.
    if(16+219*(.299*r+.587*g+.114*b)/255<20.5) dark++;
  }
  const darkRatio=dark/(width*height);
  return {width,height,maxChannel,darkRatio,black:maxChannel<=3 || darkRatio>=.99};
}

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
