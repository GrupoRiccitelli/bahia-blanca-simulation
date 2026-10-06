# Demonstration verification

2026-10-06

- `npm test`: seven checks passed. Hand-calculated timings; deterministic outputs in all four modes; berth, channel and tug exclusion; future outage windows; background channel traffic; closure semantics; unfinished calls at the horizon.
- JavaScript syntax checks passed for the engine and application.
- In-app browser: the page loaded, playback advanced to hour 10 and paused, seeking to hour 12 worked, selecting Horizonte updated the details, and tug outage/berth closure changed the comparison metrics and timeline.
- Inspected narrow and desktop layouts. Saved `demo-preview.jpg` from the desktop scene/control view. No browser console errors were reported during those checks.
- Browser download-event verification timed out in the available automation interface. The JSON download handler is implemented, but successful saving through that interface remains unverified.

Normal run: 10 completed calls, mean arrival-to-inbound waiting 3.9 h, mean completed-call turnaround 12.625 h, berth occupancy 60.59%. These are synthetic model outputs, not measured port statistics.

The loopback server was started on port 5180. If the session stops, restart with the README command.

## 3D upgrade

Replaced the schematic with locally bundled Three.js rendering. Browser checks confirmed WebGL rendering of ships, tugs, terminal equipment, water and shadows; hour-5 seeking positioned three vessels alongside and one waiting. Camera zoom and reset worked. Inspected the narrow default panel and desktop breakpoint, with no console errors. The geography and movement paths remain illustrative. Screenshot: `demo-3d-preview.jpg`.

## Real-data acquisition audit

2026-10-06: `python3 scripts/fetch_sources.py` successfully fetched both official PDF endpoints. Verified saved PDF signatures, byte counts and SHA-256 against the emitted manifest. The script also passed Python compilation and CLI help checks. Raw snapshots remain ignored; the viewer still uses synthetic inputs. Detailed PDF visual review, source coverage and implementation gates are documented in `real-data-implementation-plan.md`.

## Source bundle release checks

2026-10-06:

- `npm test`: both JavaScript test files passed. Direct `node tests/engine.test.js` confirmed seven engine cases; `node tests/view-state.test.js` confirmed 53 loader/adapter cases. These cover missing/malformed bundles, incomplete/duplicate/unknown sources, hashes/review/schema failures, broken references, complete required provenance, unsafe field types, review/source hash mismatches, invalid dispositions, invalid dimensions/time intervals, forbidden metrics, string IDs, missing fields, simultaneous typed plans, deterministic forwards/backwards seeks, dynamic bounds and synthetic/source adapter isolation.
- `npm run test:data`: four Python pipeline tests passed (failure fixtures and deterministic assembly).
- Ran normalization, review validation and assembly against the retained audited manifest. Imported the resulting bundle through `loadBundle` in Node and obtained 19 reported observations, eight scene entities, seven plan rows and 131 inventory rows. Coverage is 5.5 hours; plans do not update reported placement.
- Repeated assembly after the pipeline update and compared exact output bytes with `cmp`; identical hash `71760a6b1237178adb205f92705efc25a5e0e29a41840dd97711ac78bf514def`.

These checks verify the frozen supported input and adapter contract. Browser mode switching, rendering, escaping and downloaded-file behavior require separate browser verification; adapter tests alone do not establish those UI results. New PDF hashes/layouts, nonempty overrides/linked intentions, continuous route animation, actual history and predictive calibration remain outside this implementation.

## Browser integration verification

Loaded the official local bundle through both its convenience button and JSON file chooser. Confirmed eight source scene labels and all seven VTS rows, selected BBG LIJIANG, sought to 08:30 (six simultaneous planned pilot/tug markers highlighted), played/paused and reset the timeline. Source placements retained their report state; synthetic-to-source-to-synthetic switching restored synthetic labels, controls and metrics. An unsupported-schema file displayed an error and preserved the active source dataset. Inspected narrow and desktop layouts; saved `real-data-preview.jpg`. No console errors were reported in the first checks. Repeated browser reloads subsequently caused WebGL context loss; the text board/timeline remained available. Added context restoration and explicit context release during disposal. A fresh final tab rendered correctly; automatic context restoration itself has not been independently triggered and verified. Browser download saving remains unverified; source export payload is covered by adapter tests.

Planned movement overlay (2026-10-06): browser verification loaded the reviewed local bundle with six eligible movements and one out-of-scope intention retained in the agenda. Seeking to 08:45 showed an illustrative departure; play advanced the clock and pause stopped playback. Seeking to 09:24 and selecting C FORCE showed an illustrative arrival. Disabling the overlay restored all eight published placements and the original 5.5-hour marker horizon; enabling it restored the 6.25-hour visual horizon. Source counts and unavailable operational metrics remained unchanged. Screenshot: `planned-motion-preview.jpg`. Seven constructed motion tests cover seeking, evidence preservation, skipped links and separate export assumptions; JavaScript suites and four Python pipeline tests pass. Download payload is tested; browser file saving was not re-verified.
