# Real-data Bahía Blanca implementation plan

Audit date: 2026-10-06. Decision: proceed with a source-backed snapshot and planned-movement visualization. A complete historical actual-event replay is not yet supported by the verified public sources. This document supersedes the acquisition and architecture sequence in the original implementation plan for the next release. The existing synthetic demo remains available as a separate scenario.

## 1. What we can honestly build

The first release will reconstruct a published port snapshot, show real vessel dimensions where available, and animate published movement intentions with explicit interpolation. It must be titled “Operación publicada + movimientos previstos,” not “historical actual replay.” A separate what-if run can start from that evidence and simulate the unobserved future. Neither view may claim measured loading progress or measured navigation tracks.

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
| Anchorage waiting | Arrival timestamps and anchorage labels | Full subsequent history and berth-ready time | Initial wait age can be shown; final wait cannot be measured yet |
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
6. One candidate name differs between reports (`C FORCE I` versus `C FORCE`). Treat it as an alias candidate requiring review, not automatic fuzzy matching.
7. A departure at another terminal appears in VTS. It cannot be discarded when modeling shared resources. Retain all seven plan rows even if only three terminals receive detailed 3D geometry.
8. A blank berth row or absence of a vessel from a later PDF is not proof of a precise departure event. Changes between snapshots establish observation intervals at best.

## 5. Data contract

Use a source assertion layer before a scenario layer. Each field/event stores source snapshot SHA-256, page, section, row/coordinate reference, original text, parsed value, units, precision and quality warnings. Separate:

- `evidence`: reported / derived / assumed / simulated.
- `status`: observation / planned / confirmed_actual / unknown.
- `event_type`: anchorage_arrival / berth_arrival / pilot_boarding / tug_service / berth_departure / port_exit, with source wording preserved.
- `time`: original local string, date or datetime precision, earliest/latest bounds, timezone and timezone evidence.
- `observed_at` and `issued_at`: nullable; retrieval time never substitutes for either.

Names, terminals and tugs use explicit versioned alias tables. Decimal commas and thousands periods require column-specific parsing. Cargo tonnage is not automatically remaining cargo. Conflicting dimensions stay as separate measurements with a documented display preference; hull identity is not inferred from rounded length.

Scenario bundle: schema version, scenario kind, source fingerprints, coverage interval, initial observations, selected terminal scope, all relevant external movements, assumptions, unresolved issues, and event assertions. Replay output and simulated runs have distinct IDs and modes. A bundle must never silently fall back to synthetic records when acquisition or parsing fails.

Normalize to UTC only with an explicit timezone interpretation. Use Argentina time in the UI, with a visible assumed-timezone flag until publisher semantics are confirmed. Date-only announcements remain full-day intervals.

## 6. Implementation using the existing project

Retain the current static frontend, JavaScript engine and locally bundled Three.js. Add Python only for offline acquisition/PDF normalization; no backend service, React rewrite, database or RL integration is needed for the first real-data release.

Proposed additions:

```text
scripts/fetch_sources.py       # implemented starter: bounded manual HTTPS fetch + hashes
scripts/normalize_reports.py  # PDF section/column parsers and review output
schemas/source-bundle.json    # evidence and event contract
src/source-data.js            # bundle validation and loading
src/replay.js                 # observation/plan playback independent of scheduler
scenarios/                    # approved manifests/assumptions; source-derived bundles local initially
 tests/fixtures/              # small constructed PDF/text cases, no full raw report redistribution
 data/raw/                    # immutable snapshots, ignored
 data/normalized/             # normalized assertions, ignored
```

`fetch_sources.py` stores each fetch in a fresh timestamped directory, verifies PDF MIME and magic bytes, caps responses at 10 MiB, uses certificate validation and a 25-second timeout, and returns failure if any required source fails. It records missing issue/timezone metadata rather than inventing values. This is manual acquisition, not a recurring collection service.

## 7. Ordered work and acceptance gates

### A. Acquire and normalize (estimate: 1–2 working days)

- Fetch frozen reports and keep manifests; parse position pages 1–3 and all VTS rows by section and column coordinates.
- Extract issue/date fields, maintain all external movements, report unparsed rows and alias candidates.
- Build a per-field coverage report; review every row used in the three-terminal scenario against rendered source.
- Test multiword names, decimal formats, blank dates, continuation rows, changing layouts, stale reports and HTML returned as a PDF.

Gate: zero silent row loss in the selected scope; all seven audited VTS rows retained; source-backed fields have page/row references; missing dates stay missing. Parser failures stop scenario assembly.

### B. Publish a source-backed snapshot viewer (estimate: 1 working day)

- Add a data selector: synthetic demo versus published snapshot.
- Real names, berth positions, published lengths/cargo and initial waiting observations replace fictional inputs only in the selected mode.
- Add provenance, report dates, retrieval dates, coverage warning, uncertainty and planned/observed badges in Spanish.
- Keep ships without complete movement events in their observed state; do not invent departures to fill 48 hours.

Gate: the visual snapshot matches reviewed source rows; selecting any displayed field reveals its evidence; synthetic metrics are absent in source-only mode.

### C. Animate published plans (estimate: 1–2 working days)

- Add a replay adapter for source events, separate from `simulate()`.
- Preserve pilot/tug/departure milestones. Illustrative route transitions require an assumption interval and separate styling; ambiguous times remain timeline annotations rather than forced paths.
- Show movements beyond modeled terminals as context; do not enforce synthetic channel serialization on source plans.
- Disable disruption controls in replay; expose a distinct “create modeled scenario” workflow later.

Gate: playback and seeking preserve source status/uncertainty; no planned event becomes actual; no complete turnaround, utilization or loading-rate metrics appear without sufficient observations.

### D. Unlock actual history (external dependency; duration unknown)

- Recheck the public Monitor interface when available, or obtain a small completed-call export directly from the port.
- Ask for 7–14 days first, including the day selected for playback: call IDs, vessel identities, anchorage and berth arrivals, berth departures and port exits, shifts, timestamp definitions/timezone, coverage and reuse terms.
- Request handling start/end and tug-service logs separately for later modeling. Do not wait for those to build actual berth-event replay if core records suffice.
- Require actual arrival/departure timestamps for every completed call used in replay. Keep unfinished/carry-in jobs and interval observations explicit.

Gate: a selected continuous period is supported by confirmed actual events, all gaps counted, and future knowledge is used only in replay. No outreach has been sent.

### E. Add evidence-initialized what-if simulation (estimate: 2–4 working days after suitable inputs)

- Extend engine for occupied initial berths, negative historical arrivals, unknown remaining service, terminal compatibility and source-backed tug assignments where meaningful.
- Define remaining-service distributions/ranges, channel segmentation and tug availability explicitly; run sensitivity scenarios before claiming operational effects.
- Metrics use observed or modeled denominators consistently; exclude unobserved elapsed portions visibly rather than producing misleading full-call averages.
- Keep historical replay separate from a forecast initialized at a declared cutoff. Future actual departures cannot be used to drive forecast service times or evaluate on the calibration set.

Gate: hand-worked carry-in/resource cases pass; replay matches evidence; what-if assumptions inspectable; predictive claims require held-out historical error measurements and operator review.

A–C estimate: 3–5 working days for a source-backed snapshot/plan viewer, assuming stable layouts. This is not an estimate for obtaining historical access or a validated predictive simulator.

## 8. Definition of done for the next release

The user can open the current viewer, choose a real published dataset, see real vessels at the three terminals and anchorage, inspect source facts and planned events, and replay only the supported milestones. Every interpolation/assumption is visible, missing future outcomes remain unknown, and the synthetic example is separately labeled. A later actual-history bundle uses the same evidence contract without relabeling plans as truth.

## 9. Next concrete task

Implement `normalize_reports.py` and the evidence schema against the frozen audit PDFs, then ship the snapshot mode before animation. Do not start by feeding extracted rows into `createScenario()`: its empty-start assumptions and invented service durations would turn real names into misleading synthetic outcomes.
