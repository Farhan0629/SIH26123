# Barrier navigation upgrade

## Behavior

- Robots replan from their current cell when barriers are added or removed, even if their radio is partitioned. The whole remaining route is checked, not only the next cell.
- A* searches the entire walkable floor: detours may initially move away from the destination, including backing out of U-shaped barriers.
- Onboard sensing participates in planning as well as collision checks. Sensor-confirmed free cells override stale radio positions. Position and intent memories expire after three broadcast intervals (at least three ticks).
- After three traffic-conflict ticks, robots seek a different route around peer intentions. A safe alternative can be taken immediately, without another unnecessary wait. Every next step still passes collision checks.
- If barriers make the destination unreachable, robot telemetry includes `navigation_message: "Please remove the barrier"` and `navigation_blocked_reason: "barrier"`. The robot card displays that exact text as an accessible alert, and the event log records warning/recovery transitions.
- Removing a barrier that restores connectivity clears the alert and resumes the current task or charging trip on the next simulation tick. Carried cargo is retained.
- Idle robots also warn when barriers close all adjacent exits. Idle/parked robots do not wander just because a barrier is present.

“No route” includes a larger enclosure with free cells inside it, or an enclosed destination; four immediately blocked neighbors are not the only impossible case. A separate diagnostic search ignores barriers solely to distinguish a barrier-caused blockage from an invalid building destination. Diagnostic routes are never used for movement.

Temporary robot traffic is not reported as a barrier enclosure. This change does not promise completion for every arbitrary multi-robot deadlock, exhausted battery, simulation timeout, or physically disconnected layout. Existing deadlock resolution, energy rules, pause controls, and safety checks remain active.

## Try it

1. Start the backend/frontend as described in README.
2. Start the demonstration, pause, and place barriers across an active route.
3. Resume: a unit takes an alternate walkable route if one exists.
4. Pause and enclose a unit (or disconnect all routes to its destination).
5. Resume: its card shows **Please remove the barrier**.
6. Pause and remove a barrier to open a route, then resume: the alert clears and the unit continues.
7. Repeat with its radio offline: local barrier replanning and physical collision checks remain available.

Warnings/recovery update when simulation ticks resume; there is no robot movement while paused.

## Verification

```bash
cd backend
python -m unittest test_barrier_navigation -v
python -m unittest discover -p 'test_presentation_contract.py' -v
python test_simulation.py
python smoke_demo.py

cd ../frontend
npm ci
npm test
npm run build
```

Results on this branch:

- 18 barrier-navigation regression tests passed. Coverage includes front barriers, U-shaped detours, immediate and larger enclosures, enclosed goals, barrier removal, cargo preservation, charging recovery, offline sensing, expired peer memory, traffic conflicts, 50 seeded barrier maps checked against independent BFS, and a complete 12-package storage mission with three live barriers plus a radio partition.
- 7 existing cargo-handling contract tests passed.
- 28 frontend tests passed; production build passed (existing large-bundle warning remains).
- Existing 100-episode fleet benchmark: 100/100 completed, zero same-cell collisions, zero swap collisions, zero double-booked charge pads. Average fleet time 80.7 ticks vs original 81.0 ticks. The script still exits nonzero because its headline improvement is 19.4%, below its 20% assertion; original code also fails that assertion at 19.2%. No assertions were weakened.
- Existing demo smoke test: 12/12 packages stored, all three robots parked, zero collisions, zero pad conflicts, no cargo anomalies. It still exits nonzero because it counts 36 stored rack-slot records while asserting exactly 12; the same mismatch exists on the original commit. That unrelated inventory-count issue was not changed here.

Base inspected: `572d79851823642bd1a207874a4a36e4574e9e99`.
