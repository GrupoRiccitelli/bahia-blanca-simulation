import { createPortScene } from './port3d.js';
import { createScenario, simulate, stateAt, MODES } from './engine.js';
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
  const m=run.metrics,b=baseline.metrics;
  const delta=(value,base,unit)=>{const d=value-base;return mode==='normal'?'Referencia para comparar':Math.abs(d)<0.05?'Sin cambio frente a normal':`${d>0?'+':''}${format(d)} ${unit} frente a normal`;};
  $('comparison-label').textContent=MODES[mode];
  $('policy-note').textContent=mode==='normal' ? 'La operación normal sirve de referencia. El orden de despacho sigue una regla simple de prioridad de salida.' : 'Un cambio también puede reducir alguna espera al alterar el orden de despacho. Este modelo usa una regla simple, sin optimizar la agenda. Remolcadores ocupados: '+Math.round(m.tugUtilization*100)+' % del tiempo disponible.';
  $('metrics').innerHTML=[['Espera media de entrada',`${format(m.averageWait)} h`,delta(m.averageWait,b.averageWait,'h'),m.averageWait>b.averageWait+.05],['Buques completados',`${m.completed} / ${run.jobs.length}`,`${m.unfinished} sin completar al final`,false],['Ocupación de muelles',`${Math.round(m.berthUtilization*100)} %`,delta(m.berthUtilization*100,b.berthUtilization*100,'puntos'),false],['Turnaround medio',`${format(m.averageTurnaround??0)} h`,delta(m.averageTurnaround??0,b.averageTurnaround??0,'h'),(m.averageTurnaround??0)>(b.averageTurnaround??0)+.05]].map(([label,value,note,worse])=>`<div class="metric"><span class="metric-label">${label}</span><strong>${value}</strong><small class="${worse?'worse':''}">${note}</small></div>`).join('');
}
function renderTimeline(){
  $('timeline').innerHTML='<div class="timeline-top"><span>Buque</span><div class="timeline-hours">'+[0,8,16,24,32,40,48].map(x=>`<span>${x} h</span>`).join('')+'</div></div>'+run.jobs.map(j=>{
    const end=run.scenario.horizon, segments=[['waiting',j.arrival,j.inboundStart??end],['transit',j.inboundStart,j.inboundEnd],['handling',j.inboundEnd,j.handlingEnd],['departure_wait',j.handlingEnd,j.outboundStart??end],['transit',j.outboundStart,j.outboundEnd]];
    return `<div class="timeline-row ${j.id===selected?'selected':''}" data-vessel="${j.id}"><button class="vessel-name" aria-label="Seguir ${j.name}">${j.name}</button><div class="lane" aria-label="${j.name}: entrada ${format(j.inboundStart??end)} horas, salida ${format(j.outboundEnd??end)} horas">${segments.filter(([,a,b])=>a!==null&&b!==null&&b>a).map(([type,a,b])=>`<span class="segment ${type}" title="${type==='transit'?'Maniobra':type==='handling'?'Carga':type==='waiting'?'Espera de entrada':'Espera de salida'}: ${format(a)}–${format(b)} h" style="left:${a/end*100}%;width:${(Math.min(end,b)-a)/end*100}%"></span>`).join('')}<i class="lane-cursor" style="left:${time/end*100}%"></i></div></div>`;
  }).join('');
}
function renderFrame(){
  const instant=new Date(Date.parse(run.scenario.startsAt)+time*3600000);
  $('clock').textContent=instant.toLocaleTimeString('es-AR',{timeZone:run.scenario.timezone,hour:'2-digit',minute:'2-digit',hour12:false});
  $('date').textContent=instant.toLocaleDateString('es-AR',{timeZone:run.scenario.timezone,day:'numeric',month:'short',year:'numeric'});
  $('elapsed').textContent=`Hora ${format(time)} de 48`;
  $('scrub').value=time;
  port?.update(run,time,selected);
  const background=run.scenario.background.some(([a,b])=>time>=a&&time<b);
  const last=run.events.filter(e=>e.time<=time).at(-1);
  $('scene-activity').textContent=background?'Canal reservado para tráfico de otros terminales':last?`${run.jobs.find(j=>j.id===last.vessel).name}: ${eventLabels[last.type]}`:'Inicio del escenario';
  const job=run.jobs.find(j=>j.id===selected);
  $('ship-name').textContent=job.name;$('ship-state').textContent=labels[stateAt(job,time)];
  $('ship-details').innerHTML=[['Eslora',`${job.length} m`],['Carga',job.cargo],['Muelle asignado',job.berth===null?'Pendiente':run.scenario.berths[job.berth]],['Llegada prevista',`Hora ${format(job.arrival)}`],['Espera de entrada',`${format((job.inboundStart??48)-job.arrival)} h`],['Remolcadores necesarios',job.length>=220?'2':'1']].map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');
  document.querySelectorAll('.lane-cursor').forEach(el=>el.style.left=`${time/48*100}%`);
}
function select(id){selected=Number(id);renderTimeline();renderFrame();}
$('modes').addEventListener('click',e=>{const button=e.target.closest('[data-mode]');if(!button)return;mode=button.dataset.mode;run=simulate(createScenario(mode));playing=false;time=0;lastFrame=null;updatePlay();document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',b.dataset.mode===mode)});renderMetrics();renderTimeline();renderFrame();});

$('timeline').addEventListener('click',e=>{const el=e.target.closest('[data-vessel]');if(el)select(el.dataset.vessel)});
function updatePlay(){$('play').textContent=playing?'Ⅱ Pausar':'▶ Reproducir';$('play').setAttribute('aria-label',playing?'Pausar simulación':'Reproducir simulación')}
$('play').addEventListener('click',()=>{if(time>=48)time=0;playing=!playing;lastFrame=null;updatePlay();renderFrame()});
$('reset').addEventListener('click',()=>{time=0;playing=false;lastFrame=null;updatePlay();renderFrame()});
$('scrub').addEventListener('input',e=>{time=Number(e.target.value);lastFrame=null;renderFrame()});
$('export').addEventListener('click',()=>{
  const data={format:'bahia-demo-run-v1',evidence:'illustrative assumptions',baseline,selectedRun:run};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`bahia-blanca-${mode}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.addEventListener('visibilitychange',()=>{lastFrame=null});
function frame(now){if(playing&&!document.hidden){if(lastFrame!==null)time=Math.min(48,time+(now-lastFrame)/1000*Number($('speed').value));lastFrame=now;if(time>=48){playing=false;updatePlay()}renderFrame()}requestAnimationFrame(frame)}
renderMetrics();renderTimeline();renderFrame();requestAnimationFrame(frame);

window.addEventListener('pagehide',()=>port?.dispose(),{once:true});
