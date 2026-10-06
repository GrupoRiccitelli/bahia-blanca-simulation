# Implementation plan: Astra audit fixes

Date: 2026-10-06. Basis: `full-app-astra-audit.md`, reviewed commit d2a8a40.

## Scope and evidence policy

Resolve all eight confirmed findings. Keep official observations, milestone times and coverage unchanged. Any route separation, holding, transit timing or extra visual coverage remains an explicit illustrative assumption. Do not claim navigation safety or authenticated imported evidence. Preserve the existing deterministic scheduler and synthetic comparison behavior.

## Parallel workstreams

1. Geometry (F1–F3, F8): implement shared testable routing/placement primitives for source, synthetic and Luna Linda. Separate waiting areas and moving routes; prevent simultaneous moving-hull intersections through spatial routing or a disclosed visual scheduling offset. Preserve source plan timestamps independently of visual timing. Keep complete rotated hulls off land, ensure continuous berth headings, and extend only illustrative Luna Linda playback bounds. Cover all displayed vessel pairs and quay intersections over complete source and all four synthetic scenarios, including backward seeking and short coverage. Own replay.js, source-motion.js, synthetic-adapter.js, luna-linda.js, geometry helpers and geometry tests.
2. Interface state (F4, F5, F7 plus F8 integration): preserve provenance disclosures/focus across playback, use latest-request-wins loading for local files, fetches and Luna Linda initialization, map unknown locations explicitly, refresh slider bounds after optional-ship changes. Cache immutable plans/bounds if useful without changing evidence semantics. Handle persisted pagehide without permanently disposing a cached scene. Own app.js, related HTML/CSS if necessary and interface regression tests. Coordinate geometry interface with geometry agent.
3. Data contract (F6): align schema, JavaScript loader and offline pipeline around accepted unknown/null values and rejected dimensions/evidence states. Add representative acceptance/rejection parity tests using an available JSON Schema validator; document cross-reference checks that require procedural validation. Preserve frozen source hash/review gates. Own schema, source-data.js, pipeline validation code and contract tests. Clarify evidence exports versus session imports without expanding to a session restoration feature.

## Integration and acceptance

Primary agent reviews each workstream and resolves shared interfaces. Run complete JavaScript and Python suites plus geometry regressions and targeted import/render tests. Inspect source/synthetic switching, playback/pause/backward seek, unknown records, Luna Linda add/remove and short coverage in the browser where available. Record actual verification and limitations; do not infer browser results from unit tests. Update README and verification documentation to final behavior, retaining historical audit findings. Commit and push completed fixes to GrupoRiccitelli repository.

## Deferred boundaries

Live AIS, confirmed port visits, calibrated maneuver durations, cryptographic publisher authentication and restorable-session imports are outside this repair. Source export keeps original evidence separate from illustrative overlays. Broader GPU/download/browser lifecycle claims require direct browser evidence.

## Completion record

Implemented all eight confirmed findings across the three workstreams. Added shared geometry and full hull-pair/quay regression sampling, stable detail DOM and request-order tests, explicit unknown labels, optional visual horizon handling, and schema/loader/pipeline parity fixtures. The geometry is verified against the current frozen source scenario and all four bundled synthetic scenarios, not every possible imported layout. The primary integration review corrected the exported departure endpoint to match the transit corridor. Actual browser verification confirmed source load, seek, play/pause, open provenance during playback, Luna addition and visual-delay disclosure. BFCache eligibility and downloaded-file saving remain unverified.
