# SIH 26123 — Edge-AI AMR Fleet Coordination

Decentralized, Peer-to-Peer Autonomous Mobile Robot (AMR) fleet coordination system designed for warehouse logistics. Features real-time local A* path planning, simplified Consensus-Based Bundle Algorithm (CBBA) task allocation, windowed priority collision avoidance, dynamic rerouting around blocked aisles, and circular wait deadlock resolution.

Includes an interactive 3D digital twin dashboard built with React Three Fiber (R3F) and Tailwind CSS, optimized for 30+ FPS performance on integrated GPUs.

---

## Architecture Overview

- **Decentralized Edge Intelligence**: Each robot makes local decisions using only onboard sensing and direct peer-to-peer (P2P) wireless messaging — no central coordinator.
- **Dynamic Collision Avoidance**: Lookahead reservation window where robots closer to their task destination hold priority; ties resolved deterministically by robot ID.
- **Deadlock Resolution**: Real-time dependency cycle detection via depth-first search (DFS) with cooperative back-off protocol.
- **Baseline Comparison**: Proven **>90% completion time improvement** and **zero collisions** compared to naive stop-and-wait approaches.

---

## Project Structure

```
SIH26123/
├── backend/
│   ├── main.py              # FastAPI application, WebSocket hub, and simulation loop
│   ├── warehouse.py         # 20x20 grid map model with narrow aisles and choke points
│   ├── robot.py             # Decentralized AMR agent decision engine
│   ├── pathfinding.py       # Local A* grid pathfinding algorithm
│   ├── p2p.py               # Simulated direct peer-to-peer communication bus
│   ├── task_manager.py      # CBBA task auction and lifecycle management
│   ├── collision.py         # Validation check and DFS circular deadlock resolver
│   ├── baseline.py          # Stop-and-wait benchmark robot implementation
│   ├── metrics.py           # Real-time metrics tracker (collisions, times, improvement)
│   ├── config.py            # Global constants and simulation parameters
│   ├── requirements.txt     # Python dependencies
│   └── test_simulation.py   # Headless 100-episode benchmark test suite
│
├── frontend/
│   ├── index.html           # HTML container
│   ├── package.json         # Node.js dependencies
│   ├── vite.config.js       # Vite bundler configuration
│   └── src/
│       ├── main.jsx         # Application entrypoint
│       ├── App.jsx          # Layout container (3D viewport + dashboard)
│       ├── store.js         # Zustand reactive state store
│       ├── websocket.js     # Auto-reconnecting WebSocket client
│       ├── components/
│       │   ├── Scene.jsx    # Optimized Three.js Canvas
│       │   ├── Warehouse.jsx# Procedural 3D floor, shelves, markers
│       │   ├── Robot.jsx    # Interpolated robot mesh with status labels
│       │   ├── Robots.jsx   # Fleet container
│       │   ├── PathTrail.jsx# Active path trail visualizer
│       │   ├── P2PLines.jsx # Animated P2P mesh network lines
│       │   └── CameraController.jsx # Orbit, Top-Down, Follow-AMR controls
│       └── dashboard/
│           ├── Dashboard.jsx   # Control & telemetry sidebar
│           ├── Controls.jsx    # Play, pause, speed, obstacle injection
│           ├── RobotStatus.jsx # Real-time battery & state indicators
│           ├── MetricsPanel.jsx# Live comparison charts & collision counters
│           └── TaskQueue.jsx   # Active & pending task auction list
└── README.md
```

---

## Quick Start

### 1. Backend Simulation Server

Ensure Python 3.10+ is installed:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend 3D Dashboard

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open browser at: `http://localhost:5173`

---

## Running Automated Benchmark Tests

To run the headless 100-episode verification test suite without the web interface:

```bash
cd backend
python test_simulation.py
```

Expected output:
```
RESULTS (100 episodes):
  Total Collisions:  0  [PASS]
  Smart Avg Ticks:   108.9
  Baseline Avg Ticks:2000.0
  Improvement:       94.6%  [PASS]
```
