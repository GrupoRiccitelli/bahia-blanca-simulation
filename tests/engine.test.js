import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario, simulate, stateAt } from '../src/engine.js';
const overlaps=(a,b)=>a.start<b.end&&b.start<a.end;
test('a hand-worked call reserves berth and tug through departure and turnaround',()=>{
  const s=createScenario(); s.calls=[{id:0,name:'Test',arrival:0,handling:2,length:180,preferredBerth:0}]; s.background=[];
  const r=simulate(s),j=r.jobs[0];
  assert.equal(j.inboundStart,0); assert.equal(j.inboundEnd,1); assert.equal(j.handlingEnd,3); assert.equal(j.outboundEnd,3.75);
  assert.equal(r.metrics.averageWait,0); assert.equal(r.metrics.averageTurnaround,3.75);
  assert.equal(r.berthReservations[0].end,3.75); assert.equal(r.tugDuties[1].end,4.25);
  assert.equal(stateAt(j,2),'handling'); assert.equal(stateAt(j,3.75),'completed');
});
for(const mode of ['normal','delay','tug','berth']) test(`${mode}: deterministic run respects shared resources and unavailable windows`,()=>{
  const s=createScenario(mode),r=simulate(s); assert.deepEqual(r,simulate(s)); assert.equal(r.metrics.completed,10);
  for(const list of [r.movements,...s.tugs.map((_,i)=>r.tugDuties.filter(x=>x.tug===i)),...s.berths.map((_,i)=>r.berthReservations.filter(x=>x.berth===i))])
    for(let i=0;i<list.length;i++)for(let k=i+1;k<list.length;k++)assert.ok(!overlaps(list[i],list[k]));
  for(const m of r.movements){
    for(const [start,end] of s.background)assert.ok(!overlaps(m,{start,end}));
    assert.equal(m.tugs.length,s.calls[m.vessel].length>=220?2:1);
  }
  if(s.tugOutage)for(const d of r.tugDuties.filter(d=>d.tug===s.tugOutage.tug))assert.ok(!overlaps(d,s.tugOutage));
  if(s.berthClosure)for(const j of r.jobs.filter(j=>j.berth===s.berthClosure.berth))assert.ok(j.inboundStart<s.berthClosure.start||j.inboundStart>=s.berthClosure.end);
});
test('outside traffic delays inbound and a closure does not interrupt existing handling',()=>{
  const s=createScenario(); s.calls=[{id:0,name:'Test',arrival:0,handling:6,length:180,preferredBerth:0}]; s.background=[[0,2]]; s.berthClosure={berth:0,start:3,end:8};
  const r=simulate(s); assert.equal(r.jobs[0].inboundStart,2); assert.equal(r.jobs[0].handlingEnd,9);
});
test('horizon retains unresolved jobs and accumulated wait instead of inventing completions',()=>{
  const s=createScenario();s.horizon=0.5; const r=simulate(s);
  assert.equal(r.metrics.completed,0);assert.equal(r.metrics.unfinished,1);assert.equal(r.metrics.averageTurnaround,null);assert.equal(stateAt(r.jobs[0],0.5),'inbound');
  s.background=[[0,2]]; const blocked=simulate(s);assert.equal(blocked.metrics.totalWait,0.5);assert.equal(blocked.jobs[0].inboundStart,null);
});
