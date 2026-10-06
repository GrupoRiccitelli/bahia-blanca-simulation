import {stateAt} from './engine.js';
import {anchorPose,dockPose,maneuverPose} from './geometry.js';
import {clampTime,validSelection} from './view-state.js';
export function syntheticView(run,time=0,selected=null){
 const bounds={start:0,end:run.scenario.horizon};time=clampTime(time,bounds);
 function pose(j,t){
  const state=stateAt(j,t),dock=dockPose(j.berth??j.preferredBerth,j);
  if(['expected','completed'].includes(state))return null;
  if(state==='waiting')return anchorPose(j.id);
  if(['handling','departure_wait'].includes(state))return dock;
  const inbound=state==='inbound',start=inbound?j.inboundStart:j.outboundStart,end=inbound?j.inboundEnd:j.outboundEnd;
  return maneuverPose(inbound?anchorPose(j.id):dock,inbound?dock:{x:4300,z:320,angle:0},inbound?'ENTRADA':'ZARPADA',(t-start)/(end-start),j);
 }
 const entities=run.jobs.map(j=>({id:String(j.id),name:j.name,length:j.length,beam:null,state:stateAt(j,time),evidence:'simulated',details:j,pose:pose(j,time)}));
 const tugs=[0,1,2].map(i=>{const duty=run.tugDuties.find(d=>d.tug===i&&time>=d.start&&time<d.end),idle={x:-810+i*45,z:50,angle:0};if(!duty)return idle;const j=run.jobs.find(j=>j.id===duty.vessel),m=run.movements.find(m=>m.vessel===j.id&&m.direction===duty.direction),p=pose(j,Math.min(time,m.end-.0001));if(!p)return idle;let x=p.x-j.length*.3,z=p.z+(i%2?1:-1)*30;if(time>=m.end){const f=Math.min(1,(time-m.end)/.5);x+=(idle.x-x)*f;z+=(idle.z-z)*f;}return {x,z,angle:p.angle};});
 return {datasetId:`synthetic-${run.scenario.mode??'demo'}`,kind:'synthetic',bounds,time,origin:Date.parse(run.scenario.startsAt),timezone:run.scenario.timezone,entities,selected:validSelection(entities,selected),tugs,closure:!!run.scenario.berthClosure&&time>=run.scenario.berthClosure.start&&time<run.scenario.berthClosure.end,metrics:run.metrics,metricEligibility:['averageWait','completed','berthUtilization','averageTurnaround']};
}
