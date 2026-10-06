# Bahía Blanca Port Simulation

A runnable first demonstration for Grupo Riccitelli. Watch ten illustrative vessel calls use three berths, three tugs and a shared channel over 48 hours, then compare delays and resource outages.

## Run locally

Requires Python 3. No dependency installation is needed.

```bash
cd /home/santiago/GrupoRiccitelli/bahia-blanca-simulation
python3 -m http.server 5180 --bind 127.0.0.1
```

Open http://127.0.0.1:5180/ . If Node.js/npm is available, `npm start` runs the same server and `npm test` runs the seven engine checks.

## Try the simulation

1. Press **Reproducir** to watch vessels enter, handle cargo and leave.
2. Drag the time slider to inspect any point in the 48-hour run.
3. Select a vessel from the timeline to see its state, berth and waiting time.
4. Choose a six-hour arrival delay, tug outage or TBB 9 closure.
5. Compare the full-run results against the unchanged normal baseline.
6. Download the complete scenarios, assumptions, events and results as JSON.

The geographic view is an interactive Three.js 3D scene with modeled bulk carriers, tugs, silos, loading equipment, water, lighting and shadows. Drag to orbit, use the wheel to zoom, and press Restablecer cámara to return. A browser with WebGL support is required. Bahía Blanca and the terminal names ADM, TBB 9 and Cargill are real; vessels, schedules, geometry, durations, resources and operating rules are illustrative assumptions. No current port feed or fleet credentials are used. Time starts at a fixed illustrative 2026-10-06 00:00 Argentina time.

## How it works

`src/engine.js` runs a deterministic event simulation independently of playback. Departures have priority, larger vessels require two tugs, and resources cannot overlap. Background traffic occupies the channel during explicit windows. Existing handling continues through a berth closure; the closure prevents new inbound assignments. Tug reservations include turnaround and cannot overlap the configured outage.

The dispatch policy is intentionally simple. A disruption can improve a metric by changing the order of jobs; it does not imply that removing a resource improves real port performance. Metrics describe the assumptions in this model. Historical calibration and true geographic routes remain future work.

The browser needs no external scripts, tiles, fonts or network feeds. Python serves the static files on loopback. The simulator uses no randomness and records its engine version in every export.

## Files

- [Prototype decisions](docs/prototype-decisions.md): the chosen assumptions and exact resource/metric semantics.
- [Implementation plan](docs/implementation-plan.md): source audit and roadmap toward a calibrated operational model.
- `src/engine.js`: scheduling and metrics.
- `src/app.js`: playback, timeline and exports.
- `src/port3d.js`: 3D models, vessel movement, camera and selection.
- `vendor/three/`: locally bundled Three.js 0.180.0 and OrbitControls, under the included MIT license.
- `tests/engine.test.js`: hand-worked timing, deterministic resource checks for all four modes, background traffic, closures and horizon handling.

The first demonstration is implemented. The GitHub repository is https://github.com/GrupoRiccitelli/bahia-blanca-simulation. No cloud deployment is configured.
