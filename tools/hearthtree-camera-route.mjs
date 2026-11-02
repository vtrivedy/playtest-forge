export const SLICE_START={x:27.6,z:72.6,yaw:-2.90785};
export const SLICE_STAGING='dev-release Hearthtree; advance25s for settle; one start teleport on bridge; controller input thereafter';
export function prepareSlice(h){h.keepingRelease();h.advance(1500,1/60,false);}
export function createSliceRoute(){
  return (t,s)=>{
    let to=null,beat='near root';
    if(t>=1&&t<2.5){to=[26.8,69];beat='walk to middle';}
    else if(t>=2.5&&t<6)beat='middle bridge';
    else if(t>=6&&t<9){to=[26,65.2];beat='across to crag';}
    else if(t>=9&&t<12.5){to=[27.1,70];beat='return along trunk';}
    else if(t>=12.5)beat='bridge rest';
    const dx=to?to[0]-s.pos[0]:0,dz=to?to[1]-s.pos[2]:0,d=Math.hypot(dx,dz);
    return {x:d>.25?dx/d:0,z:d>.25?dz/d:0,jump:false,dash:false,beat};
  };
}
