import {sourceView} from './replay.js';
import {clampTime} from './view-state.js';

export const MOTION_VERSION = '1.1.0';
export const MOTION_DURATIONS = Object.freeze({ENTRADA:0.75,ZARPADA:0.5});
export const MOTION_ASSUMPTIONS = Object.freeze([
  'El origen de la animación usa el inicio de la agenda como referencia asumida; no es el corte de observación del informe.',
  'La hora prevista de remolcadores se usa como inicio ilustrativo de maniobra; no confirma salida ni atraque reales.',
  'Entrada ilustrativa: 45 minutos. Salida ilustrativa: 30 minutos. Rutas, posiciones y orientación son asumidas; la rada ilustrativa se separa del corredor de movimiento.',
  'Vínculos visuales por nombre exacto, terminal y estado compatible; no verifican identidad IMO ni ejecución.',
  'La posición después de la maniobra es un resultado visual supuesto, no una observación actual. No se simulan recursos ni seguridad de navegación.',
]);
const berthX = {'ADM':-560,'TBB 9':-230,'Cargill':100};

export function motionPlan(bundle){
  const report=sourceView(bundle),movements=[],skipped=[];
  for(const intention of bundle.intentions){
    const candidates=report.entities.filter(e=>e.name===intention.name&&e.details.terminal===intention.terminal);
    const t=intention.tug_time;
    const expected=intention.direction==='ENTRADA'?'reported-anchorage':'reported-alongside';
    let reason;
    if(candidates.length!==1)reason='Sin vínculo visual único dentro del alcance';
    else if(candidates[0].state!==expected||!candidates[0].pose||!Object.hasOwn(berthX,intention.terminal))reason='Posición publicada incompatible o terminal sin geometría';
    else if(!t||t.precision!=='datetime'||t.earliest!==t.latest||!Number.isFinite(Date.parse(t.earliest)))reason='Hora de remolcadores ausente o incierta';
    else if(bundle.intentions.filter(i=>i.name===intention.name&&i.terminal===intention.terminal).length!==1)reason='Más de una intención para el mismo vínculo; revisión necesaria';
    if(reason){skipped.push({intentionId:intention.id,name:intention.name,reason});continue;}
    const entity=candidates[0],start=(Date.parse(t.earliest)-report.origin)/3600000;
    const dock={x:berthX[intention.terminal],z:38,angle:0};
    movements.push({intentionId:intention.id,entityId:entity.id,name:entity.name,terminal:intention.terminal,direction:intention.direction,start,end:start+MOTION_DURATIONS[intention.direction],durationHours:MOTION_DURATIONS[intention.direction],startEvidence:'assumed-from-planned-tug-time',bindingEvidence:'assumed-exact-name-terminal-state',from:{...entity.pose},to:intention.direction==='ENTRADA'?dock:{x:2000,z:200,angle:0},status:'illustrative',tugs:[...intention.tugs]});
  }
  return {version:MOTION_VERSION,origin:report.origin,originEvidence:'assumed-agenda-reference',bounds:{start:0,end:Math.max(report.bounds.end,...movements.map(m=>m.end))},movements,skipped,assumptions:[...MOTION_ASSUMPTIONS]};
}

// Linear playback time over a curved illustrative path. Seek reconstructs poses
// directly, with no accumulated frame state and no mutation of source records.
function routePose(m,f){
  const a=m.from,d=m.to;
  const b=m.direction==='ENTRADA'?{x:a.x,z:200}:{x:a.x+180,z:200};
  const c=m.direction==='ENTRADA'?{x:d.x,z:200}:{x:1050,z:200};
  const u=1-f;
  const x=u*u*u*a.x+3*u*u*f*b.x+3*u*f*f*c.x+f*f*f*d.x;
  const z=u*u*u*a.z+3*u*u*f*b.z+3*u*f*f*c.z+f*f*f*d.z;
  const dx=3*u*u*(b.x-a.x)+6*u*f*(c.x-b.x)+3*f*f*(d.x-c.x);
  const dz=3*u*u*(b.z-a.z)+6*u*f*(c.z-b.z)+3*f*f*(d.z-c.z);
  return {x,z,angle:-Math.atan2(dz,dx),provenance:'assumed-planned-movement-path'};
}
export function sourceMotionView(bundle,time=0,selected=null){
  const plan=motionPlan(bundle),t=clampTime(time,plan.bounds);
  const view=sourceView(bundle,Math.min(t,sourceView(bundle).bounds.end),selected);
  const reportedEntities=view.entities;
  const entities=reportedEntities.map(entity=>{
    const m=plan.movements.find(m=>m.entityId===entity.id);
    if(!m||t<m.start)return {...entity,reportedState:entity.state};
    const active=t<m.end;
    return {...entity,reportedState:entity.state,state:active?'illustrative-'+m.direction.toLowerCase():m.direction==='ENTRADA'?'illustrative-alongside':'illustrative-offscene',evidence:'assumed',pose:active?routePose(m,(t-m.start)/(m.end-m.start)):m.direction==='ENTRADA'?{...m.to,provenance:'assumed-post-movement-placement'}:null,movement:m};
  });
  return {...view,datasetId:bundle.id+'-motion',time:t,bounds:plan.bounds,entities,reportedEntities,motion:plan};
}
export function sourceMotionExport(bundle,time=0){
  return {format:'bahia-source-motion-v1',bundle,illustrativeOverlay:{...motionPlan(bundle),sourceBundleHash:bundle.bundle_hash,time:clampTime(time,motionPlan(bundle).bounds)}};
}
