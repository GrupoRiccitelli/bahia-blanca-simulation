import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as engine from '../src/engine.js';
import * as replay from '../src/replay.js';
import * as motion from '../src/source-motion.js';
import * as synthetic from '../src/synthetic-adapter.js';
import * as luna from '../src/luna-linda.js';
import { loadBundle } from '../src/source-data.js';

// Execute the production event handlers and render functions with a minimal DOM
// and scene boundary. This verifies logic/DOM identity, not browser layout/WebGL.
class Element {
 constructor(tag='div',owner){this.tagName=tag;this.owner=owner;this.children=[];this.dataset={};this.style={};this.listeners={};this.attrs={};this.hidden=false;this.value='';this._text='';this.className='';this.classes=new Set();this.classList={add:(v)=>this.classes.add(v),toggle:(v,on)=>on===false?this.classes.delete(v):this.classes.add(v)};}
 set textContent(value){this._text=String(value);this.children=[];}
 get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
 set innerHTML(value){this._text=String(value);this.children=[];}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
 prepend(...nodes){for(const node of nodes)node.parent=this;this.children.unshift(...nodes);}
 replaceChildren(...nodes){for(const node of this.children)node.parent=null;this._text='';this.children=[];this.append(...nodes);}
 remove(){this.parent?.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}
 setAttribute(key,value){this.attrs[key]=value;}
 addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
 async emit(type,event={}){for(const listener of this.listeners[type]??[])await listener({target:this,...event});}
 focus(){this.owner.activeElement=this;}
}
function constructed(id='test',hours=0.5){
 return {schema_version:'1.0',scenario_kind:'published_snapshot',id,report_date:'2026-10-06',bundle_hash:'a'.repeat(64),review:{status:'reviewed'},coverage:{start:'2026-10-06T09:30:00Z',end:new Date(Date.parse('2026-10-06T09:30:00Z')+hours*3600000).toISOString(),observation_cutoff:null},sources:['position','vts'].map(id=>({id,status:'verified',sha256:'b'.repeat(64),retrieved_at:'2026-10-06T12:00:00Z'})),assertions:[],observations:[{id:'unknown',name:'Unknown location',vessel_id:'unknown-hull',state:'unknown',terminal:null,in_scope:true,assertion_ids:[]},{id:'alpha',name:'Alpha',vessel_id:'alpha-hull',state:'reported-anchorage',terminal:'ADM',in_scope:true,length_m:138,beam_m:26,assertion_ids:[]}],intentions:[],inventory:[],metric_eligibility:{reported_count:true,plan_count:true,coverage:true},assumptions:[],unresolved_issues:[]};
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function harness(loader=loadBundle){
 const ids=new Map(),selectors=new Map(),document={hidden:false,activeElement:null,listeners:{}};
 document.createElement=tag=>new Element(tag,document);
 document.getElementById=id=>{if(!ids.has(id))ids.set(id,new Element('div',document));return ids.get(id);};
 document.querySelector=selector=>{if(selector.startsWith('#'))return document.getElementById(selector.slice(1));if(!selectors.has(selector))selectors.set(selector,new Element('div',document));return selectors.get(selector);};
 document.querySelectorAll=selector=>selector==='.plan-marker'?all().filter(el=>el.className==='plan-marker'):[];
 document.addEventListener=(type,listener)=>(document.listeners[type]??=[]).push(listener);
 const all=()=>{const output=[];const visit=node=>{output.push(node);for(const child of node.children)visit(child);};for(const node of ids.values())visit(node);return output;};
 document.getElementById('speed').value='2';
 const window=new Element(),frames=[],updates=[];let disposals=0;
 const context=vm.createContext({document,window,matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>frames.push(fn),AbortController,console,Date,URL,Blob,setTimeout,createPortScene:()=>({update:view=>updates.push(view),dispose:()=>disposals++,home:()=>{}}),...engine,...replay,...motion,...synthetic,...luna,loadBundle:loader});
 const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInContext(source+'\nglobalThis.appTest={activateSource,renderFrame,select,getState:()=>({bundle,time,playing,lunaEnabled,datasetRequest})};',context);
 return {app:context.appTest,$:id=>document.getElementById(id),document,window,frames,updates,all,disposals:()=>disposals};
}
async function seek(ui,hour){ui.$('scrub').value=hour;await ui.$('scrub').emit('input');}

test('selected evidence disclosure, focus and scroll remain stable across playback/seek/motion toggles',async()=>{
 const ui=harness();await ui.app.activateSource(constructed('long',4));ui.app.select('alpha');
 const disclosure=ui.all().find(el=>el.className==='selected-provenance'),summary=disclosure.children[0];
 disclosure.open=true;disclosure.scrollTop=27;summary.focus();const fields=[...ui.$('ship-details').children];
 await ui.$('play').emit('click');ui.frames.shift()(0);ui.frames.shift()(1000);await seek(ui,3);await seek(ui,0);
 ui.$('animate-source').checked=false;await ui.$('animate-source').emit('change');
 assert.equal(ui.all().find(el=>el.className==='selected-provenance'),disclosure);assert.equal(disclosure.open,true);assert.equal(disclosure.scrollTop,27);assert.equal(ui.document.activeElement,summary);assert.deepEqual(ui.$('ship-details').children,fields);
});

test('observation board labels unknown location explicitly and uses safe text nodes',async()=>{
 const ui=harness(),value=constructed();value.observations[0].name='<script>unknown</script>';await ui.app.activateSource(value);
 const button=ui.all().find(el=>el.tagName==='button'&&el.textContent.includes('<script>unknown</script>'));
 assert.match(button.textContent,/Ubicación desconocida/);assert.doesNotMatch(button.textContent,/Rada publicada/);
 await button.emit('click');assert.equal(ui.$('ship-state').textContent,'Ubicación desconocida');assert.equal(ui.updates.at(-1).entities.find(entity=>entity.id==='unknown').pose,null);
});

test('synthetic choice supersedes delayed local file success and failure',async()=>{
 for(const fail of [false,true]){const pending=deferred(),ui=harness();ui.$('source-file').files=[{text:()=>pending.promise}];const loading=ui.$('source-file').emit('change');await ui.$('synthetic-mode').emit('click');
 if(fail)pending.reject(new Error('old failure'));else pending.resolve(JSON.stringify(constructed()));await loading;
 assert.equal(ui.app.getState().bundle,null);assert.equal(ui.$('load-status').textContent,'Demostración sintética activa.');}
});

test('two overlapping file imports apply the latest choice, including stale error suppression',async()=>{
 const a=deferred(),b=deferred(),ui=harness();const first=ui.app.activateSource({text:()=>a.promise}),second=ui.app.activateSource({text:()=>b.promise});
 b.resolve(JSON.stringify(constructed('latest')));await second;a.reject(new Error('stale failure'));await first;
 assert.equal(ui.app.getState().bundle.id,'latest');assert.match(ui.$('load-status').textContent,/latest/);
 const old=deferred(),recent=deferred();const loadOld=ui.app.activateSource({text:()=>old.promise}),loadRecent=ui.app.activateSource({text:()=>recent.promise});recent.resolve(JSON.stringify(constructed('newest')));await loadRecent;old.resolve(JSON.stringify(constructed('oldest')));await loadOld;
 assert.equal(ui.app.getState().bundle.id,'newest');assert.match(ui.$('load-status').textContent,/newest/);
});

test('Luna requires imported evidence and never fetches an absent deployment file',async()=>{
 let loads=0;const ui=harness(async input=>{loads++;return input;});
 assert.equal(ui.$('luna-linda').disabled,true);
 await ui.$('luna-linda').emit('click');assert.equal(loads,0);assert.match(ui.$('load-status').textContent,/Importá un informe JSON/);
 await ui.app.activateSource(constructed());assert.equal(ui.$('luna-linda').disabled,false);assert.equal(ui.$('luna-requirement').hidden,true);
 await ui.$('luna-linda').emit('click');assert.equal(ui.app.getState().lunaEnabled,true);assert.equal(loads,1);
 await ui.$('synthetic-mode').emit('click');assert.equal(ui.$('luna-linda').disabled,true);assert.equal(ui.$('luna-requirement').hidden,false);
});

test('Luna add/remove extends only illustrative playback, clamps slider and preserves evidence coverage',async()=>{
 const ui=harness(),value=constructed();await ui.app.activateSource(value);const before=JSON.stringify(value);assert.equal(Number(ui.$('scrub').max),0.5);
 await ui.$('luna-linda').emit('click');assert.equal(Number(ui.$('scrub').max),1.75);await seek(ui,1.75);
 assert.equal(ui.updates.at(-1).time,1.75);assert.equal(ui.updates.at(-1).entities.find(entity=>entity.id===luna.LUNA_LINDA.id).state,'illustrative-alongside');
 await ui.$('luna-linda').emit('click');assert.equal(Number(ui.$('scrub').max),0.5);assert.equal(ui.app.getState().time,0.5);assert.equal(Number(ui.$('scrub').value),0.5);assert.equal(JSON.stringify(value),before);
 await ui.$('luna-linda').emit('click');ui.$('animate-source').checked=false;await ui.$('animate-source').emit('change');assert.equal(Number(ui.$('scrub').max),0.5);
});

test('persisted pagehide preserves cached scene and a later final pagehide disposes it',async()=>{
 const ui=harness();await ui.window.emit('pagehide',{persisted:true});assert.equal(ui.disposals(),0);await ui.window.emit('pageshow',{persisted:true});await ui.window.emit('pagehide',{persisted:false});assert.equal(ui.disposals(),1);
});

test('visual holds are disclosed while published markers and selected provenance remain stable',async()=>{
 const value=constructed('held-plan',1.5),stamp=hour=>{const iso=new Date(Date.parse(value.coverage.start)+hour*3600000).toISOString();return {original:iso,earliest:iso,latest:iso,precision:'datetime',timezone:'America/Argentina/Buenos_Aires',timezone_evidence:'assumed'};};
 value.observations.push({...value.observations[1],id:'beta',vessel_id:'beta-hull',name:'Beta',terminal:'TBB 9'});
 value.intentions=[{id:'plan-alpha',name:'Alpha',direction:'ENTRADA',terminal:'ADM',pilot_time:null,tug_time:stamp(1),tugs:[],assertion_ids:[]},{id:'plan-beta',name:'Beta',direction:'ENTRADA',terminal:'TBB 9',pilot_time:null,tug_time:stamp(1.25),tugs:[],assertion_ids:[]}];
 const original=JSON.stringify(value),ui=harness();await ui.app.activateSource(value);ui.app.select('beta');
 const disclosure=ui.all().find(el=>el.className==='selected-provenance');disclosure.open=true;disclosure.children[0].focus();
 assert.match(ui.$('ship-details').textContent,/espera visual 30,0 min tras el horario previsto/);assert.match(ui.$('timeline').textContent,/espera visual de 30,0 min/);
 await seek(ui,2);await seek(ui,0);ui.$('animate-source').checked=false;await ui.$('animate-source').emit('change');assert.equal(ui.all().find(el=>el.className==='selected-provenance'),disclosure);assert.equal(disclosure.open,true);assert.equal(ui.document.activeElement,disclosure.children[0]);
 ui.$('animate-source').checked=true;await ui.$('animate-source').emit('change');assert.equal(ui.all().find(el=>el.className==='selected-provenance'),disclosure);
 await ui.$('luna-linda').emit('click');assert.equal(Number(ui.$('scrub').max),3.25);assert.match(ui.$('timeline').textContent,/turno visual desde hora 2,5/);await seek(ui,3.25);assert.equal(ui.updates.at(-1).entities.find(entity=>entity.id===luna.LUNA_LINDA.id).state,'illustrative-alongside');await ui.$('luna-linda').emit('click');assert.equal(ui.app.getState().time,2.5);assert.equal(JSON.stringify(value),original);
});
