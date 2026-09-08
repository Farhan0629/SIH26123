"""
Run 100 simulation episodes headlessly (no frontend needed).
Validates:
1. Zero collisions across all episodes
2. >= 20% improvement over baseline
"""

import asyncio
import random
from warehouse import Warehouse
from robot import Robot
from p2p import P2PNetwork
from task_manager import TaskManager
from collision import detect_collisions, detect_deadlock, resolve_deadlock
from baseline import BaselineRobot
from config import (
    NUM_ROBOTS,
    MAX_TICKS,
    TASK_SPAWN_INTERVAL,
    TASKS_PER_EPISODE,
    DEFAULT_ROBOT_STARTS,
)

ROBOT_STARTS = DEFAULT_ROBOT_STARTS
NUM_EPISODES = 100


async def run_smart_episode(seed: int):
    random.seed(seed)
    warehouse = Warehouse()
    p2p = P2PNetwork()
    tm = TaskManager(warehouse)
    robots = []
    for i in range(NUM_ROBOTS):
        r = Robot(i + 1, ROBOT_STARTS[i % len(ROBOT_STARTS)], warehouse)
        robots.append(r)
        p2p.register_robot(r.id)

    for _ in range(3):
        tm.generate_task()

    total_collisions = 0
    final_tick = MAX_TICKS
    for tick in range(MAX_TICKS):
        tm.allocate_tasks(robots, p2p)
        for r in robots:
            action = r.tick(tick, p2p)
            if action == "delivered":
                if hasattr(r, "last_delivered_task_id") and r.last_delivered_task_id:
                    tm.mark_completed(r.last_delivered_task_id)

        collisions = detect_collisions(robots)
        total_collisions += len(collisions)

        deadlocks = detect_deadlock(robots)
        if deadlocks:
            resolve_deadlock(robots, deadlocks, warehouse, p2p, tick)

        if tick % TASK_SPAWN_INTERVAL == 0 and len(tm.all_tasks) < TASKS_PER_EPISODE:
            tm.generate_task()

        if len(tm.completed_tasks) >= TASKS_PER_EPISODE:
            final_tick = tick
            break

    return final_tick, total_collisions, len(tm.completed_tasks)


def run_baseline_episode(seed: int):
    random.seed(seed)
    warehouse = Warehouse()
    robots = [BaselineRobot(i + 1, ROBOT_STARTS[i % len(ROBOT_STARTS)], warehouse) for i in range(NUM_ROBOTS)]

    tasks = []
    for _ in range(TASKS_PER_EPISODE):
        p = random.choice(warehouse.pickup_points)
        d = random.choice(warehouse.dropoff_points)
        tasks.append({"id": len(tasks) + 1, "pickup": p, "dropoff": d})

    task_idx = 0
    for r in robots:
        if task_idx < len(tasks):
            r.assign_task(tasks[task_idx])
            task_idx += 1

    completed = 0
    final_tick = MAX_TICKS
    for tick in range(MAX_TICKS):
        for r in robots:
            action = r.tick(robots)
            if action == "delivered":
                completed += 1
                if task_idx < len(tasks):
                    r.assign_task(tasks[task_idx])
                    task_idx += 1
        if completed >= TASKS_PER_EPISODE:
            final_tick = tick
            break

    return final_tick, completed


async def main():
    print(f"Running {NUM_EPISODES} episodes...")
    print("=" * 60)

    smart_ticks = []
    baseline_ticks = []
    total_collisions = 0

    for ep in range(NUM_EPISODES):
        seed = ep * 42

        # Smart system
        s_ticks, s_col, s_comp = await run_smart_episode(seed)
        total_collisions += s_col
        smart_ticks.append(s_ticks)

        # Baseline
        b_ticks, b_comp = run_baseline_episode(seed)
        baseline_ticks.append(b_ticks)

        if (ep + 1) % 10 == 0:
            print(f"  Episode {ep + 1}/{NUM_EPISODES} done (Smart: {s_ticks}t, Baseline: {b_ticks}t)")

    smart_avg = sum(smart_ticks) / len(smart_ticks)
    baseline_avg = sum(baseline_ticks) / len(baseline_ticks)
    improvement = ((baseline_avg - smart_avg) / baseline_avg) * 100

    print("=" * 60)
    print(f"RESULTS ({NUM_EPISODES} episodes):")
    pass_col = "[PASS]" if total_collisions == 0 else "[FAIL]"
    pass_imp = "[PASS]" if improvement >= 20 else "[FAIL]"
    print(f"  Total Collisions:  {total_collisions}  {pass_col}")
    print(f"  Smart Avg Ticks:   {smart_avg:.1f}")
    print(f"  Baseline Avg Ticks:{baseline_avg:.1f}")
    print(f"  Improvement:       {improvement:.1f}%  {pass_imp}")


if __name__ == "__main__":
    asyncio.run(main())
