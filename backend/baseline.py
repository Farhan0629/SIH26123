from pathfinding import a_star

class BaselineRobot:
    """
    Naive stop-and-wait robot for baseline comparison.
    
    Behavior:
    - Plans path using A* (same as smart robot)
    - If ANY other robot is within 2 cells ahead on path, STOP and wait
    - No P2P communication
    - No dynamic replanning
    - No priority system
    """
    
    def __init__(self, robot_id: int, start_pos: tuple[int, int], warehouse):
        self.id = robot_id
        self.x, self.y = start_pos
        self.warehouse = warehouse
        self.planned_path = []
        self.path_index = 0
        self.current_task = None
        self.status = "idle"
        self.tasks_completed = 0
        self.total_ticks = 0
    
    def assign_task(self, task: dict):
        self.current_task = task
        self.status = "moving_to_pickup"
        self.planned_path = a_star(self.warehouse, (self.x, self.y), task["pickup"]) or []
        self.path_index = 1 if len(self.planned_path) > 1 else 0
    
    def tick(self, all_robots: list) -> str:
        self.total_ticks += 1
        
        if self.status == "idle" or not self.current_task:
            return "idle"
        
        # Check arrival at pickup or dropoff before moving
        if self.status == "moving_to_pickup" and (self.x, self.y) == self.current_task["pickup"]:
            self.status = "moving_to_dropoff"
            self.planned_path = a_star(self.warehouse, (self.x, self.y), self.current_task["dropoff"]) or []
            self.path_index = 1 if len(self.planned_path) > 1 else 0
            return "picked_up"
        
        if self.status == "moving_to_dropoff" and (self.x, self.y) == self.current_task["dropoff"]:
            self.tasks_completed += 1
            self.current_task = None
            self.status = "idle"
            self.planned_path = []
            return "delivered"
        
        if not self.planned_path or self.path_index >= len(self.planned_path):
            return "idle"
        
        # STOP AND WAIT check: if any robot within 2 cells ahead on our path, halt
        for other in all_robots:
            if other.id == self.id:
                continue
            for i in range(self.path_index, min(self.path_index + 2, len(self.planned_path))):
                if (other.x, other.y) == self.planned_path[i]:
                    return "waited"
        
        # Move forward
        next_cell = self.planned_path[self.path_index]
        self.x, self.y = next_cell
        self.path_index += 1
        
        # Check arrival after moving
        if self.status == "moving_to_pickup" and (self.x, self.y) == self.current_task["pickup"]:
            self.status = "moving_to_dropoff"
            self.planned_path = a_star(self.warehouse, (self.x, self.y), self.current_task["dropoff"]) or []
            self.path_index = 1 if len(self.planned_path) > 1 else 0
            return "picked_up"
        
        elif self.status == "moving_to_dropoff" and (self.x, self.y) == self.current_task["dropoff"]:
            self.tasks_completed += 1
            self.current_task = None
            self.status = "idle"
            self.planned_path = []
            return "delivered"
        
        return "moved"
