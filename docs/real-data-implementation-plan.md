# Real-data Bahía Blanca implementation plan

Audit date: 2026-10-06. Revised after [Astra’s audit](real-data-plan-audit.md). Decision: proceed with a source-backed snapshot and planned-movement visualization. A complete historical actual-event replay is not yet supported by the verified public sources. This document supersedes the acquisition and architecture sequence in the original implementation plan for the next release. The existing synthetic demo remains available as a separate scenario.

## Release implementation status · 2026-10-06

A–C are implemented for the frozen audited 2026-10-06 hashes: source contract, normalization and full nonblank-row inventory, approved review validation, deterministic assembly, renderer-neutral adapters, local bundle import, report-dated observations and typed planned-milestone timeline. The normalized bundle contains 19 observations (eight in the detailed scene), seven VTS intentions and 131 inventory rows. Raw and normalized files remain local and ignored. JavaScript and Python checks plus repeat assembly passed; see [verification](verification.md) for actual commands and browser results.

This is a deliberately narrow parser: other source bytes fail closed, and nonempty manual overrides or linked-intention decisions are rejected until implemented. Continuous route animation, live collection, historical actual replay, E1 real-data what-if and E2 calibrated prediction remain deferred. The sections below preserve the product policy, rationale and future acceptance gates; their original “proposed” language describes the planning baseline.

## 1. What we can honestly build

The first release will show a report-dated observation board with an unknown observation cutoff, real vessel dimensions where available, and a separate timeline of published movement intentions. Continuous route animation is a later increment requiring the explicit assumptions and gates below. It must be titled “Operación publicada + movimientos previstos,” not “historical actual replay.” A separate what-if run can start from that evidence and simulate the unobserved future. Neither view may claim measured loading progress or measured navigation tracks.

Three tiers have different data gates:

| Product | Data required | Current decision |
|---|---|---|
| Published snapshot + planned movements | Position report, VTS plan, explicit event meanings and missing-data labels | Feasible now with reconciliation |
| Historical actual replay | Actual berth arrival/departure and call identity across a documented period | Not yet verified; blocked on completed-call records |
| Calibrated what-if/prediction | Actual history plus handling/resource/closure observations, validation period | Not ready; simulated assumptions must remain visible |

“All the data” is unnecessary for the first tier. It is necessary to obtain additional evidence before claiming either of the other two tiers.

## 2. Sources checked and reproducible evidence

Direct HTTPS downloads succeeded at approximately 2026-10-06 16:22:56 UTC. PDFs were extracted with Poppler and page 1 of each visually inspected. Raw bytes, HTML, extracted text and retrieval manifest are retained locally in ignored `data/raw/audit-2026-10-06/`. The mutable URLs do not provide permanent historical versions.

| Source | Current verification | Role |
|---|---|---|
| [Daily position report](https://puertobahiablanca.com/situacion_operativa/posicion.pdf) | Three-page PDF dated 06-10-2026; reported alongside/anchorage state, dated berth and anchorage arrivals, cargo, tonnage, date-level announcements | Initial conditions and observations |
| [VTS movements](https://puertobahiablanca.com/vts/movimientos.pdf) | One-page PDF issued 06-10-2026 06:58:33; seven planned movements, pilot times, terminal, dimensions and named tug assignments | Planned events, never actual completions |
| [Monitor Puerto](https://puertobahiablanca.com/monitor-puerto.html) | HTML available; referenced application JS fails certificate hostname validation | Potential AIS/history source remains inaccessible through verified path |
| [Monitor launch](https://puertobahiablanca.com/novedades/lanzamiento-aplicacion-monitor-puerto.html) | Announcement dated 26-10-2020 describes historical downloads and port antenna position data | Evidence of intended feature, not a working export/API |
| [Statistics directory](https://puertobahiablanca.com/estadisticas.html) | Official public directory found; terminal aggregates identified in search | Context only; no verified completed-call event history |

PDF fingerprints:

- Position: SHA-256 `66c51b93bfd2d16f5921bd2f3e4ddbb3bb69093f2f4e112189201106ab79570a`, 619818 bytes.
- VTS: SHA-256 `e4acbcc8f666b4fec4551127a9131f87bfb1a1bda71994a6271d76d86d801a3f`, 157718 bytes.

Search-indexed versions differ in dates from direct downloads. Retrieval time, document issue time and event time are separate fields. The daily report has a date but no verified precise issue time; do not assign it the VTS issue time. In particular, its anchorage list contains later morning observations than the VTS publication timestamp. The two files are not an atomic snapshot.

## 3. Coverage and blockers

| Required field | Evidence available | Missing or ambiguous | Implementation consequence |
|---|---|---|---|
| Vessel identity | Published names, flags, dimensions | No verified IMO/MMSI/call IDs | Internal source-scoped IDs; review aliases; name alone cannot join long history |
| Initial berth occupancy | Named berth and reported docking timestamp | Exact snapshot issue time; shift history | Show source-dated state, preserve uncertainty |
| Anchorage waiting | Arrival timestamps and anchorage labels | Full subsequent history and berth-ready time | Exact current wait age unavailable; only bounds or an estimate at an explicit assumed reference instant |
| Future arrivals | Announced dates | Time of day, cancellations/revisions | Date intervals; no fabricated midnight timestamps |
| Movement intent | Pilot and tug times, direction, terminal | Actual maneuver start/end, confirmation | Retain separate planned event types |
| Berth departures | Planned departures only in checked day | Actual berth release/port exit | No measured completed-call turnaround |
| Handling | Cargo and stated tonnage | Start/end, remaining tonnage, rates | Alongside state means “alongside,” not measured active loading |
| Tugs | Named planned assignments | Fleet inventory, availability, service ends, capability | Show assignments; no measured tug utilization |
| Shared channel | Other movement plan rows | Complete traffic, segment rules, movement durations | Outside-terminal rows retained; simplified constraints for what-if only |
| Geography | Terminal names; existing illustrative scene | Verified berth coordinates, routes and actual AIS tracks | Geometry/route interpolation remains labeled illustrative |
| Navigation/weather | Separate port context/depth sources | Draft per call, clearance rules, closure events and operational review | Defer clearance/physics/weather prediction |
| Rights/time semantics | Public reports | Reuse terms and explicit timezone definitions | Keep raw datasets local; record timezone as a modeling assumption until confirmed |

Monitor's asset certificate mismatch prevents confirming its historical export. No certificate bypass or undocumented authenticated API probing is warranted. A targeted port data request is the practical path to actual history if the public interface remains unavailable. This is an access gap, not evidence that the history does not exist.

## 4. Reconciliation findings that change the model

1. The three displayed terminals are already occupied in the published snapshot. The existing engine assumes empty berths and nonnegative arrivals; merely replacing fictional vessel names would be wrong. Carry-in occupancy, unknown remaining service and left-censored calls need explicit support.
2. VTS inbound pilot time precedes tug time by 2.5 hours in the inspected entries. These timestamps describe different milestones; do not treat this as measured total channel transit or service duration.
3. Daily-report movement prose and VTS tug times differ. Retain both assertions with their event types and source versions; do not overwrite one with the other or collapse them into a single exact berth-arrival time.
4. Multiple planned movements share a timestamp. The demo's single channel lock across an entire maneuver cannot reproduce that plan. Replay must display source events without enforcing synthetic scheduling; operational what-if constraints require a separate, validated model.
5. The VTS names more tugs than the synthetic three-tug fleet. Named assignments do not establish full-day availability. The simple length-to-tug-count rule must not override reported assignments in evidence playback.
6. Both frozen PDFs say `C FORCE`; the earlier `C FORCE I` discrepancy was unsupported and is corrected here. Alias review still applies to terminal names, shortened tug labels and future reports.
7. A departure at another terminal appears in VTS. It cannot be discarded when modeling shared resources. Retain all seven plan rows even if only three terminals receive detailed 3D geometry.
8. A blank berth row or absence of a vessel from a later PDF is not proof of a precise departure event. Changes between snapshots establish observation intervals at best.

## 5. Temporal and milestone policy

The observation board represents assertions in the dated position report, not the port at midnight, the VTS issue time, 07:59, or retrieval time. Its heading is “Posiciones publicadas · 06-10-2026 · hora de observación desconocida.” Keep report placement separate from time playback. No clock advancement confirms a plan or establishes a vessel’s later location.

The plan timeline spans the earliest to latest published milestone in the selected bundle; it is not fixed at 48 hours. Two pilot milestones at 06:30 precede the VTS issue at 06:58:33; position observations include a 07:59 arrival. Preserve all three facts without inventing a common cutoff. Source event time, observation validity bounds (nullable), issue time and retrieval time are distinct.

In the first release, seeking highlights planned markers and leaves the report board explicitly report-dated. Do not describe its placements as current at the seek time. A later animated overlay must declare an assumed origin, transition endpoints and duration, keep the observation layer intact, and show unknown post-event location/end-of-coverage state. Reset and backward seek reconstruct the same overlay deterministically.

Each VTS row is a movement intention with direction, terminal, typed pilot and tug milestones. `ENTRADA`/`ZARPADA` do not convert those column times into berth arrival, berth release or port exit. Daily-report prose is a separate assertion. Versioned review decisions may link assertions but must retain their original meanings and unresolved differences. No duplicate maneuvers or silent preferred timestamp. Unknown tug durations cannot establish an actual assignment conflict. Simultaneous intentions remain simultaneous.

Gate examples: 06:30, 06:58:33, 07:59 and 08:30; backwards seeking; absent future confirmation; coverage end; no calculated exact observed wait age. Any reference-instant estimate must be labeled assumed, with its inputs and bounds.

## 6. Data contract

Use a source assertion layer before a scenario layer. Each field/event stores source snapshot SHA-256, page, section, row/coordinate reference, original text, parsed value, units, precision and quality warnings. Separate:

- `evidence`: reported / derived / assumed / simulated.
- `status`: observation / planned / confirmed_actual / unknown.
- `event_type`: reported_anchorage_arrival / reported_berth_arrival / planned_pilot_time / planned_tug_time / movement_intention / narrative_intention; confirmed actual berth departure/port exit types require later evidence. Preserve source wording and direction separately.
- `time`: original local string, date or datetime precision, earliest/latest bounds, timezone and timezone evidence.
- `observed_at`, `observation_validity_bounds` and `issued_at`: nullable; retrieval time never substitutes for any of them.

Names, terminals and tugs use explicit versioned alias tables. Decimal commas and thousands periods require column-specific parsing. Cargo tonnage is not automatically remaining cargo. Conflicting dimensions stay as separate measurements with a documented display preference; hull identity is not inferred from rounded length.

Scenario bundle: schema version, scenario kind, source fingerprints, coverage interval, initial observations, selected terminal scope, all relevant external movements, assumptions, unresolved issues, and event assertions. Replay output and simulated runs have distinct IDs and modes. A bundle must never silently fall back to synthetic records when acquisition or parsing fails.

Normalize to UTC only with an explicit timezone interpretation. Use Argentina time in the UI, with a visible assumed-timezone flag until publisher semantics are confirmed. Date-only announcements remain full-day intervals.

## 7. Implementation using the existing project

Retain the current static frontend, JavaScript engine and locally bundled Three.js. Add Python only for offline acquisition/PDF normalization; no backend service, React rewrite, database or RL integration is needed for the first real-data release.

Proposed additions:

```text
scripts/fetch_sources.py       # implemented starter: bounded manual HTTPS fetch + hashes
scripts/normalize_reports.py  # PDF section/column parsers and review output
schemas/source-bundle.json    # evidence and event contract
src/source-data.js            # bundle validation and loading
src/view-state.js             # renderer-neutral presentation contract
src/synthetic-adapter.js      # synthetic engine output -> presentation state
src/replay.js                 # report board / plan markers -> presentation state
scripts/validate_bundle.py    # hash, schema, reference and coverage checks
scripts/assemble_bundle.py    # deterministic reviewed bundle assembly
scenarios/                    # approved manifests/assumptions; source-derived bundles local initially
tests/fixtures/              # small constructed PDF/text cases, no full raw report redistribution
data/raw/                    # immutable snapshots, ignored
data/normalized/             # normalized assertions, ignored
```

`fetch_sources.py` stores each fetch in a fresh timestamped directory, verifies PDF MIME and magic bytes, caps responses at 10 MiB, uses certificate validation and a 25-second socket-operation timeout (not a hard total runtime deadline), and returns failure if any required source fails. It records missing issue/timezone metadata rather than inventing values. This is manual acquisition, not a recurring collection service.

### Presentation contract and mode isolation

`app.js` and `port3d.js` currently consume synthetic jobs directly. Refactor them to consume a renderer-neutral view state before adding source data. The contract includes dataset/mode ID, arbitrary stable entity IDs, optional measured dimensions, display state and evidence status, nullable/interval milestones, pose provenance, dynamic time bounds, selected entity and metric eligibility.

States include reported-alongside, reported-anchorage, planned milestone and unknown. Reported-alongside must not become active loading or departure-ready. Missing beam may use an explicitly assumed visual proportion; missing length uses a marked generic hull. The renderer must reconcile removed/new entities and changed dimensions, dispose obsolete meshes/labels, and clear invalid selection on dataset switch. Source mode has textual named tug assignments initially, not the three synthetic tug models.

Make titles, legends, clock bounds, controls, assumptions, exports, metrics and empty states mode-specific. Disruptions remain disabled in source mode. Insert source strings as text, not unescaped `innerHTML`. WebGL failure must leave provenance and timeline usable. Source exports contain no synthetic baseline.

### Scope and coverage inventory

Display the three occupied ADM/TBB 9/Cargill vessels and the five anchorage vessels assigned to those terminals in the detailed scene. Keep all eleven anchorage rows and all eight occupied main-table rows in the evidence inventory; the remaining rows appear as outside-scope context rather than disappearing. Retain all seven VTS intentions, including OTA 2, and all announcements/repair narratives as parsed records or retained-unparsed context. Geography remains illustrative.

Every section/row gets a disposition: parsed, retained-unparsed, excluded-with-reason, plus review status. Totals and blank berth rows are accounted for separately from vessel calls. Expected counts are fixtures tied to the audited hashes, not permanent assumptions about future reports.

Fixtures must cover undated AURIGA STAR/OSSA, AS SILJE’s four dates and differing lengths, `200-200` container quantities, suspicious `1/9/2206`, and unresolved `STIO 2-3/TBB 9`. Never forward-fill dates, deduplicate calls by name, silently correct suspect dates, or convert uncertain quantities to tonnes. Vessel ID, source-row ID and candidate call ID are distinct.

### Reproducible acquisition to reviewed assembly

The following CLI workflow is implemented for the frozen audited source hashes:

```bash
python3 scripts/fetch_sources.py
python3 scripts/normalize_reports.py --manifest <snapshot/manifest.json> --output <normalized-folder>
python3 scripts/validate_bundle.py --input <normalized-folder> --review <review.json>
python3 scripts/assemble_bundle.py --input <normalized-folder> --review <review.json> --output <bundle.json>
```

Use Poppler for text/coordinate extraction and PDF rendering; record its version, Python version and parser version. Document installation prerequisites separately from the existing Python-only fetch command. Avoid adding further parser dependencies unless representative layouts require them.

A versioned review file records reviewer state, aliases, linked intentions, overrides, reasons, scope and assumptions. Preserve the original assertions; superseding reviews produce new versions. Require both source snapshots, no required-source errors, verified saved-byte hashes and completed review of scene records before assembly. An incomplete fetch manifest cannot produce a release bundle.

Assembly produces a deterministic bundle hash covering normalized assertions, parser version, schema, alias/review versions, scope and assumptions. Report-date mismatches block assembly pending an explicit reconciliation decision. Freshness is measured against a declared use/reference date, not HTTP success; a historical bundle remains valid as historical, while its current-data label is prohibited. Unknown cutoff is always visible.

The browser loads a local JSON file chosen by the user, avoiding mandatory commits of ignored datasets. Loader validates supported schema version, required sections, IDs, references, numeric bounds, time intervals, metric eligibility and required-source manifest status. Acquisition/assembly validates raw hashes; a locally imported bundle is structurally validated and marked as locally reviewed, not cryptographically authenticated by the publisher. Exports preserve provenance and review/bundle hashes. Missing files or invalid data show actionable errors without synthetic substitution.

## 8. Ordered work and acceptance gates

### A. Schema, normalization and reconciliation (1.5–2 working days)

Implement evidence/time contracts, source hash checks, section coverage, normalization and reviewed-assembly commands against frozen bytes. Review every displayed row against rendered PDFs. Document dependencies and review workflow.

Gate: all seven audited VTS rows survive; full section inventory reconciles; missing/uncertain fields remain explicit; incomplete manifests, corrupt PDFs, HTML responses, suspect dates and unsupported layouts cannot silently assemble a bundle. Temporal examples in section 5 pass.

### B. Renderer/UI separation and observation board (1.5–2 working days)

Implement the shared display contract, synthetic adapter, source loader and source-only observation board. Show report dates, unknown cutoff, dimensions/cargo and provenance in Spanish. Keep synthetic demo behavior in its own adapter.

Gate: synthetic → source → synthetic switches remove stale objects, hull dimensions, selections, metrics and assumptions. Test string IDs, missing length/beam/time, absent selection, missing bundle, unknown schema, broken references, invalid bounds and WebGL fallback. Source text is escaped; source exports contain provenance and no synthetic results.

### C. Published milestone timeline (1–2 working days)

Display linked intentions and typed milestones independently of reported placements. Dynamic time bounds derive from the bundle. Ambiguous/unmatched assertions remain inspectable; simultaneous plans are preserved. Play/seek highlights markers without implying completion.

Gate: deterministic repeated/backward seeking and coverage-end behavior; no pilot/tug timestamp creates an observed berth transition, service duration or port exit. Optional continuous animation is deferred until its explicit assumed endpoint/origin/duration contract meets the section 5 gates; it is not needed for this release.

### Integration and QA (1–2 working days)

Run parser failure fixtures, deterministic assembly/hash checks, row-by-row source review, mode-switch/export tests and narrow/desktop visual verification. Document every residual issue and confirm metric allowlists. Planning allowance for A–C plus QA: **5–8 working days for one developer**, based on Astra’s judgment, stable frozen layouts and a milestone viewer. This is not a commitment, an estimate for historical access, or a validated predictor.

### D. Obtain actual history (external dependency; duration unknown)

Recheck Monitor when accessible or request a 7–14-day completed-call sample from the port. Needed: call IDs, vessel identifiers, actual anchorage/berth arrivals, berth departures/port exits, shifts, timezone definitions, coverage and reuse terms. Request handling/tug logs separately. No outreach or recurring collection is currently configured.

Gate: continuous selected period has confirmed actual events for completed calls, explicit missing/carry-in/unfinished cases, and documented identities/time semantics. Observed changes alone establish bounded transition intervals, never invented precise events.

### E1. Assumption-driven what-if prototype (2–4 working days after suitable reviewed inputs)

Extend the engine with occupied initial berths, pre-origin arrivals, reservations, terminal compatibility, unfinished calls and explicitly assumed remaining-service ranges/resource constraints. Initial observed occupancy is separate from modeled service. Named assignments apply only where their modeled meaning is defined. Test initial resource conflicts, censoring and sensitivity to assumptions. This estimate covers a narrow demonstration, not calibration or validated channel/tug rules.

Gate: hand-worked carry-in/resource/compatibility cases pass; assumption changes and their effects are inspectable; all outputs labeled modeled. Unknown inputs cannot silently become observed rates or availability.

### E2. Calibrated prediction (separate scope; estimate after history review)

Require actual history, resource and closure coverage, operator-reviewed rules and calibration/evaluation periods. Enforce a forecast cutoff: future observations cannot initialize remaining service or supply forecast outcomes. Validate against held-out actual events and report errors/censoring before predictive claims. Historical replay may use future outcomes solely as replay evidence.

## 9. Metric eligibility

| Mode/metric | Required inputs and calculation | Eligibility |
|---|---|---|
| Reported vessel count | Count distinct source rows within named section/scope; no inference of unique lifetime hulls | Available with section and scope label |
| Plan count | Count reviewed VTS intention rows, not individual pilot/tug markers | Available; seven for audited hash |
| Coverage | Reviewed/parsed/context/excluded row counts divided by inventoried eligible rows, with separate dispositions | Available; does not measure real-world traffic completeness |
| Wait age at reference instant | Reference time minus reported anchorage arrival; interval subtraction for bounded times | Assumed-reference estimate only; unavailable as exact current observed wait |
| Actual waiting/turnaround | Defined actual arrival and inbound/exit endpoints per call; mean uses eligible completed calls | Unavailable now; later show eligibility count and left/right censoring separately |
| Berth utilization | Confirmed occupied intervals clipped to analysis window / verified berth-hours | Unavailable now; gaps/unknown occupancy cannot count as empty |
| Tug utilization | Confirmed service intervals / documented available tug-hours | Unavailable now; assignment names alone insufficient |
| Loading rate/progress/remaining cargo | Verified handling times and loaded/remaining quantity definitions | Unavailable now |
| Synthetic/model metrics | Existing synthetic inputs, or explicit E1 assumptions; defined window and denominators | Available only in corresponding modeled mode |

Unavailable values display “No disponible,” never zero. No full-call average is inferred by omitting unobserved elapsed portions. Later actual metrics must state endpoint definitions, eligible denominator, excluded reasons, uncertain intervals and censoring counts. Observed and modeled metrics never share an unlabeled denominator.

## 10. Definition of done and next task

The user can select a local reviewed real-data bundle, see report-dated vessels at three illustrative terminal locations and selected anchorage placements, inspect all source context and provenance, and browse a separate planned-milestone timeline. Unknown observation cutoff and future outcomes are visible. Source mode shows only eligible counts/coverage, has no disruption controls, and exports its evidence. Switching back restores the synthetic demo cleanly.

A–C now exist for the frozen audited PDFs. Next work is reviewed support for additional report versions and deliberate override/linking semantics, followed by the separately gated increments for continuous animation, actual history and prediction.
