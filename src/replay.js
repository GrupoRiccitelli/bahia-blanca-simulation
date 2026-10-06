import {clampTime,validSelection} from './view-state.js';
export function sourceView(bundle,time=0,selected=null){
 const origin=Date.parse(bundle.coverage.start),bounds={start:0,end:(Date.parse(bundle.coverage.end)-origin)/3600000};time=clampTime(time,bounds);
 const berthIndex=t=>/ADM/i.test(t)?0:/TBB|9/i.test(t)?1:/CARGILL/i.test(t)?2:null;
 let anchorage=0;
 const entities=bundle.observations.filter(o=>o.in_scope).map(o=>{const index=berthIndex(o.terminal),n=o.state==='reported-anchorage'?anchorage++:0;return {id:o.id,name:o.name,length:o.length_m??null,beam:o.beam_m??null,state:o.state,evidence:'reported',details:o,pose:o.state==='reported-alongside'&&index!==null?{x:[-560,-230,100][index],z:38,angle:0,provenance:'illustrative-report-placement'}:o.state==='reported-anchorage'?{x:450+(n%3)*200,z:270+Math.floor(n/3)*150,angle:0,provenance:'illustrative-report-placement'}:null};});
 const timeline=bundle.intentions.map(i=>({id:i.id,name:i.name,details:i,markers:[['planned_pilot_time',i.pilot_time],['planned_tug_time',i.tug_time]].filter(([,t])=>t).map(([type,t])=>({type,time:t,at:t.earliest==null?null:(Date.parse(t.earliest)-origin)/3600000,end:t.latest==null?null:(Date.parse(t.latest)-origin)/3600000,evidence:'reported',status:'planned'}))}));
 return {datasetId:bundle.id,kind:'published_snapshot',bounds,time,origin,timezone:'America/Argentina/Buenos_Aires',selected:validSelection(entities,selected),entities,timeline,tugs:[],closure:false,metrics:{reported_count:bundle.observations.length,plan_count:bundle.intentions.length,coverage:bundle.inventory.length},metricEligibility:['reported_count','plan_count','coverage'],bundle};
}
export function sourceExport(bundle){return {format:'bahia-source-evidence-v1',bundle};}
