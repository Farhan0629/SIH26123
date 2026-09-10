"""Headless replay of the web demonstration: storage cycle + autonomous charging.

Not part of the benchmark. It exists so the two new behaviours can be verified
without a browser: every package must run PUTAWAY then PICK, every unit that
drops below the threshold must charge and come back, and no two units may ever
hold the same pad.
"""
import asyncio

from config import NUM_ROBOTS, DEFAULT_ROBOT_STARTS, MAX_TICKS, DEMO_BATTERY_LEVELS
from warehouse import Warehouse
from presentation_robot import PresentationRobot as Robot
from p2p import P2PNetwork
from task_manager import TaskManager
from collision import detect_collisions, detect_deadlock, resolve_deadlock
from events import EventLogger


async def main() -> int:
    warehouse = Warehouse()
    p2p = P2PNetwork()
    tasks = TaskManager(warehouse)
    total = len(tasks.generate_manifest(storage=True))
    logger = EventLogger(max_events=1000)
    robots = [
        Robot(i + 1, DEFAULT_ROBOT_STARTS[i], warehouse, DEMO_BATTERY_LEVELS[i % len(DEMO_BATTERY_LEVELS)])
        for i in range(NUM_ROBOTS)
    ]
    for robot in robots:
        p2p.register_robot(robot.id)

    print(f"rack islands : {[island['code'] for island in warehouse.rack_islands]}")
    print(f"rack slots   : {len(warehouse.rack_slots)}")
    print(f"reserved     : {[(s['code'], s['task_id']) for s in warehouse.rack_slots if s['state'] != 'empty']}")
    print(f"opening SoC  : {[(r.name, r.battery) for r in robots]}")

    collisions = pad_conflicts = stored = delivered = 0
    final = None
    for tick in range(1, MAX_TICKS + 1):
        tasks.allocate_tasks(robots, p2p, logger, tick)
        for robot in robots:
            action = robot.tick(tick, p2p, logger)
            if action == "picked_up" and robot.current_task:
                tasks.note_pickup(robot.current_task["id"])
            elif action == "delivered" and robot.last_delivered_task_id:
                outcome, _ = tasks.complete_leg(robot.last_delivered_task_id)
                if outcome == "stored":
                    stored += 1
                elif outcome == "delivered":
                    delivered += 1
        collisions += len(detect_collisions(robots))
        claims = {}
        for robot in robots:
            pad = robot.target_charger
            if pad is not None:
                if pad in claims:
                    pad_conflicts += 1
                claims[pad] = robot.id
        cycles = detect_deadlock(robots)
        if cycles:
            resolve_deadlock(robots, cycles, warehouse, p2p, tick)
        if delivered >= total:
            final = tick
            break

    print("-" * 68)
    print(f"ticks             : {final}")
    print(f"putaway legs      : {stored}/{total}")
    print(f"dispatched        : {delivered}/{total}")
    print(f"charge cycles     : {[(r.name, r.charge_cycles, round(r.battery, 1)) for r in robots]}")
    print(f"collisions        : {collisions}")
    print(f"pad double-books  : {pad_conflicts}")
    print(f"slots left dirty  : {[s['code'] for s in warehouse.rack_slots if s['state'] != 'empty']}")
    print("-" * 68)
    for event in logger.events:
        if event["type"] in ("charging", "storage"):
            print(f"  [{event['type']:>8}] {event['text']}")

    ok = (
        final is not None
        and stored == total
        and delivered == total
        and collisions == 0
        and pad_conflicts == 0
        and sum(r.charge_cycles for r in robots) > 0
        and not [s for s in warehouse.rack_slots if s["state"] != "empty"]
    )
    print("[PASS] storage cycle and autonomous charging both ran clean" if ok else "[FAIL] see counters above")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
