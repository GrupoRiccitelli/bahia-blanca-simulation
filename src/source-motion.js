import {sourceView} from './replay.js';
import {clampTime} from './view-state.js';
import {BERTH_X,TRANSIT_Z,dockPose,maneuverPose} from './geometry.js';

export const MOTION_VERSION = '1.2.0';
export const MOTION_DURATIONS = Object.freeze({ENTRADA:0.75,ZARPADA:0.5});
export const MOTION_ASSUMPTIONS = Object.freeze([
  'El origen de la animación usa el inicio de la agenda como referencia asumida; no es el corte de observación del informe.',
  'La hora prevista de remolcadores es una referencia publicada: la animación puede esperar un turno visual para separar maniobras; esos retrasos no son tiempos operativos reales.',
  'Entrada ilustrativa: 45 minutos. Salida ilustrativa: 30 minutos. Rutas, posiciones y orientación son asumidas; rada separada, giros en agua abierta y traslación lateral asistida paralela al muelle.',
  'Vínculos visuales por nombre exacto, terminal y estado compatible; no verifican identidad IMO ni ejecución.',
  'La posición después de la maniobra es un resultado visual supuesto, no una observación actual. No se simulan recursos ni seguridad de navegación.',
]);
const berthX = {'ADM':-560,'TBB 9':-230,'Cargill':100};

const planCache=new WeakMap();
export function motionPlan(bundle){
  if(planCache.has(bundle))return planCache.get(bundle);
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
    const dock=dockPose(BERTH_X.indexOf(berthX[intention.terminal]),entity);
    movements.push({intentionId:intention.id,entityId:entity.id,name:entity.name,terminal:intention.terminal,direction:intention.direction,plannedStart:start,start,end:start+MOTION_DURATIONS[intention.direction],durationHours:MOTION_DURATIONS[intention.direction],startEvidence:'assumed-from-planned-tug-time',bindingEvidence:'assumed-exact-name-terminal-state',from:{...entity.pose},to:intention.direction==='ENTRADA'?dock:{x:2000,z:TRANSIT_Z,angle:0},status:'illustrative',tugs:[...intention.tugs]});
  }
  let visualReady=0;
  for(const m of [...movements].sort((a,b)=>a.plannedStart-b.plannedStart||(a.direction==='ZARPADA'?-1:1)-(b.direction==='ZARPADA'?-1:1)||a.intentionId.localeCompare(b.intentionId))){
    m.start=Math.max(m.plannedStart,visualReady);m.end=m.start+m.durationHours;m.delayHours=m.start-m.plannedStart;
    m.startEvidence=m.delayHours?'assumed-visual-hold-after-planned-tug-time':m.startEvidence;visualReady=m.end;
  }
  const plan={version:MOTION_VERSION,origin:report.origin,originEvidence:'assumed-agenda-reference',bounds:{start:0,end:Math.max(report.bounds.end,...movements.map(m=>m.end))},movements,skipped,assumptions:[...MOTION_ASSUMPTIONS]};
  planCache.set(bundle,plan);return plan;
}
export function sourceMotionBounds(bundle){return motionPlan(bundle).bounds;}

// Smooth schematic route segments. Seek reconstructs poses
// directly, with no accumulated frame state and no mutation of source records.
function routePose(m,f,entity){return {...maneuverPose(m.from,m.to,m.direction,f,entity),provenance:'assumed-planned-movement-path'};}
export function sourceMotionView(bundle,time=0,selected=null){
  const plan=motionPlan(bundle),t=clampTime(time,plan.bounds);
  const view=sourceView(bundle,t,selected);
  const reportedEntities=view.entities;
  const entities=reportedEntities.map(entity=>{
    const m=plan.movements.find(m=>m.entityId===entity.id);
    if(!m||t<m.start)return {...entity,reportedState:entity.state};
    const active=t<m.end;
    return {...entity,reportedState:entity.state,state:active?'illustrative-'+m.direction.toLowerCase():m.direction==='ENTRADA'?'illustrative-alongside':'illustrative-offscene',evidence:'assumed',pose:active?routePose(m,(t-m.start)/(m.end-m.start),entity):m.direction==='ENTRADA'?{...m.to,provenance:'assumed-post-movement-placement'}:null,movement:m};
  });
  return {...view,datasetId:bundle.id+'-motion',time:t,bounds:plan.bounds,entities,reportedEntities,motion:plan};
}
export function sourceMotionExport(bundle,time=0){
  return {format:'bahia-source-motion-v1',bundle,illustrativeOverlay:{...motionPlan(bundle),sourceBundleHash:bundle.bundle_hash,time:clampTime(time,motionPlan(bundle).bounds)}};
}
