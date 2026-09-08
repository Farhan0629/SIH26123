# SIH26123 Warehouse Fleet Simulation

Presentation-oriented warehouse fleet simulation with:
- Python FastAPI backend and WebSocket state stream
- Decentralized task allocation/path planning logic (unchanged algorithm core)
- React + Three.js digital twin with humanoid robot visualization, cargo lifecycle staging, and mission dashboard

## Run locally

### Backend
```bash
cd /home/runner/work/SIH26123/SIH26123/backend
python -m pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd /home/runner/work/SIH26123/SIH26123/frontend
npm ci
npm run dev
```

Optional frontend WebSocket override:
```bash
VITE_WS_URL=ws://localhost:8000/ws npm run dev
```

## Demonstration walkthrough

1. Open the app and confirm connection status is **Connected**.
2. Click **Start demonstration**.
3. Use camera presets: **Overview**, **Top-down**, **Follow selected**, **Receiving**, **Dispatch**.
4. Toggle shelf visibility between **Full racks**, **X-ray racks**, and **Low-rack** to avoid occlusion.
5. Select a robot card to inspect humanoid behavior, status, package, and next destination.
6. Use route/P2P toggles only when needed for clarity.

## What the visualization now emphasizes

- Recognizable articulated humanoid industrial robots (head/visor, torso, arms, legs, feet, joints)
- Cargo lifecycle tied to real task state:
  - pending/assigned cargo staged at receiving cells
  - carrying cargo in robot hands (front torso pose)
  - delivered cargo stacked at dispatch cells
- Labeled physical stations: **RECEIVING**, **DISPATCH**, **CHARGING** with coordinate IDs
- Activity feed and mission summary based on live backend data (no fabricated telemetry)

## Important limitations

- This project is a simulation prototype.
- Humanoid motion is presentation visualization, **not** physically validated bipedal control.
- Planner/allocation behavior is still the existing algorithmic simulation logic.
- Baseline comparison is shown only when run in-session; otherwise it is explicitly marked unrun.

## Validation run for this update

Commands used:
```bash
cd /home/runner/work/SIH26123/SIH26123/frontend
npm ci
npm test
npm run build

cd /home/runner/work/SIH26123/SIH26123/backend
python test_simulation.py
```

If screenshots were captured during this session, include them in the PR description with desktop and mobile states.
