"""Headless benchmark for the SIH 26123 success criteria.

Success criteria under test:
  * zero inter-robot collisions
  * >= 20% reduction in total task completion time vs stop-and-wait

How this benchmark is kept honest
---------------------------------
1. FIXED MANIFEST     Each episode stages exactly one package per loading
                      table before tick 1 and never creates work mid-episode.
                      The decentralized fleet and the stop-and-wait baseline
                      get the identical manifest and identical start cells, so
                      the only variable is the coordination algorithm.
                      The benchmark runs single-leg deliveries (no putaway) so
                      the fleet and the baseline move identical cargo; the
                      two-leg storage cycle is a demonstration mode, not a way
                      to inflate this number.
2. SWAP DETECTION     Collision auditing counts same-cell conflicts AND swap
                      (edge) conflicts - two robots trading cells in one tick,
                      i.e. driving through each other. A same-cell check alone
                      is blind to that.
3. EXCLUDED TIMEOUTS  An episode that hits MAX_TICKS never finished, so its
                      tick count is a censoring artifact, not a completion
                      time. Such episodes are excluded from both averages and
                      reported separately.
4. HARD ASSERTS       Any collision, any swap, any fleet timeout, or a headline
                      improvement below 20% exits non-zero. This script cannot
                      print a pass it did not earn.
5. DISCLOSED BASELINE The textbook stop-and-wait controller (plan once, halt
                      when blocked, never replan) livelocks permanently in most
                      episodes, so it cannot be timed at all. It is reported as
                      a deadlock count. For the timing comparison the baseline
                      gets the classic industrial escape hatch: after N stalled
                      ticks it re-runs A* around the blocker. N decides the
                      headline number, so the full sensitivity curve is printed
                      instead of a single flattering value. The headline uses
                      N = 10 ticks = 1.0 s of physical stall at 10 Hz.
6. SAME ENERGY RULES  Both fleets start every unit at BATTERY_MAX. Autonomous
                      charging stays enabled for the decentralized fleet, so if
                      an episode does run a unit down below the threshold the
                      detour is paid for inside the measured time.

Run:  python test_simulation.py
"""
import asyncio
import random
import sys

from config import MAX_TICKS, NUM_ROBOTS, DEFAULT_ROBOT_STARTS, TICK_RATE
from warehouse import Warehouse
from robot import Robot
from p2p import P2PNetwork
from task_manager import TaskManager
from collision import detect_collisions, detect_deadlock, resolve_deadlock
from baseline import BaselineRobot, BASELINE_BACKOFF_TICKS

NUM_EPISODES = 100
REQUIRED_IMPROVEMENT_PCT = 20.0
HEADLINE_BACKOFF = BASELINE_BACKOFF_TICKS
SENSITIVITY_BACKOFFS = (5, 8, 10, 15, 20)


def episode_setup(seed: int, table_count: int):
    """Deterministic per-episode scenario shared by every algorithm."""
    rng = random.Random(seed)
    starts = rng.sample(DEFAULT_ROBOT_STARTS, NUM_ROBOTS)
    pairing = list(range(table_count))
    rng.shuffle(pairing)
    return starts, pairing


def count_same_cell(robots) -> int:
    """Robots sharing a cell after this tick."""
    seen = set()
    conflicts = 0
    for robot in robots:
        cell = (robot.x, robot.y)
        if cell in seen:
            conflicts += 1
        seen.add(cell)
    return conflicts


def count_swaps(robots) -> int:
    """Robots that exchanged cells during this tick (passed through each other)."""
    swaps = 0
    for index, first in enumerate(robots):
        first_prev = (getattr(first, "prev_x", first.x), getattr(first, "prev_y", first.y))
        first_now = (first.x, first.y)
        if first_now == first_prev:
            continue
        for second in robots[index + 1:]:
            second_prev = (getattr(second, "prev_x", second.x), getattr(second, "prev_y", second.y))
            second_now = (second.x, second.y)
            if second_now == second_prev:
                continue
            if first_now == second_prev and second_now == first_prev:
                swaps += 1
    return swaps


def count_charger_conflicts(robots) -> int:
    """Two units must never hold the same charging pad at the same time."""
    claims = {}
    conflicts = 0
    for robot in robots:
        pad = getattr(robot, "target_charger", None)
        if pad is None:
            continue
        if pad in claims:
            conflicts += 1
        claims[pad] = robot.id
    return conflicts


async def run_smart_episode(seed: int) -> dict:
    """Decentralized P2P fleet on the fixed manifest."""
    warehouse = Warehouse()
    starts, pairing = episode_setup(seed, len(warehouse.pickup_points))

    p2p = P2PNetwork()
    task_manager = TaskManager(warehouse)
    total = len(task_manager.generate_manifest(pairing))

    robots = [Robot(index + 1, starts[index], warehouse) for index in range(NUM_ROBOTS)]
    for robot in robots:
        p2p.register_robot(robot.id)

    same_cell = swaps = completed = pad_conflicts = 0
    final_tick = None

    for tick in range(1, MAX_TICKS + 1):
        task_manager.allocate_tasks(robots, p2p, None, tick)

        for robot in robots:
            if robot.tick(tick, p2p, None) == "delivered" and robot.last_delivered_task_id:
                task_manager.mark_completed(robot.last_delivered_task_id)
                completed += 1

        same_cell += count_same_cell(robots)
        swaps += count_swaps(robots)
        pad_conflicts += count_charger_conflicts(robots)

        deadlocks = detect_deadlock(robots)
        if deadlocks:
            resolve_deadlock(robots, deadlocks, warehouse, p2p, tick)
            # The deadlock breaker also moves robots, so audit its result too.
            same_cell += count_same_cell(robots)
            swaps += count_swaps(robots)

        if completed >= total:
            final_tick = tick
            break

    return {
        "ticks": final_tick,
        "completed": completed,
        "total": total,
        "same_cell": same_cell,
        "swaps": swaps,
        "pad_conflicts": pad_conflicts,
        "audit_pairs": len(detect_collisions(robots)),
    }


def run_baseline_episode(seed: int, backoff_ticks: int = 0) -> dict:
    """Stop-and-wait fleet on the same fixed manifest and the same start cells."""
    warehouse = Warehouse()
    starts, pairing = episode_setup(seed, len(warehouse.pickup_points))

    dropoffs = list(warehouse.dropoff_points)
    tasks = [
        {"id": index + 1, "pickup": pickup, "dropoff": dropoffs[pairing[index]]}
        for index, pickup in enumerate(warehouse.pickup_points)
    ]
    total = len(tasks)

    robots = [BaselineRobot(index + 1, starts[index], warehouse, backoff_ticks) for index in range(NUM_ROBOTS)]

    task_index = 0
    for robot in robots:
        if task_index < total:
            robot.assign_task(tasks[task_index])
            task_index += 1

    same_cell = swaps = completed = 0
    final_tick = None

    for tick in range(1, MAX_TICKS + 1):
        for robot in robots:
            if robot.tick(robots) == "delivered":
                completed += 1
                if task_index < total:
                    robot.assign_task(tasks[task_index])
                    task_index += 1

        same_cell += count_same_cell(robots)
        swaps += count_swaps(robots)

        if completed >= total:
            final_tick = tick
            break

    return {
        "ticks": final_tick,
        "completed": completed,
        "total": total,
        "same_cell": same_cell,
        "swaps": swaps,
    }


def mean(values) -> float:
    return sum(values) / len(values) if values else 0.0


async def main() -> int:
    print("=" * 72)
    print("SIH 26123 - decentralized AMR fleet vs stop-and-wait baseline")
    print(f"Episodes: {NUM_EPISODES} | Fleet: {NUM_ROBOTS} AMRs | Timeout: {MAX_TICKS} ticks @ {TICK_RATE}Hz")
    print("Workload: fixed manifest, one package per loading table, staged before tick 1")
    print("Both algorithms receive identical manifests and identical start cells")
    print("=" * 72)

    smart_by_seed = {}
    baseline_by_backoff = {backoff: {} for backoff in SENSITIVITY_BACKOFFS}
    naive_deadlocks = 0
    smart_same_cell = smart_swaps = smart_timeouts = smart_pad_conflicts = 0

    for episode in range(NUM_EPISODES):
        seed = episode * 42 + 7

        smart = await run_smart_episode(seed)
        smart_by_seed[seed] = smart
        smart_same_cell += smart["same_cell"]
        smart_swaps += smart["swaps"]
        smart_pad_conflicts += smart["pad_conflicts"]
        if smart["ticks"] is None:
            smart_timeouts += 1

        if run_baseline_episode(seed, 0)["ticks"] is None:
            naive_deadlocks += 1

        for backoff in SENSITIVITY_BACKOFFS:
            baseline_by_backoff[backoff][seed] = run_baseline_episode(seed, backoff)

        if (episode + 1) % 20 == 0:
            print(f"  ... {episode + 1}/{NUM_EPISODES} episodes")

    def compare(backoff):
        smart_ticks, base_ticks, excluded = [], [], 0
        for seed, smart in smart_by_seed.items():
            base = baseline_by_backoff[backoff][seed]
            if smart["ticks"] is None or base["ticks"] is None:
                excluded += 1
                continue
            smart_ticks.append(smart["ticks"])
            base_ticks.append(base["ticks"])
        smart_avg, base_avg = mean(smart_ticks), mean(base_ticks)
        improvement = ((base_avg - smart_avg) / base_avg * 100.0) if base_avg else 0.0
        return smart_avg, base_avg, improvement, len(smart_ticks), excluded

    baseline_same_cell = sum(r["same_cell"] for r in baseline_by_backoff[HEADLINE_BACKOFF].values())
    baseline_swaps = sum(r["swaps"] for r in baseline_by_backoff[HEADLINE_BACKOFF].values())
    baseline_timeouts = sum(1 for r in baseline_by_backoff[HEADLINE_BACKOFF].values() if r["ticks"] is None)

    print("-" * 72)
    print("SAFETY (decentralized fleet)")
    print(f"  same-cell collisions      : {smart_same_cell}")
    print(f"  swap  collisions          : {smart_swaps}")
    print(f"  double-booked charge pads : {smart_pad_conflicts}")
    print(f"  episodes completed        : {NUM_EPISODES - smart_timeouts}/{NUM_EPISODES}")
    print("-" * 72)
    print("BASELINE BEHAVIOUR")
    print(f"  textbook stop-and-wait deadlocked permanently in {naive_deadlocks}/{NUM_EPISODES} episodes")
    print("  (plan once, halt when blocked, never replan - it cannot be timed at all)")
    print(f"  with a {HEADLINE_BACKOFF}-tick reroute escape hatch it finished {NUM_EPISODES - baseline_timeouts}/{NUM_EPISODES}")
    print(f"  baseline collisions       : {baseline_same_cell} same-cell / {baseline_swaps} swap")
    print("-" * 72)
    print("COMPLETION TIME (timeout episodes excluded from both averages)")
    for backoff in SENSITIVITY_BACKOFFS:
        smart_avg, base_avg, improvement, counted, excluded = compare(backoff)
        marker = "  <== headline" if backoff == HEADLINE_BACKOFF else ""
        print(
            f"  baseline stall tolerance {backoff:2d} ticks ({backoff / TICK_RATE:.1f}s): "
            f"fleet {smart_avg:6.1f} vs baseline {base_avg:6.1f} ticks -> {improvement:5.1f}% "
            f"[n={counted}, excluded={excluded}]{marker}"
        )

    smart_avg, base_avg, improvement, counted, excluded = compare(HEADLINE_BACKOFF)
    print("-" * 72)
    print(f"HEADLINE: {improvement:.1f}% reduction in task completion time "
          f"({smart_avg:.1f} vs {base_avg:.1f} ticks over {counted} episodes, {excluded} excluded)")
    print("-" * 72)

    failures = []
    if counted == 0:
        failures.append("no episode completed under both algorithms")
    if smart_same_cell:
        failures.append(f"{smart_same_cell} same-cell collisions")
    if smart_swaps:
        failures.append(f"{smart_swaps} swap collisions")
    if smart_pad_conflicts:
        failures.append(f"{smart_pad_conflicts} double-booked charging pads")
    if smart_timeouts:
        failures.append(f"{smart_timeouts} fleet timeouts")
    if improvement < REQUIRED_IMPROVEMENT_PCT:
        failures.append(
            f"headline improvement {improvement:.1f}% is below the {REQUIRED_IMPROVEMENT_PCT:.0f}% target"
        )

    if failures:
        print("[FAIL] " + "; ".join(failures))
        print("       This is a measured result, not a crash. The safety criterion and")
        print("       the timing criterion are reported independently on purpose.")
        return 1

    print("[PASS] zero collisions (same-cell and swap) across all episodes")
    print("[PASS] no charging pad was ever claimed by two units at once")
    print(f"[PASS] {improvement:.1f}% faster than stop-and-wait (target {REQUIRED_IMPROVEMENT_PCT:.0f}%)")

    # Hard asserts, so an accidental edit to the reporting above still fails loudly.
    assert smart_same_cell == 0, "same-cell collisions detected"
    assert smart_swaps == 0, "swap collisions detected"
    assert smart_pad_conflicts == 0, "two robots claimed the same charging pad"
    assert smart_timeouts == 0, "fleet episode timed out"
    assert improvement >= REQUIRED_IMPROVEMENT_PCT, "improvement below target"
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
