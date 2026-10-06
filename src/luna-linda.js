import {clampTime} from './view-state.js';
import {maneuverPose} from './geometry.js';
// Vessel particulars are sourced; port placement and schedule are hypothetical.
export const LUNA_LINDA = Object.freeze({
 id:'hypothetical-luna-linda',name:'LUNA LINDA',imo:'9792369',length_m:138,beam_m:26,
 type:'Aggregates Carrier',checked_on:'2026-10-06',
 source:'https://www.vesselfinder.com/vessels/details/9792369',
 user_reference:'https://www.marinetraffic.com/en/ais/details/ships/shipid:4037568',
 reference_identity:'MarineTraffic page unavailable; name match to public vessel particulars, not a verified shipid/IMO mapping',
 assumptions:['No confirmed Bahía Blanca call or AIS position.','Illustrative anchorage and berth; no terminal compatibility assessment.','Hypothetical arrival uses the first free visual turn at or after hour 1 and lasts 45 minutes; any hold is illustrative.','No cargo handling, resource allocation or performance metrics inferred.'],
});
export function lunaLindaSchedule(view){
 let start=1;
 for(const m of [...(view.motion?.movements??[])].sort((a,b)=>a.start-b.start)){
  if(start+.75<=m.start)break;
  if(start<m.end)start=m.end;
 }
 return {start,end:start+.75,durationHours:.75,evidence:'hypothetical-visual-turn'};
}
export function lunaLindaBounds(view,animate=true){return {...view.bounds,end:animate?Math.max(view.bounds.end,lunaLindaSchedule(view).end):view.bounds.end};}
export function withLunaLinda(view,animate=true,requestedTime=view.time){
 const schedule=lunaLindaSchedule(view),bounds=lunaLindaBounds(view,animate),time=clampTime(requestedTime,bounds);
 const f=animate?Math.max(0,Math.min(1,(time-schedule.start)/schedule.durationHours)):0;
 // Use the unchanged report placements to keep the optional holding point
 // stable across forward/backward seeks, even while source hulls are moving.
 const reported=view.reportedEntities??view.entities;
 const anchors=reported.filter(e=>e.pose&&e.state==='reported-anchorage');
 const a={x:Math.max(1150,...anchors.map(e=>e.pose.x))+350,z:850,angle:0},d={x:430,z:38,angle:0};
 const pose={...maneuverPose(a,d,'ENTRADA',f,{length:138,beam:26}),provenance:'hypothetical-luna-linda-route'};
 const entity={id:LUNA_LINDA.id,name:LUNA_LINDA.name,length:138,beam:26,evidence:'assumed',state:f===0?'illustrative-hypothetical-anchorage':f<1?'illustrative-entrada':'illustrative-alongside',pose,details:{terminal:'Muelle hipotético · sin terminal real asignada',length_m:138,beam_m:26,assertion_ids:[],hypothetical:true},movement:schedule};
 const entities=[...view.entities,entity];
 return {...view,datasetId:view.datasetId+'-luna-linda',bounds,time,entities,selected:view.selected===LUNA_LINDA.id?LUNA_LINDA.id:view.selected,additionalVessels:[{...LUNA_LINDA,illustrativeSchedule:schedule}]};
}
