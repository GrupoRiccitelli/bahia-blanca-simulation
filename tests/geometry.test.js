import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hullFootprint,hullsOverlap,hullOverlapsQuay,dimensions} from '../src/geometry.js';
import {motionPlan,sourceMotionView,sourceMotionBounds} from '../src/source-motion.js';
import {sourceView} from '../src/replay.js';
import {withLunaLinda,lunaLindaBounds,lunaLindaSchedule,LUNA_LINDA} from '../src/luna-linda.js';
import {syntheticView} from '../src/synthetic-adapter.js';
import {createScenario,simulate,MODES} from '../src/engine.js';
function constructed(){
 const origin='2026-10-06T09:30:00Z',stamp=t=>{const value=new Date(Date.parse(origin)+t*3600000).toISOString();return {earliest:value,latest:value,precision:'datetime'};};
 const terminals=['ADM','TBB 9','Cargill'];
 const observations=[229,200,225,190,229,229,225,229].map((length_m,i)=>({id:`hull-${i}`,name:`Constructed ${i}`,length_m,beam_m:null,terminal:terminals[[0,1,2,2,1,0,1,2][i]],state:i<3?'reported-alongside':'reported-anchorage',in_scope:true}));
 const intentions=[[4,2.5,'ENTRADA'],[5,2.5,'ENTRADA'],[1,2,'ZARPADA'],[0,2,'ZARPADA'],[3,5.5,'ENTRADA'],[2,5,'ZARPADA']].map(([index,time,direction],i)=>({id:`plan-${i}`,name:observations[index].name,terminal:observations[index].terminal,direction,tug_time:stamp(time),tugs:[]}));
 return {id:'constructed-geometry',bundle_hash:'a'.repeat(64),coverage:{start:origin,end:stamp(5.5).earliest},observations,intentions,inventory:[]};
}
function assertClear(view,label){
 const visible=view.entities.filter(e=>e.pose);
 for(let i=0;i<visible.length;i++){
  const a=visible[i];assert.equal(hullOverlapsQuay(a),false,`${label}: ${a.name} quay overlap at ${view.time}`);
  for(let j=i+1;j<visible.length;j++)assert.equal(hullsOverlap(a,visible[j]),false,`${label}: ${a.name}/${visible[j].name} overlap at ${view.time}`);
 }
}
function sample(getView,end,label){for(let tick=0;tick<=Math.ceil(end*1000);tick++)assertClear(getView(Math.min(end,tick/1000)),label);}

test('full rendered hull footprint detects bow overlap outside audit interior rectangle and quay sweep',()=>{
 const a={length:229,beam:null,pose:{x:0,z:38,angle:0}},b={length:229,beam:null,pose:{x:220,z:38,angle:0}};
 assert.equal(dimensions(a).beam,229*.145);assert.ok(hullFootprint(a).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));
 assert.equal(hullsOverlap(a,b),true);assert.equal(hullOverlapsQuay(a),false);
 assert.equal(hullOverlapsQuay({...a,pose:{x:0,z:38,angle:Math.PI/2}}),true);
});
test('all source hull pairs and quay stay clear with Luna through complete constructed overlay',()=>{
 const b=constructed(),original=JSON.stringify(b),end=withLunaLinda(sourceMotionView(b,100)).bounds.end;
 sample(t=>withLunaLinda(sourceMotionView(b,t),true,t),end,'constructed source + Luna');
 assert.equal(JSON.stringify(b),original);assert.deepEqual(sourceMotionView(b,0).reportedEntities,sourceView(b).entities);
 const plan=motionPlan(b),sorted=[...plan.movements].sort((a,b)=>a.start-b.start);
 for(let i=1;i<sorted.length;i++)assert.ok(sorted[i].start>=sorted[i-1].end);
 assert.ok(plan.movements.some(m=>m.delayHours>0));
 for(const m of plan.movements){const intention=b.intentions.find(i=>i.id===m.intentionId);assert.equal(m.plannedStart,(Date.parse(intention.tug_time.earliest)-plan.origin)/3600000);}
 assert.deepEqual(sourceMotionBounds(b),plan.bounds);
});
const frozenPath=new URL('../data/normalized/bahia-2026-10-06.json',import.meta.url);
test('all frozen-source hull pairs and quay stay clear with Luna across complete overlay',{skip:!fs.existsSync(frozenPath)},()=>{
 const b=JSON.parse(fs.readFileSync(frozenPath,'utf8')),end=withLunaLinda(sourceMotionView(b,100)).bounds.end;
 sample(t=>withLunaLinda(sourceMotionView(b,t),true,t),end,'frozen source + Luna');
 sample(t=>sourceMotionView(b,t),end,'frozen source');
 assertClear(sourceView(b,0),'frozen snapshot');
});
for(const mode of Object.keys(MODES))test(`all synthetic ${mode} hull pairs and quay stay clear through complete run`,()=>{
 const run=simulate(createScenario(mode)),original=JSON.stringify(run);
 sample(t=>syntheticView(run,t),run.scenario.horizon,`synthetic ${mode}`);
 assert.equal(JSON.stringify(run),original);
 const first=syntheticView(run,18.44);syntheticView(run,48);assert.deepEqual(syntheticView(run,18.44),first);
 for(const j of run.jobs)for(const t of [j.inboundStart,j.inboundEnd,j.outboundStart].filter(Number.isFinite)){
  const before=syntheticView(run,t-1e-7).entities.find(e=>e.id===String(j.id)).pose,after=syntheticView(run,t+1e-7).entities.find(e=>e.id===String(j.id)).pose;
  if(before&&after){assert.ok(Math.hypot(before.x-after.x,before.z-after.z)<.01);assert.ok(Math.abs(before.angle-after.angle)<.001);}
 }
});
test('source and Luna poses remain continuous at all route segments and berth boundaries',()=>{
 const b=constructed(),plan=motionPlan(b),epsilon=1e-7;
 for(const m of plan.movements){const times=m.direction==='ENTRADA'?[0,.25,.35,.7,.85,1]:[0,.35];
  for(const f of times){const t=m.start+f*m.durationHours,a=sourceMotionView(b,t-epsilon).entities.find(e=>e.id===m.entityId),c=sourceMotionView(b,t+epsilon).entities.find(e=>e.id===m.entityId);
   assert.ok(Math.hypot(a.pose.x-c.pose.x,a.pose.z-c.pose.z)<.01);assert.ok(Math.abs(a.pose.angle-c.pose.angle)<.001);
  }
 }
 for(const t of [1,1.1875,1.2625,1.525,1.6375,1.75]){const get=time=>withLunaLinda(sourceMotionView(b,time),true,time).entities.find(e=>e.id===LUNA_LINDA.id).pose,a=get(t-epsilon),c=get(t+epsilon);assert.ok(Math.hypot(a.x-c.x,a.z-c.z)<.01);assert.ok(Math.abs(a.angle-c.angle)<.001);}
});
test('short evidence bounds extend only illustrative Luna playback and backward seeks are deterministic',()=>{
 const b=constructed();b.intentions=[];b.coverage.end=new Date(Date.parse(b.coverage.start)+.5*3600000).toISOString();
 const base=sourceMotionView(b,100),end=withLunaLinda(base,true,100);
 assert.equal(base.bounds.end,.5);assert.equal(end.bounds.end,1.75);assert.equal(end.time,1.75);assert.equal(end.entities.at(-1).state,'illustrative-alongside');
 assert.equal(withLunaLinda(base,false,100).bounds.end,.5);assert.equal(sourceView(b,100).bounds.end,.5);
 const first=withLunaLinda(sourceMotionView(b,1.4),true,1.4);withLunaLinda(base,true,100);assert.deepEqual(withLunaLinda(sourceMotionView(b,1.4),true,1.4),first);
 assert.equal(b.coverage.end,new Date(Date.parse(b.coverage.start)+.5*3600000).toISOString());
});
test('Luna waits for a free visual turn when source movements cross its nominal arrival',()=>{
 const view={bounds:{start:0,end:2},motion:{movements:[{start:.8,end:1.4},{start:1.6,end:2.1}]}};
 assert.deepEqual(lunaLindaSchedule(view),{start:2.1,end:2.85,durationHours:.75,evidence:'hypothetical-visual-turn'});
 assert.equal(lunaLindaBounds(view).end,2.85);
});
