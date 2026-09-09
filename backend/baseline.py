"""Traditional stop-and-wait baseline (no P2P, no intent sharing, no priority).

Two modes, both used by the headless benchmark:

* backoff_ticks = 0  -> the textbook naive controller: plan A* once, halt while
  another robot occupies the next cells, never replan. This is the honest
  "stop-and-wait" strawman, and it livelocks permanently whenever two robots
  block each other in an aisle. Those episodes never finish, so they cannot be
  timed — they are reported as deadlocks instead.
* backoff_ticks = N  -> the same controller plus the classic industrial escape
  hatch: after N consecutive halted ticks, re-run A* treating the other robots'
  current cells as obstacles. Still zero communication, zero intent exchange
  and zero negotiation, but it terminates, so it can be timed against the
  decentralized fleet.
"""
from pathfinding import a_star

BASELINE_BACKOFF_TICKS = 10


class BaselineRobot:
    def __init__(self, robot_id: int, start_pos: tuple[int, int], warehouse, backoff_ticks: int = 0):
        self.id = robot_id
        self.x, self.y = start_pos
        self.prev_x, self.prev_y = start_pos
        self.warehouse = warehouse
        self.planned_path = []
        self.path_index = 0
        self.current_task = None
        self.status = "idle"
        self.tasks_completed = 0
        self.total_ticks = 0
        self.backoff_ticks = backoff_ticks
        self.consecutive_waits = 0

    def _goal(self):
        if not self.current_task:
            return None
        return self.current_task["dropoff"] if self.status == "moving_to_dropoff" else self.current_task["pickup"]

    def _plan(self, goal, occupied=None):
        path = a_star(self.warehouse, (self.x, self.y), goal, occupied) if occupied else None
        if path is None:
            path = a_star(self.warehouse, (self.x, self.y), goal)
        self.planned_path = path or []
        self.path_index = 1 if len(self.planned_path) > 1 else 0

    def assign_task(self, task: dict):
        self.current_task = task
        self.status = "moving_to_pickup"
        self.consecutive_waits = 0
        self._plan(task["pickup"])

    def tick(self, all_robots: list) -> str:
        self.total_ticks += 1
        self.prev_x, self.prev_y = self.x, self.y

        if self.status == "idle" or not self.current_task:
            return "idle"

        # Arrival checks before moving
        if self.status == "moving_to_pickup" and (self.x, self.y) == self.current_task["pickup"]:
            self.status = "moving_to_dropoff"
            self.consecutive_waits = 0
            self._plan(self.current_task["dropoff"])
            return "picked_up"

        if self.status == "moving_to_dropoff" and (self.x, self.y) == self.current_task["dropoff"]:
            self.tasks_completed += 1
            self.current_task = None
            self.status = "idle"
            self.planned_path = []
            self.consecutive_waits = 0
            return "delivered"

        if not self.planned_path or self.path_index >= len(self.planned_path):
            return "idle"

        # STOP AND WAIT: halt if any robot sits on the next two cells of the path.
        blocked = False
        for other in all_robots:
            if other.id == self.id:
                continue
            for i in range(self.path_index, min(self.path_index + 2, len(self.planned_path))):
                if (other.x, other.y) == self.planned_path[i]:
                    blocked = True
                    break
            if blocked:
                break

        if blocked:
            self.consecutive_waits += 1
            if self.backoff_ticks and self.consecutive_waits >= self.backoff_ticks:
                goal = self._goal()
                if goal:
                    occupied = {(r.x, r.y) for r in all_robots if r.id != self.id}
                    self._plan(goal, occupied)
                self.consecutive_waits = 0
                return "rerouted"
            return "waited"

        self.consecutive_waits = 0

        next_cell = self.planned_path[self.path_index]
        self.x, self.y = next_cell
        self.path_index += 1

        if self.status == "moving_to_pickup" and (self.x, self.y) == self.current_task["pickup"]:
            self.status = "moving_to_dropoff"
            self._plan(self.current_task["dropoff"])
            return "picked_up"

        if self.status == "moving_to_dropoff" and (self.x, self.y) == self.current_task["dropoff"]:
            self.tasks_completed += 1
            self.current_task = None
            self.status = "idle"
            self.planned_path = []
            return "delivered"

        return "moved"
