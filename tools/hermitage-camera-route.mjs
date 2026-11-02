export const SLICE_START={x:-9.7,z:102.3,yaw:-.456};
export function createSliceRoute(){
  const legs=[[-12.6,108.2],[-14.2,114.6],[-11.4,120.8],[-7.6,124.6],[-7,129.4],[-8.2,134],[-8.2,134.2],null,[-11.6,129.65],[-7,129.4],[.2,130],[-7,129.4],[-10,134],[-12.3,138.7],null,[-10,134],[-7,129.4],[-7.6,124.6],[-11.4,120.8],[-14.2,114.6],[-12.6,108.2],[-9.7,102.3]];
  let leg=0,entered=0;
  return(t,s)=>{
    if(leg>=legs.length)return{x:0,z:0,jump:false,dash:false,beat:'complete Hermitage'};
    const to=legs[leg];
    const beat=leg===7?'at desk':leg===14?'leaves released':`Hermitage leg ${leg}`;
    let x=0,z=0;
    if(to){const dx=to[0]-s.pos[0],dz=to[1]-s.pos[2],d=Math.hypot(dx,dz);if(d<.55){leg++;entered=t;}else{x=dx/d;z=dz/d;}}
    else if(t-entered>4){leg++;entered=t;}
    return{x,z,jump:false,dash:false,beat};
  };
}
