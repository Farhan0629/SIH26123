"""FastAPI/WebSocket simulation server. Web demos include handling dwell;
headless benchmark continues to import the original robot.Robot directly.
"""
import asyncio
import json
import math
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from config import NUM_ROBOTS, TICK_INTERVAL, MAX_TICKS, TASKS_PER_EPISODE, TASK_SPAWN_INTERVAL, DEFAULT_ROBOT_STARTS
from warehouse import Warehouse
from presentation_robot import PresentationRobot as Robot
from p2p import P2PNetwork
from task_manager import TaskManager
from collision import detect_collisions, detect_deadlock, resolve_deadlock
from metrics import MetricsTracker
from baseline import BaselineRobot
from events import EventLogger

app = FastAPI(title="Edge-AI AMR Fleet Coordination")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
warehouse = Warehouse()
p2p_network = P2PNetwork()
task_manager = TaskManager(warehouse)
metrics = MetricsTracker()
event_logger = EventLogger()
ROBOT_STARTS = DEFAULT_ROBOT_STARTS
robots = [Robot(i + 1, ROBOT_STARTS[i % len(ROBOT_STARTS)], warehouse) for i in range(NUM_ROBOTS)]
for robot in robots:
    p2p_network.register_robot(robot.id)
sim_state = {"running": False, "paused": False, "tick": 0, "speed": 0.5}
connected_clients = []
baseline_running = False


def build_state_message(tick):
    return {"type": "state_update", "tick": tick, "robots": [r.to_dict() for r in robots], "warehouse": warehouse.to_serializable(), "tasks": task_manager.to_dict(), "metrics": metrics.to_dict(), "p2p_messages": p2p_network.get_recent_messages(20), "events": event_logger.get_recent_events(30), "sim": {"running": sim_state["running"], "paused": sim_state["paused"], "speed": sim_state["speed"]}}


async def broadcast_state(state):
    message = json.dumps(state)
    for client in connected_clients[:]:
        try:
            await client.send_text(message)
        except Exception:
            if client in connected_clients:
                connected_clients.remove(client)


async def simulation_loop():
    for _ in range(3):
        task_manager.generate_task()
    while sim_state["running"]:
        if sim_state["paused"]:
            await asyncio.sleep(0.1)
            continue
        sim_state["tick"] += 1
        tick = sim_state["tick"]
        metrics.episode_ticks = tick
        task_manager.allocate_tasks(robots, p2p_network, event_logger, tick)
        for robot in robots:
            action = robot.tick(tick, p2p_network, event_logger)
            if action == "picked_up" and robot.current_task:
                event_logger.add_event("pickup", f"UNIT-{robot.id} secured package #{robot.current_task['id']} at receiving ({robot.x},{robot.y})", robot_id=robot.id, tick=tick)
            elif action == "delivered":
                if robot.last_delivered_task_id:
                    task_manager.mark_completed(robot.last_delivered_task_id)
                    event_logger.add_event("delivery", f"UNIT-{robot.id} placed package #{robot.last_delivered_task_id} at dispatch ({robot.x},{robot.y})", robot_id=robot.id, tick=tick)
                metrics.record_task_completion(tick)
            elif action == "handling" and robot.handling and robot.handling["progress"] == 0:
                event_logger.add_event("pickup" if robot.handling["kind"] == "pickup" else "delivery", f"UNIT-{robot.id} {'reaching for' if robot.handling['kind'] == 'pickup' else 'lowering'} package #{robot.handling['task_id']}", robot_id=robot.id, tick=tick)
            elif action == "stepped_aside":
                event_logger.add_event("yield", f"UNIT-{robot.id} stepped aside to clear a bottleneck", robot_id=robot.id, tick=tick)
            elif action == "waited" and robot.consecutive_waits == 1:
                event_logger.add_event("yield", f"UNIT-{robot.id} yielding at ({robot.x},{robot.y})", robot_id=robot.id, tick=tick)
        for _ in detect_collisions(robots):
            metrics.record_collision()
        deadlocks = detect_deadlock(robots)
        if deadlocks:
            resolve_deadlock(robots, deadlocks, warehouse, p2p_network, tick)
        if tick % TASK_SPAWN_INTERVAL == 0 and len(task_manager.all_tasks) < TASKS_PER_EPISODE:
            task_manager.generate_task()
        if len(task_manager.completed_tasks) >= TASKS_PER_EPISODE or tick >= MAX_TICKS:
            sim_state["running"] = False
        await broadcast_state(build_state_message(tick))
        if sim_state["running"]:
            await asyncio.sleep(TICK_INTERVAL / max(0.1, sim_state["speed"]))


async def run_baseline_comparison():
    global baseline_running
    try:
        baseline_warehouse = Warehouse()
        baseline_robots = [BaselineRobot(i + 1, ROBOT_STARTS[i % len(ROBOT_STARTS)], baseline_warehouse) for i in range(NUM_ROBOTS)]
        rng = random.Random(42)
        tasks = [{"id": i + 1, "pickup": rng.choice(baseline_warehouse.pickup_points), "dropoff": rng.choice(baseline_warehouse.dropoff_points)} for i in range(TASKS_PER_EPISODE)]
        task_idx = 0
        for robot in baseline_robots:
            if task_idx < len(tasks):
                robot.assign_task(tasks[task_idx]); task_idx += 1
        completed, final_tick = 0, MAX_TICKS
        for tick in range(MAX_TICKS):
            if tick % 20 == 0:
                await asyncio.sleep(0)
            for robot in baseline_robots:
                if robot.tick(baseline_robots) == "delivered":
                    completed += 1
                    metrics.record_baseline_completion(tick)
                    if task_idx < len(tasks):
                        robot.assign_task(tasks[task_idx]); task_idx += 1
            if completed >= TASKS_PER_EPISODE:
                final_tick = tick
                break
        metrics.record_baseline_episode(final_tick)
        event_logger.add_event("system", f"Baseline {'completed' if completed >= TASKS_PER_EPISODE else 'timed out'}: {completed}/{TASKS_PER_EPISODE} deliveries. Web demo includes handling dwell; not a like-for-like benchmark.", tick=sim_state["tick"])
        await broadcast_state(build_state_message(sim_state["tick"]))
    finally:
        baseline_running = False


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    global baseline_running
    await ws.accept()
    connected_clients.append(ws)
    try:
        state = build_state_message(sim_state["tick"])
        state["type"] = "init"
        await ws.send_text(json.dumps(state))
        while True:
            raw = await ws.receive_text()
            try:
                command = json.loads(raw)
                if not isinstance(command, dict):
                    raise ValueError("Command must be an object")
                action = command.get("action")
                if action == "start":
                    if not sim_state["running"] and not baseline_running:
                        sim_state.update(running=True, paused=False, tick=0, speed=0.5)
                        warehouse.blocked_cells.clear()
                        p2p_network.clear_log()
                        for i, robot in enumerate(robots):
                            robot.__init__(robot.id, ROBOT_STARTS[i % len(ROBOT_STARTS)], warehouse)
                            p2p_network.register_robot(robot.id)
                        task_manager.__init__(warehouse)
                        metrics.__init__()
                        event_logger.clear()
                        event_logger.add_event("system", f"Demonstration started with {NUM_ROBOTS} humanoid units. Pickup and placement include simulated handling time.", tick=0)
                        asyncio.create_task(simulation_loop())
                elif action == "pause" and sim_state["running"]:
                    sim_state["paused"] = not sim_state["paused"]
                    event_logger.add_event("system", "Simulation paused" if sim_state["paused"] else "Simulation resumed", tick=sim_state["tick"])
                    await broadcast_state(build_state_message(sim_state["tick"]))
                elif action == "speed":
                    speed = float(command.get("value", 0.5))
                    if not math.isfinite(speed) or not 0.1 <= speed <= 4:
                        raise ValueError("Speed must be between 0.1 and 4")
                    sim_state["speed"] = speed
                    await broadcast_state(build_state_message(sim_state["tick"]))
                elif action in ("block_aisle", "unblock_aisle"):
                    x, y = int(command["x"]), int(command["y"])
                    if not (0 <= x < warehouse.width and 0 <= y < warehouse.height):
                        raise ValueError("Cell outside warehouse")
                    if action == "block_aisle":
                        if warehouse.grid[y][x] != 0 or any((r.x, r.y) == (x, y) for r in robots):
                            raise ValueError("Block an empty, unoccupied aisle cell")
                        warehouse.block_aisle(x, y)
                        p2p_network.broadcast(1, "blocked", {"x": x, "y": y, "tick": sim_state["tick"]})
                    else:
                        warehouse.unblock_aisle(x, y)
                    event_logger.add_event("hazard", f"Aisle ({x},{y}) {'blocked' if action == 'block_aisle' else 'restored'}", tick=sim_state["tick"])
                    await broadcast_state(build_state_message(sim_state["tick"]))
                elif action == "run_baseline" and not baseline_running:
                    baseline_running = True
                    asyncio.create_task(run_baseline_comparison())
            except (ValueError, TypeError, KeyError) as error:
                await ws.send_text(json.dumps({"type": "command_error", "message": str(error)}))
    except WebSocketDisconnect:
        pass
    finally:
        if ws in connected_clients:
            connected_clients.remove(ws)

@app.get("/")
def root():
    return {"status": "Edge-AI AMR Fleet Coordination Server", "version": "1.1-presentation"}

@app.get("/api/warehouse")
def get_warehouse():
    return warehouse.to_serializable()

@app.get("/api/metrics")
def get_metrics():
    return metrics.to_dict()
