# Bahía Blanca simulation implementation plan

Created: 2026-10-06
Status: first illustrative demonstration implemented; historical calibration and source ingestion remain planned

The user requested a first simulation and authorized choosing ordinary port assumptions. The runnable static demonstration and its chosen rules are documented in [prototype-decisions.md](prototype-decisions.md). That document supersedes the initial architecture and acquisition-first sequence for this demonstration; the broader roadmap below remains for a calibrated model.

The next real-data release is governed by [real-data-implementation-plan.md](real-data-implementation-plan.md), including the 2026-10-06 source audit and actual-history blockers.

## 1. Objective and first release

Build a reproducible operational what-if simulator for a small part of Bahía Blanca. Answer how vessel delays, berth closures, and tug unavailability change queues, berth occupancy, and resource demand over 24–72 hours.

Start with candidate terminals ADM, TBB site 9, and Cargill around Ingeniero White. Confirm their geometry, capabilities, and constraints before treating those selections as final. Treat the wider estuary, anchorage, and access channel as simplified resources/travel legs initially; do not attempt to reproduce every terminal or the complete traffic-control system.

The first release runs locally and includes:

1. A source-backed starting snapshot with provenance and a completeness report.
2. An explicit assumption file for missing travel, handling, and tug-service durations.
3. A deterministic simulator and event log.
4. A timeline and geographic playback showing vessels, berths, queues, and resources.
5. Baseline and disrupted runs compared with consistent metrics.

Success means explainable, internally consistent scenarios. It does not mean operationally validated predictions or navigation clearance.

## 2. Audit findings that govern implementation

### Bahía Blanca

- The downloaded daily position report on 2026-10-06 contains reported docking date/time, named sites, anchorage arrival date/time, vessel lengths, cargo, tonnage, and expected arrivals.
- The VTS PDF downloaded directly on the same date contains planned entry/departure movements, vessel length/beam, terminal, pilot time, named tugs, and tug times. Its issue timestamp was 2026-10-06 06:58:33. These are plans, not completed events.
- A web-indexed copy of the VTS PDF lagged the directly downloaded file. Read issue timestamps from the payload; page modification dates and retrieval success do not establish freshness.
- The depth report inspected was dated 2026-07-21 and provides individual survey dates and a LAT reference to chart H-212. It is not a live navigability assessment.
- Monitor Puerto's launch announcement describes historical downloads. During this audit its page displayed no usable monitor interface, and an application asset failed certificate validation. A historical completed-call export has not been verified. Do not disable certificate checks to obtain it.
- Annual traffic statistics inspected are cargo aggregates, not a replacement for vessel-call history.
- No explicit open-data reuse licence was located in inspected sources. Record applicable terms and resolve redistribution rights before publishing source-derived datasets.

### Why retain Quequén as a reference

Quequén has accessible annual vessel PDFs. A text-extraction audit found 332 dated vessel rows in 2024 and 370 in 2025; 701 of 702 contained all four date fields. The complete rows had no reversed date sequences; 82 had equal start and finish dates. No time-of-day fields were found in those two reports. Counts are extraction results, not verified unique calls. Multi-cargo continuation rows require special handling.

Quequén is a fallback for a daily-resolution historical prototype. Do not transfer its cargo rates, event distributions, or operating rules to Bahía Blanca and represent them as local measurements.

## 3. Source register

| Source | Purpose | Limitation / handling |
|---|---|---|
| https://puertobahiablanca.com/situacion_operativa/posicion.pdf | Current reported berth/anchorage state, cargo, expected arrivals | Mutable PDF; freeze downloaded bytes, hash, and issue time |
| https://puertobahiablanca.com/vts/movimientos.pdf | Planned movements and tug/pilot assignments | Plans may change; never promote to actual events automatically |
| https://puertobahiablanca.com/vts-online.html | Publication context | Check payload freshness separately |
| https://puertobahiablanca.com/profundidades/profundidades.pdf | Dated berth/channel depth reference | Preserve datum and survey dates; no clearance claims |
| https://puertobahiablanca.com/canal-acceso.html | Access-channel context | Verify geometry and operating rules independently |
| https://puertobahiablanca.com/monitor-puerto.html | Potential movement/history interface | Access and export remain unverified |
| https://puertobahiablanca.com/novedades/lanzamiento-aplicacion-monitor-puerto.html | Historical export claim | Announcement is not evidence of current availability |
| https://puertoquequen.com/estadisticas-anuales/ | Fallback historical source directory | Different port; date-level records |
| https://puertoquequen.com/descargas/buques-2024.pdf | Historical extraction reference | 2024 sample audited |
| https://puertoquequen.com/descargas/buques-2025.pdf | Historical extraction reference | 2025 sample audited |
| https://github.com/adithya-s-k/FineEnvs/tree/main/07-simulation-environments/portsim-v1 | Scheduling/environment design reference | Barcelona container assumptions do not apply directly |

Public PDFs can change in place. The audit above is point-in-time evidence, not a promise that future fetches have identical content. The audit samples currently live outside this repository; Phase 1 must acquire and record reproducible source snapshots.

## 4. Architecture

Proposed stack, to verify against supported dependency versions during implementation:

- Python domain engine with a deterministic event queue (evaluate SimPy versus a small explicit queue before choosing).
- Pydantic-style validated input/output schemas; a FastAPI service when the UI needs it.
- React, TypeScript, Vite, MapLibre, and Three.js for the viewer, following suitable patterns in `../3d-live-simulation`.
- Local files and SQLite initially; no cloud infrastructure required for the prototype.
- Optional OR-Tools scheduling baseline after model validation. OpenEnv adapter and RL experiments are later extensions.

Keep the model independent of rendering and wall-clock time. A run consumes a frozen scenario and produces timestamped events and metrics. Playback changes speed or seeks through that output without rerunning or altering the model.

Review licensing and interfaces before reusing code. Do not modify the existing fleet viewer or connect to production ingestion as part of this initial repository setup.

Proposed layout:

```text
backend/
  src/bahia_sim/
    domain/         # entities, units, constraints
    ingest/         # fetch, PDF parsing, normalization, provenance
    engine/         # events, resources, dispatch policies
    scenarios/      # schema and scenario assembly
    metrics/        # comparison calculations
    api/            # local scenario/run endpoints
  tests/
frontend/
  src/              # timeline, geographic playback, assumptions, comparison
scenarios/          # versioned scenarios and explicit assumptions
data/
  raw/              # ignored immutable downloaded snapshots
  normalized/       # ignored derived records
runs/               # ignored event logs and result bundles
docs/
```

## 5. Data contracts and provenance

Each source snapshot records URL, retrieval time, issue time if present, content hash, parser version, coverage, timezone evidence, and reuse terms/status. Each normalized record retains a source page/row reference and validation warnings.

Use four evidence categories at field/event level: `reported`, `derived`, `assumed`, and `simulated`. Also store event status separately as `planned` or `actual`; a reported plan remains planned.

Core entities:

- Vessel: internal ID, name aliases, IMO/MMSI when verified, length/beam/draft where known. Never manufacture missing IDs or treat registered hull depth as draft.
- Port call: internal call ID, vessel reference, origin/destination, terminal, cargo, tonnage, distinct planned/actual timestamps.
- Berth: geometry, permitted vessel/cargo capabilities, resource capacity, closures, source-backed constraints.
- Tug: capabilities, availability windows, assignments, transit and turnaround assumptions. A tug named in one report is not evidence of its full-day availability.
- Scenario: frozen source references, simulation interval, initial state, arrivals, resources, assumptions, disruptions, policy, seed, schema version.
- Run: scenario hash, engine version, seed, ordered events, constraint violations, unresolved calls, metrics.

Normalize length/depth to metres, mass to tonnes, durations to seconds, and timestamps to UTC. Display local time using `America/Argentina/Buenos_Aires`. Preserve original values and units. Verify source timezone and draft notation before conversion; unknown values stay unknown.

Calls without complete timestamps must not silently acquire midnight times. Represent date-only values as intervals or explicitly modelled estimates. Expose uncertainty in the UI and export.

## 6. Simulation model

Initial states: expected, anchorage waiting, waiting for resources, inbound transit, berthing, handling, awaiting departure, outbound transit, completed. Vessels already alongside at scenario start need an explicit remaining-service estimate; elapsed berth time alone does not determine it.

Schedule events with stable tie-breaking. Reserve all required resources atomically to prevent double booking and deadlocks. Include tug travel and turnaround time. Model channel capacity and transit windows as simplified configurable constraints, clearly identified as assumptions until verified.

Start with a transparent first-come-first-served feasible dispatch policy. Record why a ship is blocked. Handle simultaneous arrivals, closures during service, cancellations, unavailable resources, and vessels unfinished at the horizon.

Disturbances for the first release:

1. One arrival delayed by a configurable interval.
2. One berth unavailable for a configured period.
3. One tug unavailable during a configured window.

Do not copy Barcelona's wind thresholds. Weather closures may initially be user-defined scenario windows; operational thresholds require local evidence. Likewise, do not copy container-crane productivity into a bulk-cargo terminal. Handling duration starts as an explicit terminal/cargo assumption with sensitivity bounds.

Report waiting time, turnaround time, berth occupancy, tug utilization, completed calls, unfinished calls, and constraint violations. Define each metric's start/end events and denominator. Mark right-censored calls at the horizon instead of treating them as completed or excluding them invisibly. Fuel/cost savings require separately supported cost models and are deferred.

## 7. Implementation phases and acceptance gates

### Phase 1 — Acquire data and build one scenario (estimated 2–3 working days)

- Implement bounded manual fetch commands for the position and VTS PDFs with timeouts and content-type checks.
- Save immutable snapshots and manifests; parse representative files and report ambiguous rows.
- Reconcile vessel/site aliases without merging uncertain identities.
- Select one published day and the initial terminal subset.
- Produce normalized records, a source coverage report, and a versioned scenario with every missing input listed.
- Confirm a basemap/geometry source with attribution and sufficient local detail.

Gate: every scenario fact traces to evidence or an explicit assumption; actual and planned events remain separate. Failed fetches must produce an error, not synthetic replacements.

### Phase 2 — Implement the headless engine (estimated 2–3 working days)

- Implement resource reservations, transitions, baseline dispatch, disruptions, event logs, and metrics.
- Add a CLI that executes a scenario without a browser.
- Export a self-contained run bundle with scenario hash and versions.

Gate: deterministic repeat runs; no double booking, impossible state transitions, negative durations, or silent capacity violations. Small hand-calculated scenarios produce expected outcomes.

### Phase 3 — Interactive viewer (estimated 3–4 working days)

- Build the timeline and assumption/provenance panels first.
- Add geographic playback with neutral vessel models scaled only from verified dimensions.
- Add pause, speed, seek, selection, and baseline/disruption comparison.
- Clearly label interpolated geographic movement as illustrative route playback, not measured tracks or maneuvering physics.
- Provide a usable timeline if geographic rendering fails.

Gate: displayed events and metrics match the engine output; every assumption is inspectable; the user can reproduce a scenario with the same seed. Spanish is the initial interface language.

### Phase 4 — Review, calibrate, and extend (separate from prototype estimate)

- Review routes, rules, timing assumptions, and bottlenecks with a port operator.
- Obtain completed-call history and, if available, actual tug service logs, closures, cargo handling start/end times, and terminal capabilities.
- Compare predictions with held-out historical periods and report errors by event/terminal and uncertainty range.
- Only then add optimization benchmarks and optional OpenEnv/RL integration.

Gate: report measured validation results before describing the simulator as predictive. An optimum is only optimal under the encoded model and objective.

Phases 1–3 total roughly 7–10 working days for a narrow prototype, assuming usable geometry and no major parser issues. This is a planning estimate, not a delivery commitment. Access to historical records and operational review can extend the schedule substantially.

## 8. Meaningful validation

- Parser fixtures: multi-line cells, renamed vessels, missing timestamps, decimal commas, malformed PDFs, changed layouts, and stale issue dates.
- Engine checks: deterministic event ordering; simultaneous reservations; closure timing; interrupted service policy; tug turnaround; no feasible berth; unfinished calls.
- Metric checks against hand-worked schedules, including horizon censoring.
- UI integration: seek/pause consistency, run isolation, scenario changes, missing data labels, and geographic failure fallback.
- Sensitivity experiments across plausible handling/travel durations. Explain conclusions that reverse under small assumption changes.
- Later historical validation: separate calibration and evaluation periods; do not use actual future departures to drive a purported forecast.

## 9. Historical-data request specification

For Bahía Blanca calibration, seek a CSV/XLSX export covering preferably 6–12 months, starting with a small sample:

- Call ID and IMO/MMSI where available, vessel name and dimensions.
- Terminal/site and all berth shifts.
- Actual anchorage arrival, berth arrival, handling start/end, berth departure, and port exit.
- Planned timestamps kept separately, ideally with revision times.
- Cargo/tonnage, tug assignment and service start/end, closures and their causes.
- Timezone, field definitions, missing-value conventions, coverage, and reuse conditions.

No request has been sent. Outreach, credentials, paid data purchases, recurring collection, and deployment are separate actions from writing this plan.

## 10. First coding task

Implement Phase 1's source snapshot manifest, PDF normalization, and a single evidence-labelled scenario. Then implement a two-vessel, one-berth hand-calculated engine fixture before adding geographic rendering. This establishes a defensible simulation foundation before visual polish.
