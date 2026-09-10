def detect_collisions(robots: list) -> list[tuple[int, int]]:
    """
    Validation check for physical conflicts between robots in a single tick.

    Two distinct failures are counted:

    1. Vertex conflict  - two robots occupying the same cell.
    2. Swap conflict    - two robots exchanging cells in the same tick, i.e.
                          driving straight through one another. A same-cell
                          check alone will never see this, so it has to be
                          tested against the previous positions.

    Returns a list of colliding robot ID pairs (should always be empty).
    """
    positions = {}
    collisions = []

    for robot in robots:
        pos = (robot.x, robot.y)
        if pos in positions:
            collisions.append((positions[pos], robot.id))
        positions[pos] = robot.id

    # Swap (edge) conflicts: A ends where B started and B ends where A started.
    for i, first in enumerate(robots):
        first_prev = (getattr(first, "prev_x", first.x), getattr(first, "prev_y", first.y))
        first_now = (first.x, first.y)
        if first_now == first_prev:
            continue  # did not move, cannot have swapped
        for second in robots[i + 1:]:
            second_prev = (getattr(second, "prev_x", second.x), getattr(second, "prev_y", second.y))
            second_now = (second.x, second.y)
            if second_now == second_prev:
                continue
            if first_now == second_prev and second_now == first_prev:
                collisions.append((first.id, second.id))

    return collisions

def detect_deadlock(robots: list) -> list[list[int]]:
    """
    Detect circular wait deadlocks.
    Builds wait-for graph and finds cycles using DFS.
    """
    waiting_for = {}
    
    for robot in robots:
        if robot.status != "waiting":
            continue
        
        if not robot.planned_path or robot.path_index >= len(robot.planned_path):
            continue
        
        next_cell = robot.planned_path[robot.path_index]
        
        # Find which robot is currently at next_cell
        for other in robots:
            if other.id != robot.id and (other.x, other.y) == next_cell:
                waiting_for[robot.id] = other.id
                break
    
    cycles = []
    visited = set()
    
    for start_id in waiting_for:
        if start_id in visited:
            continue
        
        path = []
        current = start_id
        path_set = set()
        
        while current is not None and current not in visited:
            if current in path_set:
                cycle_start = path.index(current)
                cycle = path[cycle_start:]
                cycles.append(cycle)
                break
            
            path.append(current)
            path_set.add(current)
            current = waiting_for.get(current)
        
        visited.update(path)
    
    return cycles


def _restored_status(robot) -> str:
    """What a unit should go back to after being backed out of a deadlock.

    A unit on an energy detour owns a charging pad, not a task, so restoring it
    to "idle" would silently cancel the charge run it is halfway through.
    """
    if robot.status == "charging":
        return "charging"
    if getattr(robot, "target_charger", None) is not None and not robot.current_task:
        return "moving_to_charge"
    if robot.carrying:
        return "moving_to_dropoff"
    return "moving_to_pickup" if robot.current_task else "idle"


def resolve_deadlock(robots: list, cycles: list[list[int]], warehouse, p2p_network=None, tick: int = 0):
    """
    Resolve deadlocks by making the highest-ID robot in each cycle back up and replan.
    If highest-ID robot has no free adjacent cells, falls back to others in cycle.
    """
    for cycle in cycles:
        candidates = sorted(cycle, reverse=True)
        resolved = False
        
        for yield_id in candidates:
            for robot in robots:
                if robot.id == yield_id:
                    neighbors = warehouse.get_neighbors(robot.x, robot.y)
                    occupied = set((r.x, r.y) for r in robots if r.id != robot.id)
                    free_neighbors = [n for n in neighbors if n not in occupied]
                    
                    if free_neighbors:
                        backup_cell = free_neighbors[0]
                        robot.prev_x, robot.prev_y = robot.x, robot.y
                        robot._move_to(backup_cell, p2p_network, tick)
                        robot._replan_path(p2p_network, tick)
                        robot.status = _restored_status(robot)
                        resolved = True
                        break
            if resolved:
                break
