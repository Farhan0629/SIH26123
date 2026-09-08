# SIH26123 — Fleet in motion

Warehouse fleet simulation with a FastAPI backend and a React / React Three Fiber digital twin. This branch is a redesign under review, not a production robotics system.

## Run this redesign

```bash
git fetch origin
git switch copilot/implement-redesign-warehouse-simulation
```

Python 3.10+ and Node 22+ are recommended. From the repository root:

```bash
cd backend
python -m pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Optional: set `VITE_WS_URL` if the backend is hosted elsewhere. Do not expose this unauthenticated demo server to the public Internet.

## Watch the demonstration

1. Start demonstration at 0.5x; select a unit and choose Follow selected.
2. At RECEIVING, watch the unit reach and lift its labeled carton.
3. The same package is carried in front of the torso along the actual planned route.
4. At DISPATCH, watch it lower and release the carton. Completed count changes only after placement finishes.
5. Pause also freezes handling progress. Choose 0.25x for a slower explanation.
6. Drag/zoom to enter manual camera mode. Re-select Overview to reset it.
7. Low-rack is the clear default. Full racks shows the warehouse detail; X-ray reveals units behind racks. Routes and P2P links are optional overlays.

Stations show one staging-slot carton and the real queue/delivery count, rather than overlapping every package in a small area. Camera-facing walls are cut away. Shelf inventory is decorative; task cartons are tied to live task data.

## What changed in the direct repair pass

- Rebuilt humanoid hierarchy, visible shell/joint contrast, grippers, independent elbow/knee pivots and corrected heading axis.
- Persistent, queued cell-to-cell motion avoids reset-on-update snapping and interpolated shortcuts through corners.
- Camera presets relinquish control when the user interacts; Follow uses the selected unit and handles an empty fleet safely.
- Server-only `PresentationRobot` adds ten simulation ticks per pickup/placement. Original `robot.py`, planners, and headless benchmark implementation are unchanged.
- One physical carton size across staging/handling/carrying; labels are local canvas textures without remote font/model dependencies.
- Batched rack geometry, loading-bay details, floor markings on walkable cells and clear station labels.
- Responsive scene-first layout, WebGL error boundary and guarded/ref-counted WebSocket client.

## Validation status — read before merging

Executed during the repair pass:
- 12 dependency-free movement, heading, cargo and status tests: passed.
- 5 isolated Python handling-contract tests: passed. These mock the base robot; they are NOT full planner integration tests.
- 5 transport tests for shared connections, StrictMode cleanup, stale callbacks, reconnection and malformed messages: passed.
- JS/JSX syntax parsing and Python syntax compilation of edited sources checked locally.

NOT verified in that environment: full `npm ci` / Vite production build, full backend benchmark, live browser/WebGL rendering, desktop/mobile screenshots, and real-device FPS. Dependency downloads were unavailable. The PR must remain draft until those checks are completed. No screenshots or performance claims are fabricated.

Run the checks in a network-enabled checkout:

```bash
cd frontend
npm ci
npm test
npm run build
cd ../backend
python -m unittest discover -p test_presentation_contract.py -v
python test_simulation.py
```

Then inspect initial/running/pickup/carrying/placement/paused/disconnected views at 1440px and 390px. Check grip contact, feet, label overlap, camera control and console errors.

## Simulation limitations

Humanoid motion is procedural presentation, not physically validated bipedal locomotion. The demo's handling dwell changes completion times and traffic behavior, so live demo metrics must NOT be compared directly against the unchanged stop-and-wait baseline as proof of algorithmic improvement. A baseline timeout is not a measured completion time. For algorithm evaluation use the headless benchmark and inspect both completion and collision results.
