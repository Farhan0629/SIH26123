"""FastAPI/WebSocket simulation server. Web demos include handling dwell;
headless benchmark continues to import the original robot.Robot directly.

The demonstration floor uses a fixed manifest: six packages start staged on the
west loading tables and six delivery tables on the east start empty. No package
is created mid-episode, so nothing appears out of nowhere on screen.

Two disruption drills are exposed over the socket so a judge can trigger the
hard requirements live:
  * block_aisle      - closes an aisle cell. Cells are chosen by hand from the
                       dashboard (click or drag on the floor) while the demo is
                       paused, or picked by the server when no coordinates are
                       sent. The fleet gossips the hazard over the mesh and each
                       unit replans on its own onboard A* once the floor runs.
  * toggle_partition - simulates a Wi-Fi dead zone. The unit stops receiving
                       and sending mesh traffic and must keep itself safe on
                       onboard sensing alone, which is what "no central server"
                       actually has to survive.

Barrier edits are only accepted while the simulation is paused or has not been
started, so an obstacle can never appear underneath a unit that is mid-step.
"""
import asyncio
import json
import math
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from config import NUM_ROBOTS, TICK_INTERVAL, MAX_TICKS, DEFAULT_ROBOT_STARTS, FACILITY_BEACON_ID
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
task_manager.generate_manifest()
metrics = MetricsTracker()
event_logger = EventLogger()
ROBOT_STARTS = DEFAULT_ROBOT_STARTS
robots = [Robot(i + 1, ROBOT_STARTS[i % len(ROBOT_STARTS)], warehouse) for i in range(NUM_ROBOTS)]
for robot in robots:
    p2p_network.register_robot(robot.id)
sim_state = {"running": False, "paused": False, "tick": 0, "speed": 0.5}
connected_clients = []
baseline_running = False


def find_robot(robot_id):
    for robot in robots:
        if robot.id == robot_id:
            return robot
    raise ValueError(f"No unit with id {robot_id}")


def floor_is_still():
    """True when barriers may be edited: paused, or not started yet."""
    return not sim_state["running"] or sim_state["paused"]


def pick_choke_cell():
    """Choose an aisle cell that actually disrupts someone.

    Preference order: a cell further along a moving unit's own planned route
    (skipping its next step so the block never lands under its feet), then any
    free cell in the central aisles. Returns None if the floor is wide open.
    """
    occupied = {(robot.x, robot.y) for robot in robots}

    def usable(x, y):
        return (
            0 <= x < warehouse.width
            and 0 <= y < warehouse.height
            and warehouse.grid[y][x] == 0
            and (x, y) not in occupied
            and (x, y) not in warehouse.blocked_cells
        )

    for robot in robots:
        for cell in (robot.planned_path or [])[2:]:
            x, y = cell[0], cell[1]
            if usable(x, y):
                return x, y

    for x in range(8, 12):
        for y in range(1, warehouse.height - 1):
            if usable(x, y):
                return x, y
    return None


def build_state_message(tick):
    return {"type": "state_update", "tick": tick, "robots": [r.to_dict() for r in robots], "warehouse": warehouse.to_serializable(), "tasks": task_manager.to_dict(), "metrics": metrics.to_dict(), "p2p_messages": p2p_network.get_recent_messages(20), "events": event_logger.get_recent_events(30), "network": {"partitioned": p2p_network.partitioned_ids()}, "sim": {"running": sim_state["running"], "paused": sim_state["paused"], "speed": sim_state["speed"]}}


async def broadcast_state(state):
    message = json.dumps(state)
    for client in connected_clients[:]:
        try:
            await client.send_text(message)
        except Exception:
            if client in connected_clients:
                connected_clients.remove(client)


async def simulation_loop():
    manifest_size = len(task_manager.all_tasks)
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
                event_logger.add_event("pickup", f"{robot.name} secured package #{robot.current_task['id']} from loading table ({robot.x},{robot.y})", robot_id=robot.id, tick=tick)
            elif action == "delivered":
                if robot.last_delivered_task_id:
                    task_manager.mark_completed(robot.last_delivered_task_id)
                    event_logger.add_event("delivery", f"{robot.name} placed package #{robot.last_delivered_task_id} on delivery table ({robot.x},{robot.y})", robot_id=robot.id, tick=tick)
                metrics.record_task_completion(tick)
            elif action == "handling" and robot.handling and robot.handling["progress"] == 0:
                event_logger.add_event("pickup" if robot.handling["kind"] == "pickup" else "delivery", f"{robot.name} {'reaching for' if robot.handling['kind'] == 'pickup' else 'lowering'} package #{robot.handling['task_id']}", robot_id=robot.id, tick=tick)
            elif action == "stepped_aside":
                event_logger.add_event("yield", f"{robot.name} stepped aside to clear a bottleneck", robot_id=robot.id, tick=tick)
            elif action == "waited" and robot.consecutive_waits == 1:
                event_logger.add_event("yield", f"{robot.name} yielding at ({robot.x},{robot.y})", robot_id=robot.id, tick=tick)
        for _ in detect_collisions(robots):
            metrics.record_collision()
        deadlocks = detect_deadlock(robots)
        if deadlocks:
            resolve_deadlock(robots, deadlocks, warehouse, p2p_network, tick)
        if (manifest_size and len(task_manager.completed_tasks) >= manifest_size) or tick >= MAX_TICKS:
            sim_state["running"] = False
            if manifest_size and len(task_manager.completed_tasks) >= manifest_size:
                event_logger.add_event("system", f"All {manifest_size} packages moved to the delivery tables in {tick} ticks", tick=tick)
        await broadcast_state(build_state_message(tick))
        if sim_state["running"]:
            await asyncio.sleep(TICK_INTERVAL / max(0.1, sim_state["speed"]))


async def run_baseline_comparison():
    global baseline_running
    try:
        baseline_warehouse = Warehouse()
        baseline_robots = [BaselineRobot(i + 1, ROBOT_STARTS[i % len(ROBOT_STARTS)], baseline_warehouse) for i in range(NUM_ROBOTS)]
        # Same fixed manifest as the live demo so both runs move identical packages.
        pairs = zip(baseline_warehouse.pickup_points, reversed(baseline_warehouse.dropoff_points))
        tasks = [{"id": i + 1, "pickup": pickup, "dropoff": dropoff} for i, (pickup, dropoff) in enumerate(pairs)]
        total = len(tasks)
        task_idx = 0
        for robot in baseline_robots:
            if task_idx < total:
                robot.assign_task(tasks[task_idx]); task_idx += 1
        completed, final_tick = 0, MAX_TICKS
        for tick in range(MAX_TICKS):
            if tick % 20 == 0:
                await asyncio.sleep(0)
            for robot in baseline_robots:
                if robot.tick(baseline_robots) == "delivered":
                    completed += 1
                    metrics.record_baseline_completion(tick)
                    if task_idx < total:
                        robot.assign_task(tasks[task_idx]); task_idx += 1
            if completed >= total:
                final_tick = tick
                break
        metrics.record_baseline_episode(final_tick)
        event_logger.add_event("system", f"Baseline {'completed' if completed >= total else 'timed out'}: {completed}/{total} deliveries. Web demo includes handling dwell; not a like-for-like benchmark.", tick=sim_state["tick"])
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
                            p2p_network.restore_robot(robot.id)
                        task_manager.__init__(warehouse)
                        staged = len(task_manager.generate_manifest())
                        metrics.__init__()
                        event_logger.clear()
                        event_logger.add_event("system", f"{staged} packages staged on the loading tables. {', '.join(r.name for r in robots)} will carry each one across to an empty delivery table.", tick=0)
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
                    # Barriers are laid out by hand: the dashboard sends one
                    # command per cell as the operator clicks or drags across
                    # the floor. Editing is only legal while the floor is still,
                    # which the client also enforces - this is the server-side
                    # guarantee that nothing appears under a moving unit.
                    if not floor_is_still():
                        raise ValueError("Pause the demonstration before editing barriers")
                    # Coordinates stay optional: with none, the server picks a
                    # cell on a unit's own route so the drill is guaranteed to
                    # force a live reroute on resume.
                    if command.get("x") is None and action == "block_aisle":
                        cell = pick_choke_cell()
                        if cell is None:
                            raise ValueError("No free aisle cell available to block")
                        x, y = cell
                    else:
                        x, y = int(command["x"]), int(command["y"])
                    if not (0 <= x < warehouse.width and 0 <= y < warehouse.height):
                        raise ValueError("Cell outside warehouse")
                    if action == "block_aisle":
                        if warehouse.grid[y][x] != 0 or any((r.x, r.y) == (x, y) for r in robots):
                            raise ValueError("Block an empty, unoccupied aisle cell")
                        warehouse.block_aisle(x, y)
                        # Gossip the hazard from the facility beacon so every
                        # unit hears it. Broadcasting as robot 1 skipped robot 1.
                        p2p_network.broadcast(FACILITY_BEACON_ID, "blocked", {"x": x, "y": y, "tick": sim_state["tick"]})
                    else:
                        warehouse.unblock_aisle(x, y)
                    event_logger.add_event("hazard", f"Aisle ({x},{y}) {'blocked - hazard gossiped over the mesh, units replanning' if action == 'block_aisle' else 'restored'}", tick=sim_state["tick"])
                    await broadcast_state(build_state_message(sim_state["tick"]))
                elif action == "clear_blocks":
                    cleared = len(warehouse.blocked_cells)
                    warehouse.blocked_cells.clear()
                    event_logger.add_event("hazard", f"{cleared} blocked aisle cell(s) cleared" if cleared else "No blocked aisles to clear", tick=sim_state["tick"])
                    await broadcast_state(build_state_message(sim_state["tick"]))
                elif action == "toggle_partition":
                    robot = find_robot(int(command["robot_id"]))
                    if p2p_network.is_partitioned.get(robot.id, False):
                        p2p_network.restore_robot(robot.id)
                        event_logger.add_event("system", f"{robot.name} reconnected to the mesh", robot_id=robot.id, tick=sim_state["tick"])
                    else:
                        p2p_network.partition_robot(robot.id)
                        event_logger.add_event("hazard", f"{robot.name} lost radio in a Wi-Fi dead zone - navigating on onboard sensors only", robot_id=robot.id, tick=sim_state["tick"])
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
    return {"status": "Edge-AI AMR Fleet Coordination Server", "version": "1.4-manual-barriers"}

@app.get("/api/warehouse")
def get_warehouse():
    return warehouse.to_serializable()

@app.get("/api/metrics")
def get_metrics():
    return metrics.to_dict()
