import test from 'node:test';
import assert from 'node:assert/strict';
import {motionPlan,sourceMotionView,sourceMotionExport} from '../src/source-motion.js';
import {sourceView} from '../src/replay.js';
function fixture(){
 const stamp=iso=>({earliest:iso,latest:iso,precision:'datetime'});
 return {id:'constructed',bundle_hash:'a'.repeat(64),coverage:{start:'2026-10-06T09:30:00Z',end:'2026-10-06T15:00:00Z'},inventory:[],observations:[
 {id:'in',name:'Incoming',terminal:'ADM',state:'reported-anchorage',in_scope:true},
 {id:'out',name:'Outgoing',terminal:'ADM',state:'reported-alongside',in_scope:true},
 {id:'stay',name:'Unplanned',terminal:'TBB 9',state:'reported-anchorage',in_scope:true},
 ],intentions:[{id:'arrival',name:'Incoming',terminal:'ADM',direction:'ENTRADA',tug_time:stamp('2026-10-06T15:00:00Z'),tugs:[]},{id:'departure',name:'Outgoing',terminal:'ADM',direction:'ZARPADA',tug_time:stamp('2026-10-06T11:30:00Z'),tugs:[]}]};
}
test('planned overlay preserves evidence, distinguishes assumed motion and extends only visual bounds',()=>{
 const b=fixture(),original=JSON.stringify(b),plan=motionPlan(b);
 assert.equal(plan.bounds.end,6.25);assert.equal(plan.movements.length,2);
 const before=sourceMotionView(b,1),during=sourceMotionView(b,2.25),after=sourceMotionView(b,6.25);
 assert.deepEqual(before.entities[1].pose,sourceView(b).entities[1].pose);
 assert.equal(during.entities[1].state,'illustrative-zarpada');assert.equal(during.entities[1].evidence,'assumed');
 assert.notDeepEqual(during.entities[1].pose,before.entities[1].pose);
 assert.equal(after.entities[1].pose,null);assert.equal(after.entities[0].state,'illustrative-alongside');
 assert.equal(after.entities[0].pose.x,-560);assert.deepEqual(after.entities[2].pose,before.entities[2].pose);
 assert.deepEqual(after.reportedEntities,sourceView(b).entities);assert.deepEqual(after.metrics,sourceView(b).metrics);
 assert.equal(JSON.stringify(b),original);
});
test('seeking backwards and repeating a time reconstructs identical positions',()=>{
 const b=fixture(),first=sourceMotionView(b,5.8);sourceMotionView(b,6.25);
 assert.deepEqual(sourceMotionView(b,5.8),first);assert.deepEqual(sourceMotionView(b,0).entities.map(e=>e.pose),sourceView(b).entities.map(e=>e.pose));
 assert.equal(sourceMotionView(b,100).time,6.25);
});
for(const [label,mutate] of [
 ['ambiguous linkage',b=>b.intentions.push({...b.intentions[0],id:'duplicate'})],
 ['uncertain time',b=>b.intentions[0].tug_time.latest='2026-10-06T15:30:00Z'],
 ['incompatible reported state',b=>b.observations[0].state='reported-alongside'],
 ['outside scene scope',b=>b.observations[0].in_scope=false],
])test(`skips ${label} without inventing motion`,()=>{const b=fixture();mutate(b);const p=motionPlan(b);assert.equal(p.movements.some(m=>m.entityId==='in'),false);assert.ok(p.skipped.length);});
test('export separates unchanged bundle from versioned illustrative assumptions',()=>{
 const b=fixture(),out=sourceMotionExport(b,9);assert.equal(out.bundle,b);assert.equal(out.format,'bahia-source-motion-v1');
 assert.equal(out.illustrativeOverlay.sourceBundleHash,b.bundle_hash);assert.equal(out.illustrativeOverlay.time,6.25);assert.equal(out.illustrativeOverlay.assumptions.length,5);
 assert.ok(out.illustrativeOverlay.movements.every(m=>m.status==='illustrative'&&m.startEvidence.startsWith('assumed')));
});
