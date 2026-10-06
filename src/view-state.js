// Renderer-neutral contract: poses are explicit; renderers never infer events.
export const METRIC_ALLOWLIST = {published_snapshot:['reported_count','plan_count','coverage'],synthetic:['averageWait','completed','berthUtilization','averageTurnaround']};
export function clampTime(time,bounds){return Math.max(bounds.start,Math.min(bounds.end,Number(time)||0));}
export function validSelection(entities,id){return entities.some(e=>e.id===id)?id:(entities[0]?.id??null);}
