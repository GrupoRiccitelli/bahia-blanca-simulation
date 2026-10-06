# Bahía Blanca Port Simulation

A static viewer for Grupo Riccitelli with two separate modes: a synthetic 48-hour port demonstration and a locally imported, reviewed published-position report with planned movement markers.

## Run locally

Requires Python 3. No dependency installation is needed.

```bash
cd /home/santiago/GrupoRiccitelli/bahia-blanca-simulation
python3 -m http.server 5180 --bind 127.0.0.1
```

Open http://127.0.0.1:5180/ . If Node.js/npm is available, `npm start` runs the same server and `npm test` runs the JavaScript engine and presentation/loader checks. `npm run test:data` runs the offline Python pipeline checks.

## Try the simulation

1. Press **Reproducir** to watch vessels enter, handle cargo and leave.
2. Drag the time slider to inspect any point in the 48-hour run.
3. Select a vessel from the timeline to see its state, berth and waiting time.
4. Choose a six-hour arrival delay, tug outage or TBB 9 closure.
5. Compare the full-run results against the unchanged normal baseline.
6. Download the complete scenarios, assumptions, events and results as JSON.

The geographic view is an interactive Three.js 3D scene with modeled bulk carriers, tugs, silos, loading equipment, water, lighting and shadows. Drag to orbit, use the wheel to zoom, and press Restablecer cámara to return. A browser with WebGL support is required. Bahía Blanca and the terminal names ADM, TBB 9 and Cargill are real; vessels, schedules, geometry, durations, resources and operating rules are illustrative assumptions. No current port feed or fleet credentials are used. Time starts at a fixed illustrative 2026-10-06 00:00 Argentina time.

## Published positions and planned movements

Choose the source mode and import a local reviewed JSON bundle. The report board has an unknown observation cutoff. Seeking highlights typed pilot/tug plans without confirming completion or moving reported vessels. Only report counts, plan counts and inventory coverage are available; waiting, utilization and loading progress remain unavailable. Source exports preserve evidence and review metadata. Geography and hull proportions for missing dimensions are illustrative.

The bundled offline pipeline supports the exact frozen 2026-10-06 audited PDF hashes. Other versions fail for review rather than being silently parsed. Python 3 and Poppler's `pdftotext` are required for normalization; the manual fetcher itself needs only Python's standard library. Run from this project directory:

```bash
python3 scripts/fetch_sources.py
python3 scripts/normalize_reports.py --manifest data/raw/audit-2026-10-06/manifest.json --output data/normalized/audit-2026-10-06
python3 scripts/validate_bundle.py --input data/normalized/audit-2026-10-06 --review scenarios/audit-2026-10-06.review.json
python3 scripts/assemble_bundle.py --input data/normalized/audit-2026-10-06 --review scenarios/audit-2026-10-06.review.json --output data/normalized/bahia-2026-10-06.json
```

The fetch command saves a fresh timestamped snapshot under `data/raw/snapshots/`; the commands above deliberately use the retained audited snapshot. For another snapshot, use its manifest path and create a review tied to its hashes. The current parser will block unsupported bytes. Review source rows, scope, aliases, assumptions and unresolved issues before approval. Nonempty overrides and linked intentions are currently rejected; the pipeline does not silently apply or ignore them. Do not edit an approved review in place to represent a new source version.

Import `data/normalized/bahia-2026-10-06.json` through the viewer's local-file control. Raw PDFs, normalized assertions and assembled source bundles remain ignored and local; they are not redistributed in the repository. A file import checks structure and review metadata, not publisher authentication. Missing files, incomplete sources and unsupported schemas produce errors.

Implemented: normalization for the frozen layout, section inventory, validation, deterministic reviewed assembly, neutral synthetic/source adapters, a report board and separate planned-marker timeline. An optional planned-movement overlay now animates uniquely matched ships using planned tug times as references, with explicit visual turns and holds to separate simultaneous maneuvers, using assumed 45-minute arrivals and 30-minute departures. Routes, origin, identity links and post-movement placement are illustrative; the source bundle stays unchanged. Uncheck “Animar movimientos previstos” to return to published positions. Playback defaults to 6 simulated minutes per second and stays paused until started; reduced-motion preferences default the overlay off. The export separates the versioned overlay and its assumptions from the original evidence. Completed historical replay, live collection, an assumption-driven real-data what-if engine and calibrated prediction remain deferred. The [implementation plan](docs/real-data-implementation-plan.md) and [audit](docs/real-data-plan-audit.md) explain those evidence gates.

## How it works

`src/engine.js` runs a deterministic event simulation independently of playback. Departures have priority, larger vessels require two tugs, and resources cannot overlap. Background traffic occupies the channel during explicit windows. Existing handling continues through a berth closure; the closure prevents new inbound assignments. Tug reservations include turnaround and cannot overlap the configured outage.

The dispatch policy is intentionally simple. A disruption can improve a metric by changing the order of jobs; it does not imply that removing a resource improves real port performance. Metrics describe the assumptions in this model. Historical calibration and true geographic routes remain future work.

The browser needs no external scripts, tiles, fonts or network feeds. Python serves the static files on loopback. The simulator uses no randomness and records its engine version in every export.

## Files

- [Prototype decisions](docs/prototype-decisions.md): the chosen assumptions and exact resource/metric semantics.
- [Implementation plan](docs/implementation-plan.md): source audit and roadmap toward a calibrated operational model.
- `src/engine.js`: scheduling and metrics.
- `src/app.js`: mode selection, playback, timeline and exports.
- `src/source-data.js`, `src/replay.js`, `src/view-state.js`, `src/synthetic-adapter.js`: bundle loading and separate presentation adapters.
- `scripts/normalize_reports.py`, `scripts/validate_bundle.py`, `scripts/assemble_bundle.py`: offline evidence pipeline.
- `schemas/source-bundle.json`: versioned source bundle contract.
- `src/port3d.js`: 3D models, vessel movement, camera and selection.
- `vendor/three/`: locally bundled Three.js 0.180.0 and OrbitControls, under the included MIT license.
- `tests/engine.test.js`: hand-worked timing, deterministic resource checks for all four modes, background traffic, closures and horizon handling.
- `tests/view-state.test.js`: loader failures, source semantics, null fields, string IDs, metric isolation and deterministic seeks.
- `tests/test_*.py`: pipeline failure fixtures and deterministic assembly checks.

The first demonstration is implemented. The GitHub repository is https://github.com/GrupoRiccitelli/bahia-blanca-simulation. No cloud deployment is configured.

Use **Agregar Luna Linda (hipotético)** to add an optional vessel to the source viewer. Public particulars for the name LUNA LINDA are IMO 9792369 and 138 × 26 m ([VesselFinder](https://www.vesselfinder.com/vessels/details/9792369), checked 2026-10-06). The supplied MarineTraffic shipid could not be verified directly. The anchorage, berth and arrival in the first free visual turn at or after one hour from the agenda origin are hypothetical; the vessel is not added to official observations, VTS intentions or source counts. The export records it separately under `hypotheticalAdditionalVessels`. Remove it with the same button. A reviewed source bundle must be imported or available locally.


The [Astra audit](docs/full-app-astra-audit.md) and [repair plan](docs/audit-fixes-implementation-plan.md) track eight repaired defects. Source and synthetic views now share schematic routing: separate holding columns, offshore turns, and lateral docking with continuous headings. Regression tests check full rendered hulls against every displayed vessel and the quay throughout the supplied scenarios. These checks do not establish navigation safety or guarantee arbitrary imported geometries. Source visual holds preserve published pilot/tug times and are exported separately as assumptions. Luna Linda extends only the illustrative horizon when needed.

Provenance panels stay open across playback, newer dataset choices supersede pending loads, unknown locations remain unknown, and persisted pagehide keeps the scene alive. The schema, browser loader and offline validator share contract fixtures. Run `npm test` and `npm run test:data`; the full external JSON Schema parity check runs when Python `jsonschema` is installed, otherwise reports an explicit skip. Procedural checks additionally validate reference bindings, unique identifiers and temporal ordering. Imported hash metadata is not publisher authentication. Evidence exports wrap a raw bundle; import the `.bundle` content to view that evidence. Exported playback and optional-vessel settings are not restored as a session.
