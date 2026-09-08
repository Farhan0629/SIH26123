"""
Main simulation server.
FastAPI + WebSocket + asyncio simulation loop.
"""

import asyncio
import json
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import (
    NUM_ROBOTS,
    TICK_INTERVAL,
    MAX_TICKS,
    TASKS_PER_EPISODE,
    TASK_SPAWN_INTERVAL,
    DEFAULT_ROBOT_STARTS,
)
from warehouse import Warehouse
from robot import Robot
from p2p import P2PNetwork
from task_manager import TaskManager
from collision import detect_collisions, detect_deadlock, resolve_deadlock
from metrics import MetricsTracker
from baseline import BaselineRobot
from events import EventLogger

app = FastAPI(title="Edge-AI AMR Fleet Coordination")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global Simulation State ───
warehouse = Warehouse()
p2p_network = P2PNetwork()
task_manager = TaskManager(warehouse)
metrics = MetricsTracker()
event_logger = EventLogger()

ROBOT_STARTS = DEFAULT_ROBOT_STARTS

robots: list[Robot] = []
for i in range(NUM_ROBOTS):
    robot = Robot(robot_id=i + 1, start_pos=ROBOT_STARTS[i % len(ROBOT_STARTS)], warehouse=warehouse)
    robots.append(robot)
    p2p_network.register_robot(robot.id)

sim_state = {
    "running": False,
    "paused": False,
    "tick": 0,
    "speed": 0.5,
}

connected_clients: list[WebSocket] = []


def build_state_message(tick: int) -> dict:
    """Build the JSON state message sent to frontend every tick."""
    return {
        "type": "state_update",
        "tick": tick,
        "robots": [r.to_dict() for r in robots],
        "warehouse": warehouse.to_serializable(),
        "tasks": task_manager.to_dict(),
        "metrics": metrics.to_dict(),
        "p2p_messages": p2p_network.get_recent_messages(20),
        "events": event_logger.get_recent_events(30),
        "sim": {
            "running": sim_state["running"],
            "paused": sim_state["paused"],
            "speed": sim_state["speed"],
        },
    }


async def broadcast_state(state: dict):
    """Send state to all connected WebSocket clients."""
    if not connected_clients:
        return
    message = json.dumps(state)
    disconnected = []
    for client in connected_clients:
        try:
            await client.send_text(message)
        except Exception:
            disconnected.append(client)
    for client in disconnected:
        if client in connected_clients:
            connected_clients.remove(client)


async def simulation_loop():
    """Main simulation loop — runs at TICK_RATE Hz."""
    # Generate initial tasks
    for _ in range(3):
        task_manager.generate_task()

    while sim_state["running"]:
        if sim_state["paused"]:
            await asyncio.sleep(0.1)
            continue

        sim_state["tick"] += 1
        tick = sim_state["tick"]
        metrics.episode_ticks = tick

        # 1. Allocate pending tasks
        task_manager.allocate_tasks(robots, p2p_network, event_logger, tick)

        # 2. Each robot runs independent decision loop
        for robot in robots:
            action = robot.tick(tick, p2p_network, event_logger)
            if action == "picked_up":
                if robot.current_task:
                    event_logger.add_event(
                        "pickup",
                        f"AMR-{robot.id} picked up Box #{robot.current_task['id']} from Station ({robot.x},{robot.y})",
                        robot_id=robot.id,
                        tick=tick
                    )
            elif action == "delivered":
                if hasattr(robot, "last_delivered_task_id") and robot.last_delivered_task_id:
                    task_manager.mark_completed(robot.last_delivered_task_id)
                    event_logger.add_event(
                        "delivery",
                        f"AMR-{robot.id} delivered Box #{robot.last_delivered_task_id} to Dropoff ({robot.x},{robot.y})",
                        robot_id=robot.id,
                        tick=tick
                    )
                metrics.record_task_completion(tick)
            elif action == "stepped_aside":
                event_logger.add_event(
                    "yield",
                    f"AMR-{robot.id} stepped aside to clear bottleneck for peer",
                    robot_id=robot.id,
                    tick=tick
                )
            elif action == "waited" and robot.consecutive_waits == 1:
                event_logger.add_event(
                    "yield",
                    f"AMR-{robot.id} yielding right-of-way at intersection ({robot.x},{robot.y})",
                    robot_id=robot.id,
                    tick=tick
                )

        # 3. Collision detection validation
        collisions = detect_collisions(robots)
        for _ in collisions:
            metrics.record_collision()

        # 4. Deadlock detection & resolution
        deadlocks = detect_deadlock(robots)
        if deadlocks:
            resolve_deadlock(robots, deadlocks, warehouse, p2p_network, tick)

        # 5. Periodic task generation
        if tick % TASK_SPAWN_INTERVAL == 0 and len(task_manager.all_tasks) < TASKS_PER_EPISODE:
            task_manager.generate_task()

        # 6. Broadcast state
        state = build_state_message(tick)
        await broadcast_state(state)

        # 7. Check completion
        if len(task_manager.completed_tasks) >= TASKS_PER_EPISODE or tick >= MAX_TICKS:
            sim_state["running"] = False
            state = build_state_message(tick)
            await broadcast_state(state)
            break

        # 8. Rate limiting
        speed = max(0.1, sim_state["speed"])
        await asyncio.sleep(TICK_INTERVAL / speed)


async def run_baseline_comparison():
    """Run stop-and-wait baseline and record metrics."""
    baseline_warehouse = Warehouse()
    baseline_robots = [
        BaselineRobot(i + 1, ROBOT_STARTS[i % len(ROBOT_STARTS)], baseline_warehouse)
        for i in range(NUM_ROBOTS)
    ]

    random.seed(42)
    tasks = []
    for _ in range(TASKS_PER_EPISODE):
        pickup = random.choice(baseline_warehouse.pickup_points)
        dropoff = random.choice(baseline_warehouse.dropoff_points)
        tasks.append({"id": len(tasks) + 1, "pickup": pickup, "dropoff": dropoff})

    task_idx = 0
    for robot in baseline_robots:
        if task_idx < len(tasks):
            robot.assign_task(tasks[task_idx])
            task_idx += 1

    completed = 0
    final_tick = MAX_TICKS
    for tick in range(MAX_TICKS):
        if tick % 20 == 0:
            await asyncio.sleep(0)  # Yield to event loop to avoid freezing WebSocket
            
        for robot in baseline_robots:
            action = robot.tick(baseline_robots)
            if action == "delivered":
                completed += 1
                metrics.record_baseline_completion(tick)
                if task_idx < len(tasks):
                    robot.assign_task(tasks[task_idx])
                    task_idx += 1

        if completed >= TASKS_PER_EPISODE:
            final_tick = tick
            break

    metrics.record_baseline_episode(final_tick)
    state = build_state_message(sim_state["tick"])
    await broadcast_state(state)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.append(ws)

    # Send current full state so newly connected clients match live simulation state
    init_state = build_state_message(sim_state["tick"])
    init_state["type"] = "init"
    await ws.send_text(json.dumps(init_state))

    try:
        while True:
            data = await ws.receive_text()
            command = json.loads(data)
            action = command.get("action")

            if action == "start":
                if not sim_state["running"]:
                    sim_state["running"] = True
                    sim_state["paused"] = False
                    sim_state["tick"] = 0
                    sim_state["speed"] = 0.5
                    warehouse.blocked_cells.clear()
                    p2p_network.clear_log()
                    # Reset robots
                    for i, robot in enumerate(robots):
                        robot.__init__(robot.id, ROBOT_STARTS[i % len(ROBOT_STARTS)], warehouse)
                        p2p_network.register_robot(robot.id)
                    task_manager.__init__(warehouse)
                    metrics.__init__()
                    event_logger.clear()
                    event_logger.add_event(
                        "system",
                        f"Fleet coordination engine started with {NUM_ROBOTS} AMRs",
                        tick=0,
                    )
                    asyncio.create_task(simulation_loop())

            elif action == "pause":
                sim_state["paused"] = not sim_state["paused"]
                event_logger.add_event(
                    "system",
                    "Fleet simulation paused" if sim_state["paused"] else "Fleet simulation resumed",
                    tick=sim_state["tick"]
                )
                await broadcast_state(build_state_message(sim_state["tick"]))

            elif action == "speed":
                sim_state["speed"] = float(command.get("value", 1.0))

            elif action == "block_aisle":
                x, y = int(command["x"]), int(command["y"])
                warehouse.block_aisle(x, y)
                p2p_network.broadcast(1, "blocked", {"x": x, "y": y, "tick": sim_state["tick"]})
                event_logger.add_event(
                    "hazard",
                    f"⚠️ Aisle at ({x},{y}) BLOCKED — rerouting fleet in real-time",
                    tick=sim_state["tick"]
                )
                await broadcast_state(build_state_message(sim_state["tick"]))

            elif action == "unblock_aisle":
                x, y = int(command["x"]), int(command["y"])
                warehouse.unblock_aisle(x, y)
                event_logger.add_event(
                    "hazard",
                    f"✅ Aisle at ({x},{y}) unblocked — normal corridor restored",
                    tick=sim_state["tick"]
                )
                await broadcast_state(build_state_message(sim_state["tick"]))

            elif action == "run_baseline":
                event_logger.add_event("system", "Running 2000-tick baseline simulation comparison...", tick=sim_state["tick"])
                asyncio.create_task(run_baseline_comparison())

    except WebSocketDisconnect:
        if ws in connected_clients:
            connected_clients.remove(ws)


@app.get("/")
def root():
    return {"status": "Edge-AI AMR Fleet Coordination Server", "version": "1.0"}

@app.get("/api/warehouse")
def get_warehouse():
    return warehouse.to_serializable()

@app.get("/api/metrics")
def get_metrics():
    return metrics.to_dict()
