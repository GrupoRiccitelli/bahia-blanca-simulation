# First demonstration decisions

2026-10-06. User authorized choosing ordinary port assumptions to produce a first working simulation.

The initial implementation is a self-contained browser application with locally bundled Three.js 0.180.0 with a deterministic JavaScript event engine, Node's built-in test runner, and Python's local HTTP server. This replaces the proposed Python/API/React stack for the first demonstration only. No dependency installation, upstream feed or dashboard login is required. The 3D view requires browser WebGL support; the scheduling engine runs independently.

Design: a port operations desk with a large interactive 3D scene, a vessel timeline beneath it, and quiet controls and metrics. Palette: deep marine blue #12344b, water blue #d9edf3, quay concrete #bcc7c6, white #ffffff, tug orange #dd743c, vessel blue #347f9e. System humanist sans typography with strong tabular numbers. The modeled port is the defining visual element; surrounding panels remain restrained.

## Scope and evidence

- Real place and terminal names: Bahía Blanca / Ingeniero White; ADM, TBB 9, Cargill.
- Diagram geometry, ships, lengths, arrivals, cargo, durations, tug fleet, and all resource rules are illustrative assumptions. The diagram is not a surveyed map. Vessel names are fictional, preventing confusion with an actual operating schedule.
- The source audit remains useful background, but this demonstration does not ingest source reports or claim current positions.
- Horizon: 48 hours from 2026-10-06 00:00 Argentina time. This is a fixed illustrative scenario, not today's live state.
- Start: all three berths empty; tugs available; no carry-in jobs. Outside-terminal channel reservations explicitly represent background traffic.

## Dispatch and resources

- One ship per berth; all demo ships fit every berth. Each ship has a preferred berth, used if free, with alternatives allowed.
- One shared channel movement at a time. Other traffic occupies it at hours 3–4, 10–11, 20–21, and 30–31.
- Ships of at least 220 m require two tugs; other ships require one. This is a demonstration rule, not a local regulation.
- Inbound transit/berthing takes 1 h; outbound transit takes 0.75 h. Tugs need another 0.5 h turnaround after either movement. Handling durations are per-call assumptions.
- Reserve berth at inbound dispatch; release berth on outbound completion. Release channel at movement completion; release tugs after turnaround.
- Departures ready to sail have priority over arrivals; within each queue use readiness/arrival order with stable vessel index tie-breaking. Bypass calls that cannot currently acquire all resources.
- A berth closure prevents new inbound assignments to that berth; existing inbound movements and handling continue. A tug outage blocks a reservation if its service plus turnaround overlaps the outage; existing work is not interrupted. Disruptions therefore never withdraw an already committed resource.
- Movement cannot overlap a background channel reservation. Future windows are checked before dispatch.
- Compare identical input scenarios with exactly one configured disturbance. No randomness is used.

## Metrics and reproducibility

- Waiting: time from arrival until inbound dispatch, accumulated through the horizon for calls still waiting. Average divides by calls arrived by horizon.
- Turnaround: arrival to outbound completion, completed calls only; show completed and unfinished counts alongside it.
- Berth occupancy includes inbound, handling, departure queue and outbound. Utilization divides occupied time by the full horizon.
- Tug duty includes service and turnaround; utilization divides duty by scheduled available tug-hours, excluding outage hours.
- Baseline and selected run include complete scenario, rules, run events and metrics in a downloadable JSON file. No external source bytes are required for this synthetic demonstration.
- Historical calibration, cargo compatibility, weather/navigation rules and true geography remain future implementation work in the main plan.
