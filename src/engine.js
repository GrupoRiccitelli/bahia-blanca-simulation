export const ENGINE_VERSION = '0.1.0';
export const MODES = {
  normal: 'Operación normal',
  delay: 'Buque demorado 6 h',
  tug: 'Un remolcador fuera de servicio',
  berth: 'Cierre de TBB 9 por 12 h',
};
export function createScenario(mode = 'normal') {
  if (!Object.hasOwn(MODES, mode)) throw new Error('Unknown mode');
  const names = ['Austral', 'Pampa', 'Estuario', 'Horizonte', 'Patagonia', 'Brisa', 'Sur', 'Delta', 'Atlántico', 'Faro'];
  const arrivals = [0, 1, 2, 4, 6, 9, 12, 16, 20, 25];
  const handling = [7, 6, 8, 5, 7, 5, 8, 6, 5, 6];
  const lengths = [229, 190, 225, 180, 230, 175, 225, 195, 228, 185];
  return {
    schemaVersion: 1, mode, label: MODES[mode], horizon: 48,
    startsAt: '2026-10-06T03:00:00Z', timezone: 'America/Argentina/Buenos_Aires',
    evidence: 'assumed', geometry: 'schematic',
    rules: { inbound: 1, outbound: 0.75, turnaround: 0.5, twoTugLength: 220 },
    berths: ['ADM', 'TBB 9', 'Cargill'], tugs: ['R1', 'R2', 'R3'],
    background: [[3, 4], [10, 11], [20, 21], [30, 31]],
    tugOutage: mode === 'tug' ? { tug: 2, start: 2, end: 18 } : null,
    berthClosure: mode === 'berth' ? { berth: 1, start: 4, end: 16 } : null,
    calls: names.map((name, i) => ({ id: i, name, arrival: arrivals[i] + (mode === 'delay' && i === 2 ? 6 : 0), handling: handling[i], length: lengths[i], preferredBerth: i % 3, cargo: i % 3 === 2 ? 'Soja' : i % 3 === 1 ? 'Trigo' : 'Maíz', evidence: 'assumed' })),
  };
}
const overlap = (a, b, c, d) => a < d && c < b;
const clip = (a, b, horizon) => Math.max(0, Math.min(horizon, b) - Math.max(0, a));
export function simulate(scenario) {
  const s = structuredClone(scenario);
  if (!(s.horizon > 0) || s.calls.some(c => c.arrival < 0 || !(c.handling > 0))) throw new Error('Invalid scenario');
  const jobs = s.calls.map(c => ({ ...c, state: 'expected', berth: null, inboundStart: null, inboundEnd: null, handlingEnd: null, outboundStart: null, outboundEnd: null, inboundTugs: [], outboundTugs: [] }));
  const events = [], movements = [], tugDuties = [], berthReservations = [];
  const berthBusy = s.berths.map(() => null), tugReady = s.tugs.map(() => 0);
  let channelReady = 0, t = 0, iterations = 0;
  const event = (job, type) => events.push({ time: t, vessel: job.id, type, berth: job.berth });
  function availableTugs(job, duration) {
    const count = job.length >= s.rules.twoTugLength ? 2 : 1;
    return s.tugs.map((_, i) => i).filter(i => tugReady[i] <= t && !(s.tugOutage?.tug === i && overlap(t, t + duration + s.rules.turnaround, s.tugOutage.start, s.tugOutage.end))).slice(0, count);
  }
  function channelAvailable(duration) {
    return channelReady <= t && !s.background.some(([a, b]) => overlap(t, t + duration, a, b));
  }
  function reserve(job, direction, tugs) {
    const duration = direction === 'inbound' ? s.rules.inbound : s.rules.outbound;
    channelReady = t + duration;
    movements.push({ vessel: job.id, direction, start: t, end: t + duration, tugs: [...tugs] });
    for (const tug of tugs) {
      tugReady[tug] = t + duration + s.rules.turnaround;
      tugDuties.push({ tug, vessel: job.id, direction, start: t, end: tugReady[tug] });
    }
    if (direction === 'inbound') {
      job.inboundStart = t; job.inboundEnd = t + duration;
      job.handlingEnd = job.inboundEnd + job.handling;
      job.inboundTugs = tugs; job.state = 'inbound';
      berthBusy[job.berth] = job.id;
      berthReservations.push({ berth: job.berth, vessel: job.id, start: t, end: s.horizon });
    } else {
      job.outboundStart = t; job.outboundEnd = t + duration;
      job.outboundTugs = tugs; job.state = 'outbound';
      berthReservations.find(r => r.vessel === job.id).end = job.outboundEnd;
    }
    event(job, direction);
  }
  while (t <= s.horizon) {
    if (++iterations > 10000) throw new Error('Event loop did not converge');
    for (const job of jobs) {
      if (job.state === 'expected' && job.arrival <= t) { job.state = 'waiting'; event(job, 'arrival'); }
      if (job.state === 'inbound' && job.inboundEnd <= t) { job.state = 'handling'; event(job, 'handling'); }
      if (job.state === 'handling' && job.handlingEnd <= t) { job.state = 'departure_wait'; event(job, 'ready'); }
      if (job.state === 'outbound' && job.outboundEnd <= t) { job.state = 'completed'; berthBusy[job.berth] = null; event(job, 'completed'); }
    }
    const departures = jobs.filter(j => j.state === 'departure_wait').sort((a,b) => a.handlingEnd-b.handlingEnd || a.id-b.id);
    for (const job of departures) {
      const tugs = availableTugs(job, s.rules.outbound), count = job.length >= s.rules.twoTugLength ? 2 : 1;
      if (channelAvailable(s.rules.outbound) && tugs.length === count) reserve(job, 'outbound', tugs);
    }
    const arrivals = jobs.filter(j => j.state === 'waiting').sort((a,b) => a.arrival-b.arrival || a.id-b.id);
    for (const job of arrivals) {
      const order = [job.preferredBerth, ...s.berths.map((_,i)=>i).filter(i=>i!==job.preferredBerth)];
      const berth = order.find(i => berthBusy[i] === null && !(s.berthClosure?.berth === i && t >= s.berthClosure.start && t < s.berthClosure.end));
      const tugs = availableTugs(job, s.rules.inbound), count = job.length >= s.rules.twoTugLength ? 2 : 1;
      if (berth !== undefined && channelAvailable(s.rules.inbound) && tugs.length === count) { job.berth = berth; reserve(job, 'inbound', tugs); }
    }
    const next = [s.horizon, channelReady, ...tugReady, ...s.background.flat(), s.tugOutage?.start, s.tugOutage?.end, s.berthClosure?.start, s.berthClosure?.end];
    for (const job of jobs) {
      if (job.state === 'expected') next.push(job.arrival);
      if (job.state === 'inbound') next.push(job.inboundEnd);
      if (job.state === 'handling') next.push(job.handlingEnd);
      if (job.state === 'outbound') next.push(job.outboundEnd);
    }
    const future = next.filter(x => Number.isFinite(x) && x > t && x <= s.horizon);
    if (!future.length) break;
    t = Math.min(...future);
  }
  const arrived = jobs.filter(j=>j.arrival<=s.horizon), completed = jobs.filter(j=>j.outboundEnd !== null && j.outboundEnd<=s.horizon);
  const wait = arrived.reduce((n,j)=>n+(j.inboundStart ?? s.horizon)-j.arrival,0);
  const duty = tugDuties.reduce((n,r)=>n+clip(r.start,r.end,s.horizon),0);
  const availableHours = s.tugs.length*s.horizon-(s.tugOutage ? clip(s.tugOutage.start,s.tugOutage.end,s.horizon) : 0);
  return { engineVersion: ENGINE_VERSION, scenario: s, jobs, events, movements, tugDuties, berthReservations, metrics: {
    completed: completed.length, unfinished: arrived.length-completed.length, averageWait: arrived.length ? wait/arrived.length : 0, totalWait: wait,
    averageTurnaround: completed.length ? completed.reduce((n,j)=>n+j.outboundEnd-j.arrival,0)/completed.length : null,
    berthUtilization: berthReservations.reduce((n,r)=>n+clip(r.start,r.end,s.horizon),0)/(s.berths.length*s.horizon),
    tugUtilization: duty/availableHours,
  } };
}
export function stateAt(job, time) {
  if (time < job.arrival) return 'expected';
  if (job.inboundStart === null || time < job.inboundStart) return 'waiting';
  if (time < job.inboundEnd) return 'inbound';
  if (time < job.handlingEnd) return 'handling';
  if (job.outboundStart === null || time < job.outboundStart) return 'departure_wait';
  if (time < job.outboundEnd) return 'outbound';
  return 'completed';
}
