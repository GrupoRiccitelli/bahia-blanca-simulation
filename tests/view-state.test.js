import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBundle, loadBundle } from '../src/source-data.js';
import { sourceView, sourceExport } from '../src/replay.js';
import { syntheticView } from '../src/synthetic-adapter.js';
import { METRIC_ALLOWLIST } from '../src/view-state.js';
import { createScenario, simulate } from '../src/engine.js';

// Constructed evidence only; no official report rows or redistributed PDF bytes.
function bundle() {
  const timestamp = value => ({ original: value, earliest: value, latest: value, precision: 'datetime', timezone: 'America/Argentina/Buenos_Aires', timezone_evidence: 'assumed' });
  return {
    schema_version: '1.0', scenario_kind: 'published_snapshot', id: 'constructed-source',
    report_date: '2026-10-06', review: { status: 'reviewed', schema_version: '1.0', source_hashes: { position: 'b'.repeat(64), vts: 'b'.repeat(64) } }, bundle_hash: 'a'.repeat(64),
    coverage: { start: '2026-10-06T09:30:00Z', end: '2026-10-06T15:00:00Z', observation_cutoff: null },
    sources: ['position', 'vts'].map(id => ({ id, status: 'verified', sha256: 'b'.repeat(64), retrieved_at: '2026-10-06T16:22:56Z' })),
    assertions: [{ id: 'assertion:1', source_id: 'position', source_sha256: 'b'.repeat(64), page: 1, section: 'berths', row: 1, field: 'name', original_text: 'constructed', parsed_value: 'Constructed vessel', units: null, precision: null, quality_warnings: [], evidence: 'reported', status: 'observation', event_type: null }],
    observations: [
      { id: 'vessel:<alpha>', name: '<script>source text</script>', vessel_id: 'hull:alpha', state: 'reported-alongside', terminal: 'ADM', in_scope: true, length_m: 229, beam_m: null, arrival_time: null, assertion_ids: ['assertion:1'] },
      { id: 'vessel:unknown', name: 'Unknown dimensions', vessel_id: 'hull:unknown', terminal: 'Unknown terminal', state: 'unknown', in_scope: true, assertion_ids: [] },
      { id: 'context:outside', name: 'Outside scope', vessel_id: 'hull:outside', terminal: 'Unknown terminal', state: 'reported-anchorage', in_scope: false, assertion_ids: [] },
    ],
    intentions: [
      { id: 'plan:one', name: 'First plan', direction: 'ENTRADA', terminal: 'ADM', tugs: ['Constructed tug'], pilot_time: timestamp('2026-10-06T09:30:00Z'), tug_time: timestamp('2026-10-06T12:00:00Z'), assertion_ids: ['assertion:1'] },
      { id: 'plan:two', name: 'Simultaneous plan', direction: 'ZARPADA', terminal: 'TBB 9', tugs: [], pilot_time: timestamp('2026-10-06T12:00:00Z'), tug_time: null, assertion_ids: [] },
      { id: 'plan:unknown', name: 'Unknown time', direction: 'ENTRADA', terminal: 'Unknown terminal', tugs: [], pilot_time: null, tug_time: null, assertion_ids: [] },
    ],
    inventory: [{ id: 'row:1', source_id: 'position', page: 1, section: 'berths', row: 1, original_text: 'constructed', review_status: 'reviewed', disposition: 'parsed', assertion_ids: ['assertion:1'] }],
    metric_eligibility: { reported_vessel_count: true, plan_count: true, coverage: true, turnaround: false },
    assumptions: ['Illustrative placement'], unresolved_issues: ['Unknown observation cutoff'],
  };
}

test('loader validates object and local File-like JSON without substituting records', async () => {
  const value = bundle();
  assert.equal(await loadBundle(value), value);
  assert.deepEqual(await loadBundle({ text: async () => JSON.stringify(value) }), value);
  await assert.rejects(loadBundle({ text: async () => '{broken' }), SyntaxError);
  await assert.rejects(loadBundle(null), /Versión/);
});

test('missing remote bundle and malformed remote JSON remain errors', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(loadBundle('/missing.json'), /404/);
    globalThis.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError('broken JSON'); } });
    await assert.rejects(loadBundle('/broken.json'), /broken JSON/);
  } finally { globalThis.fetch = previous; }
});

for (const [label, mutate] of [
  ['missing observation name', b => { delete b.observations[0].name; }],
  ['missing vessel identity', b => { delete b.observations[0].vessel_id; }],
  ['missing intention direction', b => { delete b.intentions[0].direction; }],
  ['invalid assertion page', b => { b.assertions[0].page = 0; }],
  ['unreviewed inventory', b => { b.inventory[0].review_status = 'pending'; }],
  ['exclusion without reason', b => { b.inventory[0].disposition = 'excluded-with-reason'; }],
  ['mismatched review hashes', b => { b.review.source_hashes.vts = 'c'.repeat(64); }],
  ['incompatible review schema', b => { b.review.schema_version = '2.0'; }],
  ['invalid additional hash', b => { b.review_hash = 'invalid'; }],
  ['invented observation cutoff', b => { b.coverage.observation_cutoff = b.coverage.start; }],
  ['nonstring vessel name', b => { b.observations[0].name = {}; }],
  ['nonboolean scope', b => { b.observations[0].in_scope = 'false'; }],
  ['nonarray tugs', b => { b.intentions[0].tugs = {}; }],
  ['nonstring tug name', b => { b.intentions[0].tugs = [7]; }],
  ['missing field provenance', b => { delete b.assertions[0].original_text; }],
  ['missing source retrieval time', b => { delete b.sources[0].retrieved_at; }],
  ['missing inventory provenance', b => { delete b.inventory[0].section; }],
  ['mismatched provenance hash', b => { b.assertions[0].source_sha256 = 'c'.repeat(64); }],
  ['unknown evidence status', b => { b.assertions[0].status = 'complete'; }],
  ['unknown evidence kind', b => { b.assertions[0].evidence = 'actual'; }],
  ['unknown inventory disposition', b => { b.inventory[0].disposition = 'discarded'; }],
  ['missing time provenance', b => { delete b.intentions[0].pilot_time.timezone_evidence; }],
  ['unsupported schema', b => { b.schema_version = '99'; }],
  ['wrong scenario kind', b => { b.scenario_kind = 'historical_actual'; }],
  ['missing required section', b => { delete b.intentions; }],
  ['incomplete sources', b => { b.sources.pop(); }],
  ['failed required source', b => { b.sources[0].status = 'error'; }],
  ['duplicate required source', b => { b.sources[1].id = 'position'; }],
  ['unknown required source', b => { b.sources[1].id = 'unexpected'; }],
  ['invalid source hash', b => { b.sources[0].sha256 = 'not-a-hash'; }],
  ['invalid bundle hash', b => { b.bundle_hash = 'not-a-hash'; }],
  ['unapproved review', b => { b.review.status = 'pending'; }],
  ['forbidden metric eligibility', b => { b.metric_eligibility = { averageWait: true }; }],
  ['milestone beyond coverage', b => { b.intentions[0].pilot_time.earliest = b.intentions[0].pilot_time.latest = '2026-10-07T00:00:00Z'; }],
  ['missing source hash', b => { delete b.sources[0].sha256; }],
  ['missing review', b => { delete b.review; }],
  ['broken assertion reference', b => { b.observations[0].assertion_ids = ['missing']; }],
  ['broken source reference', b => { b.assertions[0].source_id = 'missing'; }],
  ['duplicate entity ID', b => { b.observations[1].id = b.observations[0].id; }],
  ['numeric source ID', b => { b.observations[0].id = 42; }],
  ['negative dimension', b => { b.observations[0].length_m = -1; }],
  ['nonfinite dimension', b => { b.observations[0].beam_m = Infinity; }],
  ['invented state', b => { b.observations[0].state = 'handling'; }],
  ['invalid coverage', b => { b.coverage.end = 'invalid'; }],
  ['reversed coverage', b => { b.coverage.end = '2026-10-05T00:00:00Z'; }],
  ['reversed milestone interval', b => { b.intentions[0].pilot_time.latest = '2026-10-05T00:00:00Z'; }],
]) test(`rejects ${label}`, () => { const value = bundle(); mutate(value); assert.throws(() => validateBundle(value)); });

test('string IDs and absent dimensions/time retain explicit unknown values', () => {
  const value = validateBundle(bundle()), view = sourceView(value, 0, 'vessel:unknown');
  assert.equal(view.selected, 'vessel:unknown');
  assert.equal(view.entities[0].id, 'vessel:<alpha>');
  assert.equal(view.entities[0].name, '<script>source text</script>');
  assert.equal(view.entities[0].beam, null);
  assert.equal(view.entities[1].length, null);
  assert.equal(view.entities[1].pose, null);
  assert.equal(view.entities[1].state, 'unknown');
  assert.equal(view.timeline[2].markers.length, 0);
  assert.equal(view.entities.length, 2);
  assert.equal(view.metrics.reported_count, 3);
});

test('source timeline preserves simultaneous planned types without changing observations', () => {
  const value = bundle(), first = sourceView(value, 0), end = sourceView(value, 5.5);
  assert.deepEqual(end.entities, first.entities);
  assert.equal(first.timeline[0].markers[1].at, first.timeline[1].markers[0].at);
  assert.deepEqual(first.timeline[0].markers.map(m => m.type), ['planned_pilot_time', 'planned_tug_time']);
  assert.ok(end.timeline.flatMap(row => row.markers).every(m => m.status === 'planned'));
  assert.equal(first.entities[0].state, 'reported-alongside');
});

test('source bounds clamp repeated forwards/backwards seeks deterministically', () => {
  const value = bundle(), original = structuredClone(value);
  assert.deepEqual(sourceView(value).bounds, { start: 0, end: 5.5 });
  for (const time of [0, 5.5, 2.5, 0, 5.5, -100, 100]) {
    assert.deepEqual(sourceView(value, time), sourceView(value, time));
    assert.equal(sourceView(value, time).time, Math.max(0, Math.min(5.5, time)));
  }
  assert.deepEqual(value, original);
});

test('source metrics are allowlisted and exports contain evidence without synthetic baseline', () => {
  const value = bundle(); value.metrics = { averageWait: 0, berthUtilization: 1 };
  const view = sourceView(value), exported = sourceExport(value);
  assert.deepEqual(Object.keys(view.metrics), METRIC_ALLOWLIST.published_snapshot);
  assert.deepEqual(view.metricEligibility, METRIC_ALLOWLIST.published_snapshot);
  assert.equal(view.metrics.averageWait, undefined);
  assert.equal(view.tugs.length, 0);
  assert.equal(view.closure, false);
  assert.equal(exported.bundle, value);
  for (const key of ['baseline', 'run', 'scenario', 'results']) assert.equal(Object.hasOwn(exported, key), false);
});

test('synthetic-source-synthetic adapters restore IDs, bounds, metrics and selection', () => {
  const run = simulate(createScenario('berth'));
  const before = syntheticView(run, 12, '3');
  const source = sourceView(bundle(), 12, before.selected);
  const after = syntheticView(run, 12, '3');
  assert.deepEqual(after, before);
  assert.equal(before.kind, 'synthetic');
  assert.equal(before.bounds.end, 48);
  assert.equal(before.selected, '3');
  assert.ok(before.entities.every(entity => typeof entity.id === 'string'));
  assert.ok(source.entities.some(entity => entity.id === source.selected));
  assert.equal(source.bounds.end, 5.5);
  assert.deepEqual(Object.keys(source.metrics), METRIC_ALLOWLIST.published_snapshot);
  assert.deepEqual(before.metricEligibility, METRIC_ALLOWLIST.synthetic);
  assert.notEqual(source.datasetId, before.datasetId);
});
