import random

from config import robot_name

class Task:
    """A pickup-and-deliver task."""
    _counter = 0
    
    def __init__(self, pickup: tuple[int, int], dropoff: tuple[int, int]):
        Task._counter += 1
        self.id = Task._counter
        self.pickup = pickup
        self.dropoff = dropoff
        self.assigned_to = None  # robot_id or None
        self.status = "pending"  # "pending" | "assigned" | "completed"

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
    
    def generate_manifest(self, pairing: list[int] | None = None) -> list[Task]:
        """Stage exactly one package per loading table.

        By default loading table N is paired with the delivery table at the
        opposite end of the floor (reversed order), so every route crosses the
        warehouse and the fleet meets in the aisles instead of running parallel
        lanes.

        `pairing` optionally supplies delivery-table indices (a permutation) so
        the headless benchmark can vary the manifest between episodes while
        keeping the same rule: six packages, staged once, before the clock
        starts. Nothing is ever created mid-episode.
        """
        pickups = list(self.warehouse.pickup_points)
        dropoffs = list(self.warehouse.dropoff_points)
        if pairing is None:
            targets = list(reversed(dropoffs))
        else:
            targets = [dropoffs[index] for index in pairing]
        for pickup, dropoff in zip(pickups, targets):
            task = Task(pickup=pickup, dropoff=dropoff)
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
    
    def allocate_tasks(self, robots: list, p2p_network, event_logger=None, tick: int = 0) -> list[dict]:
        """
        Run bid allocation for pending tasks.
        Also synchronizes completed tasks from robot states.
        """
        # 1. Handle abandoned tasks (e.g. robot went to charge before pickup)
        for task in self.active_tasks[:]:
            assigned_robot = next((r for r in robots if r.id == task.assigned_to), None)
            if assigned_robot:
                if getattr(assigned_robot, "abandoned_task", None) and assigned_robot.abandoned_task.get("id") == task.id:
                    assigned_robot.abandoned_task = None
                    task.status = "pending"
                    task.assigned_to = None
                    self.active_tasks.remove(task)
                    self.pending_tasks.insert(0, task)
                elif assigned_robot.current_task is None and assigned_robot.status in ("charging", "moving_to_charge"):
                    task.status = "pending"
                    task.assigned_to = None
                    self.active_tasks.remove(task)
                    self.pending_tasks.insert(0, task)
        
        assignments = []
        
        # 2. Allocate pending tasks to highest bidding idle robots
        for task in self.pending_tasks[:]:
            bids = {}
            for robot in robots:
                bid = robot.calculate_bid({"id": task.id, "pickup": task.pickup, "dropoff": task.dropoff})
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
                    robot.assign_task({
                        "id": task.id,
                        "pickup": task.pickup,
                        "dropoff": task.dropoff
                    })
                    break
            
            p2p_network.broadcast(winner_id, "result", {
                "task_id": task.id,
                "assigned_to": winner_id,
                "tick": tick
            })
            
            if event_logger:
                winner_label = getattr(winner, "name", None) or robot_name(winner_id)
                event_logger.add_event(
                    "auction",
                    f"Package #{task.id} awarded to {winner_label} — highest bid in the fleet auction",
                    robot_id=winner_id,
                    tick=tick
                )
            
            assignments.append({"task_id": task.id, "robot_id": winner_id})
        
        return assignments
    
    def mark_completed(self, task_id: int):
        """Mark a task as completed."""
        for task in self.active_tasks[:]:
            if task.id == task_id:
                task.status = "completed"
                self.active_tasks.remove(task)
                self.completed_tasks.append(task)
                break
    
    def to_dict(self) -> dict:
        """Serialize task state for WebSocket."""
        return {
            "pending": [{"id": t.id, "pickup": t.pickup, "dropoff": t.dropoff} for t in self.pending_tasks],
            "active": [{"id": t.id, "pickup": t.pickup, "dropoff": t.dropoff, "assigned_to": t.assigned_to} for t in self.active_tasks],
            "completed": [{"id": t.id, "pickup": t.pickup, "dropoff": t.dropoff} for t in self.completed_tasks[-20:]],
            "completed_count": len(self.completed_tasks),
            "total_count": len(self.all_tasks)
        }
