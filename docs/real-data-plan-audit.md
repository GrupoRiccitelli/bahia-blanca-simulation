# Audit of the real-data implementation plan

Date: 2026-10-06. Scope: the proposed next release, its frozen evidence, acquisition script and existing viewer/engine. No implementation or plan changes were made.

## Verdict

**Proceed with the source-backed snapshot viewer, subject to the P1 fixes below. Do not yet treat the plan as implementation-ready for continuous movement animation.** The separation of reported observations, published intentions and simulated outcomes is sound. The public PDFs support a useful report viewer and planned-milestone timeline; they do not establish a simultaneous operational snapshot, actual maneuver trajectories, completed-call history or predictive accuracy.

The static frontend + offline Python pipeline is appropriate. A backend, framework rewrite or optimization system is unnecessary. The main underestimated work is temporal reconciliation and decoupling presentation from synthetic engine output.

## Evidence verified locally

I checked both retained PDF pairs against their manifests, extracted text and rendered page 1 of each report. Both acquisition folders contain the same PDF hashes and byte counts stated in the plan. References below use repository-relative paths and one-based text/code lines; frozen data is ignored and remains local.

- Position page 1 reports **AGIOS LAZAROS at ADM, NORSE ADVANCE at TBB 9 and ELENA VE at Cargill**, with docking timestamps on October 4–5 (`data/raw/audit-2026-10-06/position.txt:10–14`). It has eight occupied main-table rows and eleven anchorage rows, not merely the three selected calls.
- Anchorage includes AQUASURAZO at **07:50** and BRAVE QUEST at **07:59** on October 6 (`position.txt:49–50`). The report is dated October 6 but supplies no precise observation/issue cutoff.
- VTS has **seven planned rows**, three inbound and four outbound, including CABO VIRGENES at OTA 2. Its footer is **06:58:33**. Two pilot times are **06:30**, earlier than that footer. Three outbound rows share **08:30** (`vts.txt:13–30`). The document explicitly warns that plans can change.
- All three inbound pilot/tug pairs differ by 2.5 hours. Position prose gives inbound intentions at 08:30/11:30, while VTS tug times are 09:00/12:00. These are differently worded milestones, not verified contradictory actual berth arrivals.
- **Both PDFs say C FORCE.** The asserted `C FORCE I` discrepancy at `docs/real-data-implementation-plan.md:64` is not present in these frozen sources, including their rendered pages.
- VTS contains nine distinct printed tug labels. Some appear shortened; the position report also lists tug names under “reparaciones o alistamiento” (`position.txt:127–132`). Neither list proves service availability, and the shared heading does not establish that every listed tug is unavailable.

The certificate failure and Monitor's current accessibility were not independently retested in this audit; those remain findings of the earlier acquisition investigation, not fresh verification. No network access was needed for the PDF findings. No private/third-party HTML credentials are reproduced.

## Prioritized findings and fixes

### P1 — Define the time model before assembling an initial state

**References:** real-data plan:36, 43–45, 76, 115–131; frozen times above.

The plan recognizes non-atomic reports but still proposes “initial observations” followed by playback without defining what instant the initial scene represents. Using midnight shows later observations too early; using the VTS footer backdates the 07:59 observation; using retrieval time puts every published movement in the past without confirming completion. Even 07:59 is only a recorded event time, not a verified snapshot cutoff. Exact initial waiting ages are therefore not currently supportable as observed metrics.

**Fix:** make the first scene a **report-dated observation board with unknown cutoff**. Keep its placement assertions separate from the plan timeline. Declare a playback interval and an explicit assumed origin only if animation is required. Store separately (a) event time, (b) observation/report validity interval, (c) issue time and (d) retrieval time. A plan already dated before its issue remains a plan; a later timestamp on the UI clock must not confirm it. Unknown post-event vessel location needs a visible state rather than indefinite “current” berth occupancy. Any initial wait age must be bounded or explicitly calculated at an assumed reference instant.

**Gate:** reviewed examples for 06:30, 06:58:33, 07:59 and 08:30; backwards seeking and end-of-coverage states; no false exact observation cutoff or completed movement.

### P1 — A replay adapter alone cannot isolate synthetic semantics

**References:** plan:94–95, 117–131; `src/app.js:4–7, 18–23, 27–55`; `src/port3d.js:3, 86, 105–137`; `src/engine.js:30–38, 106–113`; `index.html:7–24`.

The application and renderer consume engine jobs directly. They assume numeric IDs, fixed 48-hour bounds, known arrivals/service ends, handling states and synthetic metrics. The renderer imports `stateAt`, creates exactly three tugs, derives beam from length, and retains ship meshes across runs. Changing datasets can leave old ships visible or reuse a hull with the wrong dimensions. A source-only `replay.js` will not fix these behaviors by itself.

**Fix:** add an explicit presentation contract shared by adapters: dataset/mode ID, arbitrary stable entity IDs, optional observed dimensions, state and evidence status, nullable/interval milestones, display pose provenance, dynamic time bounds, and metric availability. Renderer updates must reconcile additions/removals and changed dimensions; planned tug assignments can initially be textual rather than animated resource reservations. Add observed-alongside/unknown states without mapping them to loading or departure-ready. Make labels, export payloads, controls, legends and empty states mode-specific. Render source text safely rather than inserting it unescaped into current `innerHTML` templates.

**Gate:** synthetic → source → synthetic switching leaves no stale objects, metrics, assumptions or selection; repeated seeks are deterministic; missing beam/time/selection and WebGL failure remain usable; source exports retain provenance and contain no synthetic baseline.

### P1 — Specify how ambiguous milestones become display transitions

**References:** plan:61, 74, 124–131; `vts.txt:10–25`; `position.txt:53–57`.

`ENTRADA`/`ZARPADA` identify movement direction; the timestamps are in pilot and tug columns. They do not by themselves define berth release, berth arrival or port exit. The proposed event vocabulary risks assigning stronger meanings than the source provides, especially to outbound pilot time. Unknown durations also prevent interpreting repeated tug assignments as actual conflicts.

**Fix:** preserve a movement-intention record containing direction, terminal and typed pilot/tug milestones. Preserve position prose as its own assertion. Add explicit review decisions linking records; do not choose a silently preferred time or generate duplicate maneuvers from both sources. Until movement definitions are confirmed, present timeline markers and optional illustrative transitions whose endpoints/durations are tagged assumed. Planned transitions must never overwrite the reported-state layer.

**Gate:** all seven intentions survive; simultaneous plans remain simultaneous; no tug duration, berth release, channel transit or port exit is inferred as observed; ambiguous and unmatched records remain inspectable.

### P2 — Correct the alias claim and enumerate normalization coverage

**References:** plan:64, 108–113; `position.txt:68–145`.

The concrete C FORCE alias claim needs correction. General alias review is still warranted, particularly for terminals and shortened tug labels. “Parse pages 1–3” and “zero silent row loss in selected scope” do not define how announcements, totals, blank berth rows and narrative repair lists are accounted for. For example, page 2 has undated AURIGA STAR and OSSA; page 3 repeats AS SILJE on four dates with differing lengths, has `200-200` container entries, and contains a suspicious `1/9/2206` date. Uniform tonnage conversion, forward-filling dates or name deduplication would corrupt these records.

**Fix:** create a section/row coverage inventory with parsed, retained-unparsed, excluded-with-reason and reviewed counts. Distinguish vessel identity, source row and candidate call IDs. Add fixtures for those actual patterns and for `STIO 2-3/TBB 9` as an unresolved/multiple terminal destination. Keep quantities with uncertain units raw. List which anchorage vessels are displayed: all eleven or the five assigned to the three selected terminals. Account for all other rows as context/exclusions. Freeze expected counts to the audited hash, not every future report.

### P2 — Add reproducible assembly and loader gates

**References:** plan:70–80, 90–102, 108–113; `scripts/fetch_sources.py:19–44`; `README.md:7–14, 31`.

The fetcher correctly rejects oversize/non-PDF responses and records per-source failures, but scenario assembly has no specified CLI or approval artifact. A manifest can contain one successful PDF plus errors; downstream consumers must reject incomplete required pairs. Raw hashes alone do not reproduce parser decisions or manual reconciliation. PDF parsing also introduces dependencies absent from the current Python-only run instructions.

**Fix:** specify a normalize → validate → reviewed-assembly command sequence, parser/tool versions, immutable override file with reasons/reviewer state, schema version, source hash verification, and deterministic output hash. Record scope/coverage, assumptions and alias-table versions in exports. Make the loader reject unknown schema versions, broken references, invalid time bounds and required-source failures. Define stale/mismatched report-date handling as a warning or review block; successful HTTP retrieval is not freshness. Document Poppler/other parser requirements and how a local bundle is selected without committing ignored data. Add failure tests for corrupt PDF, incomplete manifest, missing bundle and unknown schema. Keep full raw reports local pending the existing reuse decision.

The fetch timeout is a socket-operation timeout, not a strict 25-second wall-clock deadline; do not describe it as a hard total runtime bound. Full process-crash recovery is optional for this manual first release.

### P2 — Make metric eligibility explicit and separate E's deliverables

**References:** plan:44, 122, 131, 142–149; `src/engine.js:95–103`; `src/app.js:18, 38`.

Suppressing synthetic metrics is correct but needs a mode-level allowlist. With these reports, reported vessel/plan counts and source coverage are defensible; measured utilization, completed-call turnaround, remaining cargo, loading rate and precise current wait age are not. “Exclude unobserved elapsed portions” can also hide censoring bias if a resulting partial average is labeled full-call waiting time.

**Fix:** define each metric's required events, numerator, denominator, interval/censoring treatment and label. Show unavailable values as unavailable, never zero. For E, separately scope an assumption-driven demonstration and a calibrated predictor. The former can proceed with reviewed remaining-service assumptions; the latter needs actual history, resource/closure coverage, held-out validation and operator review. Require initial-state reservations, unfinished-call accounting, terminal compatibility, and cutoff-based forecast data selection in E's tests.

## Delivery estimate and ordered next steps

The stated **3–5 working days** is plausible only for one frozen layout, substantial manual review and a narrow snapshot/marker viewer. It is optimistic for the complete definition of done with normalization across all sections, field-level provenance, robust mode isolation and animated plans. An engineering planning allowance of **5–8 working days for one developer** is more credible: 1.5–2 days schema/normalization/reconciliation, 1.5–2 days viewer/renderer separation, 1–2 days milestone playback, and 1–2 days integration/QA. This is an audit judgment, not measured productivity or a commitment. Historical access remains unbounded. E's 2–4 days should cover only a narrow modeled prototype, not calibration or validated channel/tug rules.

1. Correct C FORCE and approve a temporal/display policy; define scope and milestone mappings.
2. Implement schema, coverage inventory, normalization and versioned review overrides against frozen bytes.
3. Add the renderer-neutral snapshot adapter, dataset loader and mode-switch/export tests.
4. Release the observation board and plan markers after row-by-row review; add animation only when its explicit assumption contract passes the P1 gates.
5. Pursue actual-history access separately. Retain the plan's existing prohibition on predictive claims before validation.

The revised approach is fundamentally useful and appropriately cautious. Closing these gaps makes its caution enforceable in code and UI rather than dependent on explanatory prose alone.
