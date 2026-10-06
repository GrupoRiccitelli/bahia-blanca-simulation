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
