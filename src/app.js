import { createPortScene } from './port3d.js';
import { createScenario, simulate, stateAt, MODES } from './engine.js';
import {loadBundle} from './source-data.js';
import {sourceView,sourceExport} from './replay.js';
import {sourceMotionView,sourceMotionExport,motionPlan,sourceMotionBounds} from './source-motion.js';
import {syntheticView} from './synthetic-adapter.js';
import {LUNA_LINDA,withLunaLinda,lunaLindaBounds,lunaLindaSchedule} from './luna-linda.js';
let lunaEnabled=false;
let bundle=null;
let datasetRequest=0,loadController=null;
let playbackEnd=48,detailsBundle=null,detailsSelection=null,movementDetail=null;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let motionEnabled=!reduceMotion;
const $ = id => document.getElementById(id);
let mode='normal',run=simulate(createScenario()),baseline=simulate(createScenario()),time=0,selected=0,playing=false,lastFrame=null;
const format=n=>n.toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1});
const labels={expected:'Por llegar',waiting:'En rada, esperando recursos',inbound:'En maniobra de entrada',handling:'Operando en el muelle',departure_wait:'Listo, esperando salida',outbound:'En maniobra de salida',completed:'Operación completada'};
const eventLabels={arrival:'Llegó a la rada',inbound:'Inició la entrada',handling:'Comenzó la carga',ready:'Terminó la carga',outbound:'Inició la salida',completed:'Salió del puerto'};
const notes={normal:'Sin cambios en los recursos',delay:'Estuario llega 6 horas más tarde',tug:'R3 no disponible entre las horas 2 y 18',berth:'Sin nuevas entradas a TBB 9 entre las horas 4 y 16'};
let port;
try { port=createPortScene($('scene'),id=>select(id)); } catch(error) { $('scene').classList.add('scene-failed'); $('scene').textContent='No se pudo iniciar la vista 3D. La agenda y la simulación siguen disponibles.'; console.error(error); }
$('camera-home').addEventListener('click',()=>port?.home());
$('modes').innerHTML=Object.entries(MODES).map(([key,label])=>`<button class="mode ${key==='normal'?'active':''}" data-mode="${key}" aria-pressed="${key==='normal'}"><strong>${label}</strong><small>${notes[key]}</small></button>`).join('');
function renderMetrics(){
  if(bundle){renderSourceMetrics();return;}
  const m=run.metrics,b=baseline.metrics;
  const delta=(value,base,unit)=>{const d=value-base;return mode==='normal'?'Referencia para comparar':Math.abs(d)<0.05?'Sin cambio frente a normal':`${d>0?'+':''}${format(d)} ${unit} frente a normal`;};
  $('comparison-label').textContent=MODES[mode];
  $('policy-note').textContent=mode==='normal' ? 'La operación normal sirve de referencia. El orden de despacho sigue una regla simple de prioridad de salida.' : 'Un cambio también puede reducir alguna espera al alterar el orden de despacho. Este modelo usa una regla simple, sin optimizar la agenda. Remolcadores ocupados: '+Math.round(m.tugUtilization*100)+' % del tiempo disponible.';
  $('metrics').innerHTML=[['Espera media de entrada',`${format(m.averageWait)} h`,delta(m.averageWait,b.averageWait,'h'),m.averageWait>b.averageWait+.05],['Buques completados',`${m.completed} / ${run.jobs.length}`,`${m.unfinished} sin completar al final`,false],['Ocupación de muelles',`${Math.round(m.berthUtilization*100)} %`,delta(m.berthUtilization*100,b.berthUtilization*100,'puntos'),false],['Turnaround medio',`${format(m.averageTurnaround??0)} h`,delta(m.averageTurnaround??0,b.averageTurnaround??0,'h'),(m.averageTurnaround??0)>(b.averageTurnaround??0)+.05]].map(([label,value,note,worse])=>`<div class="metric"><span class="metric-label">${label}</span><strong>${value}</strong><small class="${worse?'worse':''}">${note}</small></div>`).join('');
}
function renderTimeline(){
  if(bundle){renderSourceTimeline();return;}
  $('timeline').innerHTML='<div class="timeline-top"><span>Buque</span><div class="timeline-hours">'+[0,8,16,24,32,40,48].map(x=>`<span>${x} h</span>`).join('')+'</div></div>'+run.jobs.map(j=>{
    const end=run.scenario.horizon, segments=[['waiting',j.arrival,j.inboundStart??end],['transit',j.inboundStart,j.inboundEnd],['handling',j.inboundEnd,j.handlingEnd],['departure_wait',j.handlingEnd,j.outboundStart??end],['transit',j.outboundStart,j.outboundEnd]];
    return `<div class="timeline-row ${j.id===selected?'selected':''}" data-vessel="${j.id}"><button class="vessel-name" aria-label="Seguir ${j.name}">${j.name}</button><div class="lane" aria-label="${j.name}: entrada ${format(j.inboundStart??end)} horas, salida ${format(j.outboundEnd??end)} horas">${segments.filter(([,a,b])=>a!==null&&b!==null&&b>a).map(([type,a,b])=>`<span class="segment ${type}" title="${type==='transit'?'Maniobra':type==='handling'?'Carga':type==='waiting'?'Espera de entrada':'Espera de salida'}: ${format(a)}–${format(b)} h" style="left:${a/end*100}%;width:${(Math.min(end,b)-a)/end*100}%"></span>`).join('')}<i class="lane-cursor" style="left:${time/end*100}%"></i></div></div>`;
  }).join('');
}
function renderFrame(){
  if(bundle){renderSourceFrame();return;}
  const instant=new Date(Date.parse(run.scenario.startsAt)+time*3600000);
  $('clock').textContent=instant.toLocaleTimeString('es-AR',{timeZone:run.scenario.timezone,hour:'2-digit',minute:'2-digit',hour12:false});
  $('date').textContent=instant.toLocaleDateString('es-AR',{timeZone:run.scenario.timezone,day:'numeric',month:'short',year:'numeric'});
  $('elapsed').textContent=`Hora ${format(time)} de 48`;
  $('scrub').value=time;
  port?.update(syntheticView(run,time,String(selected)));
  const background=run.scenario.background.some(([a,b])=>time>=a&&time<b);
  const last=run.events.filter(e=>e.time<=time).at(-1);
  $('scene-activity').textContent=background?'Canal reservado para tráfico de otros terminales':last?`${run.jobs.find(j=>j.id===last.vessel).name}: ${eventLabels[last.type]}`:'Inicio del escenario';
  const job=run.jobs.find(j=>j.id===selected);
  $('ship-name').textContent=job.name;$('ship-state').textContent=labels[stateAt(job,time)];
  $('ship-details').innerHTML=[['Eslora',`${job.length} m`],['Carga',job.cargo],['Muelle asignado',job.berth===null?'Pendiente':run.scenario.berths[job.berth]],['Llegada prevista',`Hora ${format(job.arrival)}`],['Espera de entrada',`${format((job.inboundStart??48)-job.arrival)} h`],['Remolcadores necesarios',job.length>=220?'2':'1']].map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');
  document.querySelectorAll('.lane-cursor').forEach(el=>el.style.left=`${time/48*100}%`);
}
function select(id){selected=bundle?String(id):Number(id);renderTimeline();renderFrame();}
$('modes').addEventListener('click',e=>{const button=e.target.closest('[data-mode]');if(!button)return;beginDatasetRequest();mode=button.dataset.mode;run=simulate(createScenario(mode));playing=false;time=0;lastFrame=null;updatePlay();document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',b.dataset.mode===mode)});renderMetrics();renderTimeline();renderFrame();});

$('timeline').addEventListener('click',e=>{const el=e.target.closest('[data-vessel]');if(el)select(el.dataset.vessel)});
function updatePlay(){$('play').textContent=playing?'Ⅱ Pausar':bundle?(motionEnabled?'▶ Animar movimientos':'▶ Recorrer hitos'):'▶ Reproducir';$('play').setAttribute('aria-label',playing?'Pausar reproducción':bundle?(motionEnabled?'Animar movimientos ilustrativos':'Recorrer hitos planificados'):'Reproducir simulación')}
$('play').addEventListener('click',()=>{if(time>=horizon())time=0;playing=!playing;lastFrame=null;updatePlay();renderFrame()});
$('reset').addEventListener('click',()=>{time=0;playing=false;lastFrame=null;updatePlay();renderFrame()});
$('scrub').addEventListener('input',e=>{time=Math.max(0,Math.min(horizon(),Number(e.target.value)));lastFrame=null;renderFrame()});
$('export').addEventListener('click',()=>{
  const data=bundle?(motionEnabled?sourceMotionExport(bundle,time):sourceExport(bundle)):{format:'bahia-demo-run-v1',evidence:'illustrative assumptions',baseline,selectedRun:run};
  if(bundle&&lunaEnabled)data.hypotheticalAdditionalVessels=sourceDisplay().additionalVessels;
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=bundle?`bahia-blanca-${motionEnabled?'movimientos-ilustrativos':'evidencia'}.json`:`bahia-blanca-${mode}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.addEventListener('visibilitychange',()=>{lastFrame=null});
function frame(now){if(playing&&!document.hidden){if(lastFrame!==null)time=Math.min(horizon(),time+(now-lastFrame)/1000*Number($('speed').value));lastFrame=now;if(time>=horizon()){playing=false;updatePlay()}renderFrame()}requestAnimationFrame(frame)}
renderMetrics();renderTimeline();renderFrame();requestAnimationFrame(frame);

window.addEventListener('pagehide',event=>{lastFrame=null;if(!event.persisted)port?.dispose();});
window.addEventListener('pageshow',()=>{lastFrame=null;});

function sourceDisplay(){const view=motionEnabled?sourceMotionView(bundle,time,selected):sourceView(bundle,time,selected);const result=lunaEnabled?withLunaLinda(view,motionEnabled,time):view;if(lunaEnabled&&selected===LUNA_LINDA.id)result.selected=LUNA_LINDA.id;return result;}
function horizon(){return playbackEnd;}
function refreshBounds(){
 const sourceEnd=bundle?(Date.parse(bundle.coverage.end)-Date.parse(bundle.coverage.start))/3600000:48;
 const bounds={start:0,end:sourceEnd},view=bundle&&motionEnabled?{bounds:sourceMotionBounds(bundle),motion:motionPlan(bundle)}:{bounds};
 playbackEnd=bundle&&lunaEnabled?lunaLindaBounds(view,motionEnabled).end:view.bounds.end;
 time=Math.max(0,Math.min(time,playbackEnd));$('scrub').max=playbackEnd;
}
function node(tag,text,className){const el=document.createElement(tag);if(text!=null)el.textContent=String(text);if(className)el.className=className;return el;}
function listDetails(items){$('ship-details').replaceChildren(...items.flatMap(([k,v])=>[node('dt',k),node('dd',v??'No disponible')]));}
function sourceTime(t){return t?.original??'No disponible';}
function renderSourceMetrics(){
 const view=sourceView(bundle),counts={};for(const row of bundle.inventory)counts[row.disposition]=(counts[row.disposition]??0)+1;
 $('comparison-label').textContent='Evidencia publicada';$('metrics').replaceChildren(...[
 ['Filas de posiciones',view.metrics.reported_count,`${view.entities.length} dentro del alcance 3D`],['Intenciones VTS',view.metrics.plan_count,'Cada fila conserva sus hitos separados'],['Filas inventariadas',view.metrics.coverage,Object.entries(counts).map(([k,v])=>`${({'parsed':'Interpretadas','retained-unparsed':'Contexto conservado','excluded-with-reason':'Excluidas con motivo'})[k]??k}: ${v}`).join(' · ')],['Espera / utilización','No disponible','Faltan intervalos reales confirmados']
 ].map(([label,value,note])=>{const el=node('div',null,'metric');el.append(node('span',label,'metric-label'),node('strong',value),node('small',note));return el;}));
 $('policy-note').textContent='El reloj recorre intenciones publicadas. Las posiciones del informe no cambian ni confirman movimientos. Zona horaria Argentina interpretada como supuesto.';
}
function renderSourceTimeline(){
 $('timeline').replaceChildren();
 if(lunaEnabled){const schedule=lunaLindaSchedule({motion:motionEnabled?motionPlan(bundle):null});const row=node('div',null,'source-plan-row'),follow=node('button','Seguir LUNA LINDA (hipotético)');follow.addEventListener('click',()=>select(LUNA_LINDA.id));row.append(follow,node('span',`Escala agregada por el usuario · sin intención VTS publicada · turno visual desde hora ${format(schedule.start)} y entrada 45 min asumidos${schedule.start>1?'; espera visual para separar maniobras':''}${motionEnabled?'':' · animación desactivada'}`));$('timeline').replaceChildren(row);}
 const view=sourceView(bundle,time,selected),plan=motionEnabled?motionPlan(bundle):null;
 for(const row of view.timeline){const el=node('div',null,'source-plan-row');el.append(node('strong',row.name),node('span',`${row.details.direction} · ${row.details.terminal}`));
 for(const marker of row.markers){const m=node('span',`${marker.type==='planned_pilot_time'?'Práctico':'Remolcadores'}: ${sourceTime(marker.time)} · planificado`,'plan-marker');m.dataset.at=marker.at??'';m.dataset.end=marker.end??'';el.append(m);}
 const movement=plan?.movements.find(m=>m.intentionId===row.id);if(movement){const follow=node('button',`Seguir ${row.name}`);follow.addEventListener('click',()=>select(movement.entityId));el.append(follow,node('span',`Animación: ${movement.durationHours*60} min asumidos · turno visual desde hora ${format(movement.start)}${movement.delayHours>0?`; espera visual de ${format(movement.delayHours*60)} min tras la hora prevista de remolcadores`:''}`));}
 el.append(node('span',`Asignaciones publicadas: ${(row.details.tugs??[]).join(', ')||'No disponible'}`));$('timeline').append(el);}
}
function renderSourceFrame(){
 const view=sourceDisplay();selected=view.selected;const instant=new Date(view.origin+view.time*3600000);
 $('clock').textContent=instant.toLocaleTimeString('es-AR',{timeZone:view.timezone,hour:'2-digit',minute:'2-digit',hour12:false});$('date').textContent=instant.toLocaleDateString('es-AR',{timeZone:view.timezone});$('elapsed').textContent=`${motionEnabled?'Animación':'Hitos'}: ${format(view.time)} / ${format(view.bounds.end)} h`;$('scrub').value=view.time;
 $('scene-activity').textContent=motionEnabled?'Movimiento ilustrativo según planes · rutas y duraciones asumidas · sin confirmación real':`Posiciones publicadas · ${bundle.report_date} · hora de observación desconocida. Ubicaciones ilustrativas, independientes del reloj.`;port?.update(view);
 const entity=view.entities.find(e=>e.id===selected);$('ship-name').textContent=entity?.name??'Sin posición dentro del alcance';
 $('ship-state').textContent=sourceStateLabel(entity?.state);
 if(entity?.details.hypothetical)$('ship-state').textContent='Escala hipotética · '+$('ship-state').textContent;
 renderSelectedSourceDetails(entity,view);
 document.querySelectorAll('.plan-marker').forEach(m=>{const at=m.dataset.at===''?null:Number(m.dataset.at),end=m.dataset.end===''?at:Number(m.dataset.end);m.classList.toggle('highlighted',at!==null&&view.time>=at&&view.time<=(end??at)+.05);});
}
const sourceStateLabels={
 'reported-alongside':{board:'Al costado publicado',detail:'Publicado al costado del muelle (sin estado de carga inferido)'},
 'reported-anchorage':{board:'Rada publicada',detail:'Publicado en rada'},
 unknown:{board:'Ubicación desconocida',detail:'Ubicación desconocida'},
 'illustrative-hypothetical-anchorage':{detail:'Rada hipotética · sin posición AIS confirmada'},
 'illustrative-entrada':{detail:'Entrada ilustrativa · no confirmada'},
 'illustrative-zarpada':{detail:'Salida ilustrativa · no confirmada'},
 'illustrative-alongside':{detail:'Al costado supuesto después de entrada'},
 'illustrative-offscene':{detail:'Fuera de escena tras salida supuesta · posición real desconocida'},
};
function sourceStateLabel(state,variant='detail'){return sourceStateLabels[state]?.[variant]??sourceStateLabels.unknown[variant];}
function renderSelectedSourceDetails(entity,view){
 const d=entity?.details??{};
 // Evidence fields and their disclosure are stable throughout playback. Only a
 // dataset/selection change replaces them; movement metadata is updated in place.
 if(detailsBundle!==bundle||detailsSelection!==selected){
  detailsBundle=bundle;detailsSelection=selected;movementDetail=null;
  listDetails(d.hypothetical?[
   ['IMO (ficha pública)',LUNA_LINDA.imo],['Tipo de buque',LUNA_LINDA.type],['Dimensiones (ficha pública)','138 × 26 m'],['Ubicación','Rada y muelle hipotéticos · no posición AIS'],['Horario supuesto','Primer turno visual libre desde hora 1 · entrada de 45 min; esperas ilustrativas para separar maniobras'],['Carga / recursos','No modelados'],['Fuente',LUNA_LINDA.source],['Identidad del enlace','Coincidencia por nombre; shipid de MarineTraffic sin verificar'],['Supuestos',LUNA_LINDA.assumptions.join(' ')],
  ]:[['Terminal',d.terminal],['Eslora',d.length_m==null?'No disponible · casco genérico ilustrativo':`${d.length_m} m`],['Manga',d.beam_m==null?'No disponible · proporción visual asumida':`${d.beam_m} m`],['Carga',d.cargo],['Tonelaje publicado',d.tonnage],['Llegada publicada',sourceTime(d.arrival_time)],['Procedencia',`Informe ${bundle.report_date} · ${(d.assertion_ids??[]).length} campos documentados; detalle completo en Fuentes y afirmaciones.`]]);
  if(entity){const provenance=node('details',null,'selected-provenance');provenance.append(node('summary','Ver procedencia por campo'));for(const id of d.assertion_ids??[]){const a=bundle.assertions.find(item=>item.id===id);if(a)provenance.append(node('p',`${a.field??a.event_type??id}: ${a.source_id} · página ${a.page??'?'} · fila ${a.row??a.row_reference??'?'}`));}const provenanceRow=node('dd');provenanceRow.append(provenance);$('ship-details').append(node('dt','Detalle de fuentes'),provenanceRow);}
 }
 const m=view.motion?.movements.find(item=>item.entityId===entity?.id)??entity?.movement;
 if(m){
  if(!movementDetail){movementDetail={label:node('dt','Movimiento ilustrativo'),value:node('dd')};$('ship-details').append(movementDetail.label,movementDetail.value);}
  const text=`${m.direction??'ENTRADA hipotética'} · inicio visual ${new Date(view.origin+m.start*3600000).toLocaleTimeString('es-AR',{timeZone:view.timezone,hour:'2-digit',minute:'2-digit'})} · duración asumida ${m.durationHours*60} min${m.delayHours>0?` · espera visual ${format(m.delayHours*60)} min tras el horario previsto`:''}`;
  if(movementDetail.value.textContent!==text)movementDetail.value.textContent=text;
 }else if(movementDetail){movementDetail.label.remove();movementDetail.value.remove();movementDetail=null;}
}
const originalLabels=new Map();
const replacements=[['.demo-label','Paquete histórico de fuentes públicas'],['.intro p','Posiciones publicadas y agenda de intenciones'],['.intro-note','Inspeccioná la evidencia del informe. Los planes no confirman eventos reales.'],['.scene-header h2','Posiciones publicadas · hora de observación desconocida'],['.scrub-label','Recorrer hitos planificados'],['.results h2','Conteos y cobertura de fuentes'],['.results .section-heading p','Conteos de filas publicadas; no métricas de desempeño real.'],['.timeline-section h2','Intenciones y hitos publicados'],['.timeline-section .section-heading p','Prácticos y remolcadores conservan su significado y precisión originales.'],['footer p:first-child','Visor de posiciones e intenciones publicadas · Terminales ADM, TBB 9 y Cargill · Geografía ilustrativa.'],['footer p:last-child','La escena conserva posiciones reportadas, sin inferir resultados de la agenda.']];
for(const [selector] of replacements)originalLabels.set(selector,document.querySelector(selector).textContent);
function beginDatasetRequest(){loadController?.abort();loadController=new AbortController();return {token:++datasetRequest,signal:loadController.signal};}
async function activateSource(input,addLuna=false){
 const request=beginDatasetRequest();
 try{const next=await loadBundle(input,{signal:request.signal});if(request.token!==datasetRequest)return false;
  bundle=next;lunaEnabled=addLuna;updateLunaButton();switchDataset();
  if(addLuna){selected=LUNA_LINDA.id;renderTimeline();renderFrame();}
  $('load-status').textContent=addLuna?'Luna Linda agregada como escala hipotética. No pertenece al informe ni confirma una visita a Bahía Blanca.':'Paquete local validado estructuralmente. '+next.id;return true;
 }catch(error){if(request.token===datasetRequest)$('load-status').textContent='Error: '+error.message;return false;}
}
function switchDataset(){$('speed').value=bundle?'0.1':'2';playing=false;lastFrame=null;time=0;selected=bundle?null:0;updatePlay();refreshBounds();detailsBundle=null;document.querySelector('.scene-header').classList.toggle('source-header',!!bundle);$('plan-clock-label').hidden=!bundle;
 for(const [selector,text] of replacements)document.querySelector(selector).textContent=bundle?text:originalLabels.get(selector);
 for(const selector of ['#modes','aside > h2','.aside-intro','aside > details','.timeline-legend','.legend','.ruler'])document.querySelector(selector).hidden=!!bundle;
 $('source-context').hidden=!bundle;$('motion-controls').hidden=!bundle;$('animate-source').checked=motionEnabled;$('export').textContent=bundle?'Descargar evidencia y procedencia':'Descargar escenario y resultados';
 if(bundle){const context=$('source-context');context.replaceChildren(node('h2','Fuentes, inventario completo y revisión'));const board=node('div',null,'observation-board');board.append(node('h3','Posiciones publicadas · hora de observación desconocida'));for(const e of sourceView(bundle).entities){const button=node('button',`${e.name} · ${e.details.terminal} · ${sourceStateLabel(e.state,'board')}`);button.addEventListener('click',()=>select(e.id));board.append(button);}context.append(board);for(const [title,value] of [['Fuentes',bundle.sources],['Inventario completo (incluye contexto fuera del alcance)',bundle.inventory],['Afirmaciones y tiempos originales',bundle.assertions],['Supuestos',bundle.assumptions],['Cuestiones sin resolver',bundle.unresolved_issues],['Revisión',bundle.review]]){const details=node('details');details.append(node('summary',title),node('pre',JSON.stringify(value,null,2)));context.append(details);}context.prepend(node('p',`Informe ${bundle.report_date} · corte de observación desconocido · hash del paquete ${bundle.bundle_hash}`));}
 renderMetrics();renderTimeline();renderFrame();if(bundle)renderMotionControls();}
$('source-file').addEventListener('change',e=>{const loading=e.target.files[0]?activateSource(e.target.files[0]):undefined;e.target.value='';return loading;});
$('load-local').addEventListener('click',()=>activateSource('/data/normalized/bahia-2026-10-06.json'));
$('synthetic-mode').addEventListener('click',()=>{beginDatasetRequest();lunaEnabled=false;updateLunaButton();bundle=null;switchDataset();$('load-status').textContent='Demostración sintética activa.';});

function renderMotionControls(){
 const plan=motionPlan(bundle);$('motion-decisions').replaceChildren(...[
 ...plan.movements.map(m=>node('li',`${m.name}: ${m.direction} ilustrativa, ${m.durationHours*60} min; vínculo por nombre/terminal asumido${m.delayHours>0?`; espera visual ${format(m.delayHours*60)} min, sin alterar el horario publicado`:''}.`)),
 ...plan.skipped.map(m=>node('li',`${m.name}: sin animación — ${m.reason}.`))]);
 document.querySelector('.scene-header h2').textContent=motionEnabled?'Movimientos previstos · animación ilustrativa':'Posiciones publicadas · hora de observación desconocida';
 $('plan-clock-label').textContent=motionEnabled?'Hora ilustrativa':'Hora del plan';
 document.querySelector('footer p:last-child').textContent=motionEnabled?'La animación representa supuestos basados en planes publicados, sin confirmar ejecución.':'La escena conserva posiciones reportadas, sin inferir resultados de la agenda.';
 $('policy-note').textContent=motionEnabled?'Movimiento ilustrativo: hora prevista de remolcadores como referencia; turnos y esperas visuales separan maniobras sin alterar horarios publicados. Entrada 45 min y salida 30 min asumidas. Sin métricas de desempeño real. Zona horaria Argentina asumida.':'El reloj recorre intenciones publicadas. Las posiciones del informe no cambian ni confirman movimientos. Zona horaria Argentina interpretada como supuesto.';
}
$('animate-source').addEventListener('change',e=>{motionEnabled=e.target.checked;playing=false;lastFrame=null;refreshBounds();updatePlay();renderMotionControls();renderTimeline();renderFrame();});

function updateLunaButton(){$('luna-linda').textContent=lunaEnabled?'Quitar Luna Linda (hipotético)':'Agregar Luna Linda (hipotético)';$('luna-linda').setAttribute('aria-pressed',String(lunaEnabled));}
$('luna-linda').addEventListener('click',async()=>{
 if(!bundle){await activateSource('/data/normalized/bahia-2026-10-06.json',true);return;}
 beginDatasetRequest();lunaEnabled=!lunaEnabled;updateLunaButton();selected=lunaEnabled?LUNA_LINDA.id:null;
 refreshBounds();lastFrame=null;renderTimeline();renderFrame();
 $('load-status').textContent=lunaEnabled?'Luna Linda agregada como escala hipotética. No pertenece al informe ni confirma una visita a Bahía Blanca.':'Escala hipotética de Luna Linda eliminada.';
});
