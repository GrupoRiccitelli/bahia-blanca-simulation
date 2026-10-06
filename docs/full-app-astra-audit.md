# Full application audit — Astra

Date: 2026-10-06. Reviewed commit: `d2a8a40996ff73f43735432d8d198252fa844073`.

This is a read-only application audit; only this report was added. Application code, source evidence, review decisions, and commits were not changed. Findings below distinguish reproduced defects from limitations and unverified browser risks. P1 means the main simulation presentation is visibly incorrect in ordinary use; P2 means a substantive correctness or interaction defect; P3 is an edge case.

## Result

Eight confirmed findings: one P1, six P2, and one P3. The most consequential are remaining ship intersections in both modes and hulls passing through the quay. Existing tests pass, including the recent anchorage regression. Independently sampling the frozen bundle confirms the specific Fiesta/Brave Quest fix: their minimum center separation from every other displayed vessel, including Luna Linda, is 350 scene units. That result does not cover moving-vessel intersections elsewhere.

## Scope and verification

Read all application modules, HTML/CSS, offline acquisition/normalization/validation/assembly code, schema, tests, review configuration, and application documentation. Compared the retained PDFs' extracted tables with normalized source records. Reviewed renderer creation, model removal, selection, context loss, disposal, reduced motion, and keyboard alternatives. No extra agents or network acquisition were used.

Executed:

- `npm test`: all three JavaScript test files passed.
- `npm run test:data`: all four Python tests passed, including the optional frozen-input integration test; the private local reports were available.
- Targeted Node probes against the frozen bundle and all four synthetic scenarios, including continuous-time sampling at 0.001-hour intervals, export/load checks, loader boundary inputs, and a half-hour source scenario.
- A lightweight DOM stub executed the actual `app.js` event/render functions in Node's `vm`, with imports supplied and WebGL stubbed. It reproduced the stale-load race, disclosure replacement, and unknown-state mislabel. This checks application logic, not browser layout or accessibility behavior.

Collision confirmation used oriented rectangles strictly **inside** the rendered hull footprint: longitudinal extent `[-0.45 × length, 0.30 × length]`, transverse extent `±0.30 × beam`. The rectangles were transformed using the actual Three.js Y-rotation convention and tested with separating axes. Their intersection proves hull overlap; this is stronger than merely overlapping conservative bounding circles. Missing dimensions used exactly the renderer's defaults. Quay intersections checked transformed interior corners against the land rectangle drawn by the renderer. These are visual consistency checks, not navigation-safety calculations.

No browser automation was performed for this audit. Actual download saving, BFCache eligibility, GPU/context recovery, screen-reader behavior, and mobile layout remain unverified. The findings do not claim an exhaustive proof that all bugs have been found.

## Confirmed findings

### F1 — P1: simultaneous source movements intersect each other

**Location:** [source-motion.js:38](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-motion.js:38), [source-motion.js:55](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-motion.js:55). Regression gap: [source-motion.test.js:42](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/tests/source-motion.test.js:42).

Routes are generated independently with shared Z control points and no separation between simultaneously moving vessels. The current frozen data makes both arrival paths cross and both departure paths converge onto one another.

**Reproduce:** Load the local 06-10-2026 bundle, keep the motion overlay on, and play through the following elapsed times (relative to 06:30 Argentina time). Directly call `sourceMotionView(bundle, t)` for exact values.

| Elapsed time | Vessels | Center positions | Result |
| --- | --- | --- | --- |
| 2.45 h / 08:57 | AGIOS LAZAROS, NORSE ADVANCE | `(1702.33, 199.838)`, `(1711.57, 199.838)` | 9.24-unit separation for 229 m and 200 m hulls |
| 2.875 h / 09:22:30 | C FORCE, BBG LIJIANG | `(285, 261)`, `(295, 261)` | 10-unit separation for two 229 m hulls |

Interior hull rectangles overlap, starting by approximately 2.257 h for the departure pair and 2.829 h for the arrival pair. Neither pair involves Fiesta or Brave Quest, so the recent anchor-only regression passes while this remains visible.

**Impact:** Ordinary playback still depicts ships passing through one another, the same class of visual problem the user reported. The source data remains intact; this is an illustrative geometry failure.

**Recommended fix:** Give simultaneous routes spatial separation or introduce an explicitly labeled visual scheduling assumption. Keep published plan times unchanged. Check every displayed vessel pair across the complete overlay, rather than only moving vessels against selected anchors.

### F2 — P2: synthetic routes still cross waiting vessels

**Location:** [synthetic-adapter.js:5](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/synthetic-adapter.js:5), [synthetic-adapter.js:6](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/synthetic-adapter.js:6).

The source-mode anchorage change does not affect the separate synthetic adapter. Its anchor grid overlaps the inbound/outbound movement corridor.

**Reproduce:** Choose normal operation and seek/play around hour 18.43–18.45. Horizonte's outbound route intersects the waiting Sur and Delta hulls. Other sampled examples include Brisa/Delta around 21.653 h and Patagonia/Delta around 22.409 h. Confirmed intersections also occur in delay mode (e.g. Brisa/Delta at 19.403 h), tug-outage mode (Patagonia/Brisa at 12.090 h), and berth-closure mode (Horizonte/Delta at 18.430 h).

**Impact:** Even though the scheduler correctly excludes channel/resource overlaps, the rendered geography contradicts the scene. Resource scheduling tests alone cannot detect this.

**Recommended fix:** Separate the synthetic waiting area from its routes and validate hull clearance in each selectable scenario. Prefer a shared, testable geometry implementation so source and synthetic route fixes do not diverge.

### F3 — P2: turns sweep through land, and source arrivals snap 90 degrees at berth

**Location:** [source-motion.js:38](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-motion.js:38), [source-motion.js:45](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-motion.js:45), [source-motion.js:55](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-motion.js:55), [luna-linda.js:12](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/luna-linda.js:12), [synthetic-adapter.js:6](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/synthetic-adapter.js:6). Land geometry: [port3d.js:39](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/port3d.js:39).

Source arrival curves approach the dock perpendicular to the quay. Heading follows that derivative, then switches immediately to `angle: 0` at completion. Departures similarly rotate away from the berth before the stern clears land. The vessel center remaining over water is insufficient to keep the hull over water.

**Reproduce/evidence:** C FORCE at 3.249999 h has angle `1.570813` radians; at 3.25 h it has angle `0`. Its center is approximately `(-230, 38)` in both frames. Interior hull corners enter the land before completion. Luna Linda also enters the quay immediately before its 1.75-hour arrival end (confirmed by 1.744 h). AGIOS LAZAROS's interior stern corner reaches approximately `(-630.02, -36.27)` at 2.001 h, inside the land rectangle `x ∈ [-955, 795], z ∈ [-900, 0]`. Synthetic Austral's departure at hour 8 likewise puts an interior corner about 50 units inland.

**Impact:** Hulls overlap terminal geometry; arrivals visibly pivot in place at the last frame. This affects all three routing implementations.

**Recommended fix:** Design approach/departure control points and headings to be continuous at the berth, with enough water clearance for the full rotated hull. Test swept hulls against the quay as well as other ships; interpolation alone can hide a snap while retaining the collision.

### F4 — P2: playback continually closes the selected vessel's provenance disclosure

**Location:** [app.js:68](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:68), [app.js:76](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:76), [app.js:99](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:99), [app.js:102](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:102).

Every source playback frame calls `listDetails`, which replaces the whole details panel, then creates a new closed `<details>` element for “Ver procedencia por campo.” Stable content is rebuilt even when the vessel and source fields have not changed.

**Reproduce:** Select any reported ship, start playback, and expand its field-provenance disclosure. The next frame replaces it with a closed element. In the DOM harness, after setting `open = true` and running `renderSourceFrame()`, the new disclosure was a different node with no open state. Seeking or toggling playback also replaces it.

**Impact:** The user cannot keep the evidence open while watching the movement. DOM replacement also discards focused descendants, text selection, and per-field scroll state, and adds unnecessary work on every animation frame.

**Recommended fix:** Render stable vessel details only when selection/dataset changes; update moving state and clock fields in place. Preserve disclosure and focus state for changes that genuinely require replacement. Add an interaction test for an open disclosure surviving playback frames.

### F5 — P2: a stale asynchronous import overrides a newer dataset choice

**Location:** [app.js:108](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:108), [app.js:117](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:117), [app.js:131](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:131).

`activateSource` applies every completed request without checking whether a newer action superseded it. Switching to synthetic mode does not invalidate a pending fetch/file read. Luna Linda's initial load has a separate instance of the same issue.

**Reproduce:** Start “Cargar paquete local,” switch to “Demostración sintética” before the load resolves, then allow the earlier load to finish. The app returns to source mode. A controlled delayed-promise test of the actual handlers produced “Demostración sintética activa.” followed by “Paquete local validado estructuralmente. bahia-2026-10-06”. Similarly, importing A then B can end on A if A resolves last.

**Impact:** The final displayed dataset follows completion order instead of the user's latest choice; a stale success or failure can also replace the newer status message.

**Recommended fix:** Use a monotonically increasing dataset-request token, invalidated by every mode/import choice, and apply results/errors only for the active token. Abort fetches where possible; a token is still needed for local file reads. Route Luna Linda's initialization through the same mechanism.

### F6 — P2: the published JSON schema and actual loader disagree

**Location:** [source-bundle.json:12](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/schemas/source-bundle.json:12), [source-bundle.json:13](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/schemas/source-bundle.json:13), [source-bundle.json:14](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/schemas/source-bundle.json:14), [source-data.js:21](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-data.js:21), [source-data.js:23](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-data.js:23).

These are incompatible definitions of the same version 1.0 contract:

| Case | Loader | Published schema |
| --- | --- | --- |
| Observation `state: "unknown"` | Accepts; explicitly exercised in tests | Rejects |
| `pilot_time: null` or `tug_time: null` | Accepts; explicitly exercised in tests | Rejects via object-only time definition |
| Dimension `0` | Rejects | Allows `minimum: 0` |
| Assertion evidence `"derived"` or status `"confirmed_actual"` | Rejects | Allows |
| Missing `assumptions`/`unresolved_issues` arrays | Rejects | Not required |

**Reproduce:** Clone the current valid bundle and independently set an observation state to `unknown`, or an intention pilot time to `null`; `validateBundle` accepts both. The schema enums/types directly exclude those values. No external JSON-schema validator was installed for this audit; the contradictory clauses are explicit.

**Impact:** A producer following the documented schema can produce files the UI rejects, while files intentionally supported by the UI fail schema validation. The bundle's schema hash does not resolve this semantic disagreement.

**Recommended fix:** Establish one versioned contract and align schema, loader, pipeline, and fixtures. Keep explicit unknown values supported if that is the intended evidence model. Test representative accepted/rejected cases against both validation implementations.

### F7 — P2: an unknown source location is labeled as reported anchorage

**Location:** [app.js:113](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:113). Correct detail-panel handling exists at [app.js:98](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:98).

The observation-board label is a two-way conditional: alongside, otherwise “Rada publicada.” The loader also accepts the state `unknown`; the adapter correctly gives that state no pose.

**Reproduce:** Import an otherwise valid bundle with an in-scope observation in state `unknown`. Its board button says “Rada publicada,” but selecting it displays “Ubicación desconocida” and no ship pose. The actual board-rendering function reproduced “AGIOS LAZAROS · ADM · Rada publicada” for such a constructed input.

**Impact:** The evidence UI invents a published anchorage location and contradicts the selected-vessel panel. The frozen current bundle has no such record, so this is triggered by a supported imported state.

**Recommended fix:** Use an explicit shared state-label mapping including `unknown`; do not treat every non-alongside state as anchorage.

### F8 — P3: Luna Linda's animation cannot finish in short source scenarios

**Location:** [luna-linda.js:11](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/luna-linda.js:11), [luna-linda.js:18](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/luna-linda.js:18), [app.js:74](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:74).

Luna Linda always starts at hour 1 and ends at hour 1.75, but adding it leaves the view bounds unchanged. Playback uses those bounds.

**Reproduce:** In a constructed accepted bundle, remove intentions and set coverage to half an hour. `withLunaLinda(sourceMotionView(bundle, 100))` returns `time: 0.5`, bounds ending at `0.5`, and Luna Linda still in hypothetical anchorage. The viewer cannot reach its advertised arrival. A horizon between 1 and 1.75 stops mid-movement.

**Impact:** Optional ship playback fails for short imported coverage. The retained 6.25-hour source overlay is unaffected.

**Recommended fix:** When Luna Linda animation is enabled, extend only the illustrative bounds through its end time and update the slider on add/remove. Preserve the source evidence coverage.

## Additional limitations and risks

### R1 — BFCache restoration has no scene reinitialization (browser reproduction pending)

[app.js:71](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:71) always disposes the scene on `pagehide`, including a persisted pagehide. [port3d.js:142](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/port3d.js:142) permanently stops rendering and removes the canvas. There is no `pageshow` reinitialization. If the browser restores this page from its back/forward cache, scripts do not perform a fresh initial load, so the cached document retains a disposed scene. Whether the specific embedded browser caches this WebGL page was not tested. Reproduce with navigation away/back and inspect `pageshow.persisted`; handle persisted pagehide separately or recreate the scene on restoration.

### R2 — downloaded evidence cannot be reimported directly (confirmed limitation)

[app.js:62](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:62) exports a wrapper `{format, bundle, ...}`, but [source-data.js:26](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-data.js:26) validates the outer object as a raw bundle. Both `sourceExport(bundle)` and `sourceMotionExport(bundle, time)` fail `loadBundle` with “Versión de paquete no compatible (se requiere 1.0).” Extracting their `.bundle` works, but does not restore time, motion settings, or Luna Linda. The README promises evidence export, not session round-trip, so this is reported as a workflow limitation rather than a broken explicit guarantee. Clarify the distinction or add format-aware import. Browser file saving itself remains unverified.

### R3 — structural validation is not content-integrity verification (confirmed trust boundary)

[source-data.js:11](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-data.js:11) checks the bundle hash's shape, not its digest. Review schema/source bindings are optional at [source-data.js:17](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-data.js:17). Tests confirmed that changing a vessel length to `999` without changing its source assertion or any hash still loads, as does replacing the review with `{status: "approved"}`. Assertion-reference existence is checked, but row values are not reconciled with the referenced assertions.

The README explicitly limits import validation to structure/review metadata and disclaims publisher authentication, so this is not a claim that cryptographic authentication was promised. Nevertheless, a “verified” source entry and displayed hash do not prove that the displayed row content matches that evidence. If stronger integrity is intended, require review bindings, verify canonical bundle/review digests, and check row/assertion consistency; a digest alone still cannot authenticate a publisher or reviewer.

### R4 — playback recomputes immutable plans repeatedly (cost observed in code, no frame-rate claim)

[app.js:68](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/app.js:68) calls `horizon()` repeatedly and then renders; `horizon()` builds a complete source display. [source-motion.js:48](/home/santiago/GrupoRiccitelli/bahia-blanca-simulation/src/source-motion.js:48) rebuilds a motion plan and several source views each time. Combined with F4, the source frame repeatedly allocates arrays/objects and replaces DOM that is unchanged. The current small frozen dataset may be entirely adequate; no measured performance regression is asserted. Cache the immutable plan/bounds by bundle if expanding dataset size, and profile before setting performance targets.

## What held up under review

- The four fixed synthetic scenarios are deterministic and satisfy the tested berth, channel, tug, outage, closure, and horizon scheduling invariants. No scheduler failure was reproduced for those scenarios.
- Source movement is reconstructed from elapsed time without mutating the underlying evidence; backwards seeks and overlay disabling restore published placements. Operational performance metrics are kept out of source mode.
- Frozen PDF byte hashes, normalization hash, reviewed parser/toolchain versions, and deterministic assembly are checked by the offline pipeline. Unsupported PDF versions and unsupported nonempty reconciliation overrides fail explicitly.
- Current normalized counts are consistent: 19 observations, eight in-scope scene entities, seven intentions, 131 inventory rows. Unknown observation cutoff, planned timestamps, source-vs-assumed geometry, and the hypothetical Luna Linda call are explicitly distinguished.
- Source text is inserted with `textContent`/text-node creation; the source board/details do not interpolate imported strings into HTML. Synthetic HTML templates use fixed internal scenario data.
- The specific Fiesta/Brave Quest clearance change works for the retained source bundle, including Luna Linda. Its test name and docs should remain clear about this limited scope.
- Documentation records historical verification stages. Older lines saying continuous motion was deferred are followed by later sections documenting its addition; treat these as historical records rather than current feature specifications. The README describes the current modes more accurately.

## Recommended order

Fix and regression-test the spatial defects F1–F3 first. Address disclosure stability and import ordering next. Then reconcile the schema and unknown-state labels, and cover the short-horizon Luna Linda case. Separately decide whether exports should be restorable sessions and whether imported evidence needs stronger integrity checking. Verify BFCache/context restoration and browser download saving in the actual supported browser before claiming those lifecycle workflows are covered.
