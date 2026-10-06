// Shared schematic geometry. Headings use Three.js rotation.y: local +X is bow.
export const BERTH_X = Object.freeze([-560,-230,100]);
export const QUAY = Object.freeze({minX:-955,maxX:795,minZ:-900,maxZ:0});
export const TRANSIT_Z = 320;
export function dimensions(entity){const length=entity.length??entity.length_m??170;return {length,beam:entity.beam??entity.beam_m??length*.145};}
export function dockPose(index,entity={}){return {x:BERTH_X[index],z:Math.max(38,dimensions(entity).beam/2+3),angle:0};}
// Unique columns keep a vessel's trip from its holding point to the transit
// corridor clear of every other holding point, including later arrivals.
export function anchorPose(index,spacing=350){return {x:450+index*spacing,z:850,angle:0};}
const smooth=f=>f*f*(3-2*f);
function interpolate(a,b,f){const s=smooth(f);return {x:a.x+(b.x-a.x)*s,z:a.z+(b.z-a.z)*s,angle:a.angle+(b.angle-a.angle)*s};}
export function maneuverPose(from,to,direction,f,entity={}){
 const lane=Math.max(TRANSIT_Z,dimensions(entity).length*.6+40),a={...from,angle:0},d={...to,angle:0};
 // Tug-assisted lateral berth translation is explicit: rotation happens in
 // open water, then the hull remains parallel to the quay all the way in/out.
 const frames=direction==='ENTRADA'?[
  [0,a],[.25,{x:a.x,z:lane,angle:0}],[.35,{x:a.x,z:lane,angle:Math.PI}],
  [.7,{x:d.x,z:lane,angle:Math.PI}],[.85,{x:d.x,z:lane,angle:0}],[1,d],
 ]:[[0,a],[.35,{x:a.x,z:lane,angle:0}],[1,{...d,z:lane}]];
 const t=Math.max(0,Math.min(1,f));
 for(let i=1;i<frames.length;i++)if(t<=frames[i][0])return interpolate(frames[i-1][1],frames[i][1],(t-frames[i-1][0])/(frames[i][0]-frames[i-1][0]));
 return {...frames.at(-1)[1]};
}

// The rendered hull outline (port3d.hullShape), sampled with the renderer's
// eight quadratic segments, expanded by its one-unit bevel. These convex
// footprints include the full visible hull rather than an interior rectangle.
export function hullFootprint(entity){
 const {length:l,beam:w}=dimensions(entity),outline=[[-l*.5,-w*.38],[l*.32,-w*.5]];
 const curve=(a,b,c)=>{for(let i=1;i<=8;i++){const t=i/8,u=1-t;outline.push([u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]]);}};
 curve([l*.32,-w*.5],[l*.48,-w*.4],[l*.52,0]);curve([l*.52,0],[l*.48,w*.4],[l*.32,w*.5]);outline.push([-l*.5,w*.38]);
 const expanded=outline.map((p,i)=>{
  const before=outline[(i+outline.length-1)%outline.length],after=outline[(i+1)%outline.length];
  const normal=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],n=Math.hypot(dx,dz);return [dz/n,-dx/n];};
  const n1=normal(before,p),n2=normal(p,after),dot=n1[0]*n2[0]+n1[1]*n2[1];
  return [p[0]+(n1[0]+n2[0])/(1+dot),p[1]+(n1[1]+n2[1])/(1+dot)];
 });
 const p=entity.pose,c=Math.cos(p.angle),s=Math.sin(p.angle);
 return expanded.map(([x,z])=>({x:p.x+x*c+z*s,z:p.z-x*s+z*c}));
}
export function polygonsOverlap(a,b){
 for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],nx=q.z-p.z,nz=p.x-q.x;
  const projections=poly=>poly.map(v=>v.x*nx+v.z*nz),pa=projections(a),pb=projections(b);
  if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false;
 }
 return true;
}
export function hullsOverlap(a,b){
 if(!a.pose||!b.pose)return false;
 const radius=e=>{const d=dimensions(e);return Math.hypot(d.length*.52+2,d.beam*.5+2);};
 if(Math.hypot(a.pose.x-b.pose.x,a.pose.z-b.pose.z)>radius(a)+radius(b))return false;
 return polygonsOverlap(hullFootprint(a),hullFootprint(b));
}
export function hullOverlapsQuay(entity){
 if(!entity.pose)return false;
 const {length,beam}=dimensions(entity),p=entity.pose;
 if(p.z-(length*.52+2)*Math.abs(Math.sin(p.angle))-(beam*.5+2)*Math.abs(Math.cos(p.angle))>=0)return false;
 const poly=hullFootprint(entity);if(poly.every(p=>p.z>=0))return false;
 return polygonsOverlap(poly,[{x:QUAY.minX,z:QUAY.minZ},{x:QUAY.maxX,z:QUAY.minZ},{x:QUAY.maxX,z:QUAY.maxZ},{x:QUAY.minX,z:QUAY.maxZ}]);
}
