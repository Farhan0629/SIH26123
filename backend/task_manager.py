import random

from config import robot_name

# Which rack island each staged package is routed to. The order deliberately
# hops between bands and columns so the six putaway runs use different aisles
# instead of queueing into one corridor.
ISLAND_ORDER = (0, 4, 8, 2, 3, 7, 1, 5, 6)


class Task:
    """One package and the legs it still has to travel.

    A package is a single unit of work with a stable id, so "package #3" means
    the same carton from the moment it is staged to the moment it leaves on a
    delivery table. What changes is its stage:

      direct      loading table -> delivery table          (benchmark mode)
      putaway     loading table -> rack slot   (RECEIVE -> PUTAWAY -> STORE)
      retrieval   rack slot     -> delivery table (PICK -> PACK -> DISPATCH)

    The retrieval leg is returned to the auction, so the unit that stores a
    carton is usually not the unit that ships it.
    """
    _counter = 0

    def __init__(self, pickup, dropoff, stage="direct", slot=None, origin=None, destination=None):
        Task._counter += 1
        self.id = Task._counter
        self.pickup = pickup
        self.dropoff = dropoff
        self.assigned_to = None  # robot_id or None
        self.status = "pending"  # "pending" | "assigned" | "completed"
        self.stage = stage       # "direct" | "putaway" | "retrieval"
        self.origin = origin or pickup            # loading table it arrived at
        self.destination = destination or dropoff  # delivery table it ships from
        self.slot_id = slot["id"] if slot else None
        self.slot_code = slot["code"] if slot else None
        self.slot_cell = tuple(slot["cell"]) if slot else None
        self.slot_access = tuple(slot["access"]) if slot else None
        self.pickup_kind = "table"
        self.dropoff_kind = "rack" if stage == "putaway" else "table"

    def as_payload(self) -> dict:
        """What a robot (and the 3D view) needs to know about the current leg."""
        return {
            "id": self.id,
            "pickup": self.pickup,
            "dropoff": self.dropoff,
            "stage": self.stage,
            "pickup_kind": self.pickup_kind,
            "dropoff_kind": self.dropoff_kind,
            "slot_code": self.slot_code,
            "slot_cell": list(self.slot_cell) if self.slot_cell else None,
            "origin": list(self.origin),
            "destination": list(self.destination),
        }


class TaskManager:
    """
    Decentralized task allocation using a simplified bid auction.
    """

    def __init__(self, warehouse):
        self.warehouse = warehouse
        # Package labels restart at #1 for every demonstration run.
        Task._counter = 0
        self.pending_tasks: list[Task] = []
        self.active_tasks: list[Task] = []
        self.completed_tasks: list[Task] = []
        self.all_tasks: list[Task] = []
        self.stored_count = 0

    def _choose_slot(self, index: int, pickup: tuple[int, int]) -> dict | None:
        """Pick an empty rack slot for the package staged at `pickup`."""
        islands = getattr(self.warehouse, "rack_islands", [])
        slots = getattr(self.warehouse, "rack_slots", [])
        if not islands or not slots:
            return None
        island = islands[ISLAND_ORDER[index % len(ISLAND_ORDER)] % len(islands)]
        candidates = [slots[slot_id] for slot_id in island["slots"] if slots[slot_id]["state"] == "empty"]
        if not candidates:
            candidates = [slot for slot in slots if slot["state"] == "empty"]
        if not candidates:
            return None
        # Within the island, take the face nearest the staging table so the
        # putaway leg approaches from the aisle it is already travelling.
        return min(
            candidates,
            key=lambda slot: (abs(slot["access"][1] - pickup[1]), slot["access"][0], slot["id"]),
        )

    def generate_manifest(self, pairing: list[int] | None = None, storage: bool = False) -> list[Task]:
        """Stage exactly one package per loading table.

        By default loading table N is paired with the delivery table at the
        opposite end of the floor (reversed order), so every route crosses the
        warehouse and the fleet meets in the aisles instead of running parallel
        lanes.

        `pairing` optionally supplies delivery-table indices (a permutation) so
        the headless benchmark can vary the manifest between episodes while
        keeping the same rule: six packages, staged once, before the clock
        starts. Nothing is ever created mid-episode.

        `storage=True` runs the full warehouse cycle: each package is first put
        away into a reserved rack slot and only then picked and dispatched. The
        manifest size is still six packages - a stored carton is the same
        package mid-journey, not a new one - so mission progress stays honest.
        """
        pickups = list(self.warehouse.pickup_points)
        dropoffs = list(self.warehouse.dropoff_points)
        if pairing is None:
            targets = list(reversed(dropoffs))
        else:
            targets = [dropoffs[index] for index in pairing]
        for index, (pickup, dropoff) in enumerate(zip(pickups, targets)):
            slot = self._choose_slot(index, pickup) if storage else None
            if slot is None:
                task = Task(pickup=pickup, dropoff=dropoff)
            else:
                task = Task(
                    pickup=pickup,
                    dropoff=tuple(slot["access"]),
                    stage="putaway",
                    slot=slot,
                    origin=pickup,
                    destination=dropoff,
                )
                self.warehouse.reserve_slot(slot["id"], task.id)
            self.pending_tasks.append(task)
            self.all_tasks.append(task)
        return list(self.all_tasks)

    def generate_task(self) -> Task:
        """Generate a single random pickup-deliver task (legacy helper)."""
        pickup = random.choice(self.warehouse.pickup_points)
        dropoff = random.choice(self.warehouse.dropoff_points)
        task = Task(pickup=pickup, dropoff=dropoff)
        self.pending_tasks.append(task)
        self.all_tasks.append(task)
        return task

    def find_task(self, task_id: int) -> Task | None:
        for task in self.all_tasks:
            if task.id == task_id:
                return task
        return None

    def allocate_tasks(self, robots: list, p2p_network, event_logger=None, tick: int = 0) -> list[dict]:
        """
        Run bid allocation for pending tasks.
        Also synchronizes completed tasks from robot states.
        """
        # 1. Handle abandoned tasks (e.g. robot went to charge before pickup)
        for task in self.active_tasks[:]:
            assigned_robot = next((r for r in robots if r.id == task.assigned_to), None)
            if assigned_robot:
                charging = (
                    assigned_robot.status in ("charging", "moving_to_charge")
                    or getattr(assigned_robot, "target_charger", None) is not None
                )
                if getattr(assigned_robot, "abandoned_task", None) and assigned_robot.abandoned_task.get("id") == task.id:
                    assigned_robot.abandoned_task = None
                    task.status = "pending"
                    task.assigned_to = None
                    self.active_tasks.remove(task)
                    self.pending_tasks.insert(0, task)
                    if event_logger:
                        event_logger.add_event(
                            "charging",
                            f"Package #{task.id} released back to the fleet auction while {assigned_robot.name} recharges",
                            robot_id=assigned_robot.id,
                            tick=tick,
                        )
                elif assigned_robot.current_task is None and charging:
                    task.status = "pending"
                    task.assigned_to = None
                    self.active_tasks.remove(task)
                    self.pending_tasks.insert(0, task)

        assignments = []

        # 2. Allocate pending tasks to highest bidding idle robots
        for task in self.pending_tasks[:]:
            payload = task.as_payload()
            bids = {}
            for robot in robots:
                bid = robot.calculate_bid(payload)
                if bid > 0:
                    bids[robot.id] = bid

            if not bids:
                continue

            # Winner = highest bid, tiebreak by lowest robot ID
            winner_id = max(bids, key=lambda rid: (bids[rid], -rid))

            task.assigned_to = winner_id
            task.status = "assigned"
            self.pending_tasks.remove(task)
            self.active_tasks.append(task)

            winner = None
            for robot in robots:
                if robot.id == winner_id:
                    winner = robot
                    robot.assign_task(dict(payload))
                    break

            p2p_network.broadcast(winner_id, "result", {
                "task_id": task.id,
                "assigned_to": winner_id,
                "tick": tick
            })

            if event_logger:
                winner_label = getattr(winner, "name", None) or robot_name(winner_id)
                leg = {
                    "putaway": f"putaway to rack slot {task.slot_code}",
                    "retrieval": f"pick from rack slot {task.slot_code}",
                }.get(task.stage, "delivery run")
                event_logger.add_event(
                    "auction",
                    f"Package #{task.id} {leg} awarded to {winner_label} \u2014 highest bid in the fleet auction",
                    robot_id=winner_id,
                    tick=tick
                )

            assignments.append({"task_id": task.id, "robot_id": winner_id})

        return assignments

    def note_pickup(self, task_id: int):
        """A carton has physically left its source.

        For a retrieval leg that frees the rack slot immediately, so the 3D
        view shows an empty shelf the moment the unit lifts the carton out.
        """
        task = self.find_task(task_id)
        if task and task.stage == "retrieval" and task.slot_id is not None:
            self.warehouse.release_slot(task.slot_id)

    def complete_leg(self, task_id: int):
        """Finish the leg a unit just delivered.

        Returns ("stored", task) when a putaway leg finished and the retrieval
        order was queued, ("delivered", task) when the package left the floor,
        or (None, None) if the task was not active.
        """
        for task in self.active_tasks[:]:
            if task.id != task_id:
                continue
            if task.stage == "putaway":
                if task.slot_id is not None:
                    self.warehouse.mark_slot_stored(task.slot_id)
                task.stage = "retrieval"
                task.pickup = task.slot_access
                task.pickup_kind = "rack"
                task.dropoff = task.destination
                task.dropoff_kind = "table"
                task.assigned_to = None
                task.status = "pending"
                self.active_tasks.remove(task)
                self.pending_tasks.insert(0, task)
                self.stored_count += 1
                return "stored", task

            task.status = "completed"
            if task.slot_id is not None:
                self.warehouse.release_slot(task.slot_id)
            self.active_tasks.remove(task)
            self.completed_tasks.append(task)
            return "delivered", task
        return None, None

    def mark_completed(self, task_id: int):
        """Mark a task as completed (advances multi-leg packages)."""
        return self.complete_leg(task_id)[0]

    def _serialize(self, task: Task, with_owner: bool = False) -> dict:
        row = {
            "id": task.id,
            "pickup": task.pickup,
            "dropoff": task.dropoff,
            "stage": task.stage,
            "pickup_kind": task.pickup_kind,
            "dropoff_kind": task.dropoff_kind,
            "slot_code": task.slot_code,
            "slot_cell": list(task.slot_cell) if task.slot_cell else None,
            "destination": list(task.destination),
        }
        if with_owner:
            row["assigned_to"] = task.assigned_to
        return row

    def to_dict(self) -> dict:
        """Serialize task state for WebSocket."""
        return {
            "pending": [self._serialize(t) for t in self.pending_tasks],
            "active": [self._serialize(t, with_owner=True) for t in self.active_tasks],
            "completed": [self._serialize(t) for t in self.completed_tasks[-20:]],
            "completed_count": len(self.completed_tasks),
            "total_count": len(self.all_tasks),
            "stored_count": self.stored_count,
            "in_racks": len([s for s in getattr(self.warehouse, "rack_slots", []) if s["state"] == "stored"]),
        }
