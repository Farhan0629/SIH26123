import time
from config import (
    BATTERY_MAX,
    BATTERY_DRAIN_PER_MOVE,
    BATTERY_DRAIN_IDLE,
    BATTERY_LOW_THRESHOLD,
    LOOKAHEAD_WINDOW,
    P2P_BROADCAST_INTERVAL,
    SENSOR_RANGE,
    robot_name,
)
from pathfinding import a_star

# How many consecutive blocked ticks a unit tolerates before it stops waiting
# and asks its onboard planner for a different route.
REPLAN_AFTER_WAITS = 3

class Robot:
    """
    Independent, decentralized robot agent.
    Simulates edge computing — all decisions are local.
    """
    
    def __init__(self, robot_id: int, start_pos: tuple[int, int], warehouse):
        self.id = robot_id
        self.name = robot_name(robot_id)
        
        # Physical state
        self.x, self.y = start_pos
        self.prev_x, self.prev_y = start_pos  # for frontend interpolation
        self.heading = 0                      # 0=right, 90=down, 180=left, 270=up
        self.battery = float(BATTERY_MAX)
        
        # Task state
        self.status = "idle"  # "idle" | "moving_to_pickup" | "moving_to_dropoff" | "waiting" | "charging" | "moving_to_charge"
        self.carrying = False # True once item is picked up
        self.current_task = None
        self.last_delivered_task_id = None
        self.abandoned_task = None
        self.planned_path = []
        self.path_index = 0
        
        # Decentralized knowledge (learned from P2P messages ONLY)
        self.known_peer_positions = {}  # {robot_id: (x, y, tick)}
        self.known_peer_intents = {}    # {robot_id: [(x,y), ...]}
        self.known_peer_dists = {}      # {robot_id: int}
        
        # Metrics
        self.decision_time_ms = 0.0
        self.tasks_completed = 0
        self.total_distance = 0
        self.wait_ticks = 0
        self.consecutive_waits = 0
        self.is_yielding = False
        
        # Environment reference
        self.warehouse = warehouse
        # Publish our physical footprint so peers can sense us even if the
        # radio link is down.
        warehouse.set_occupancy(self.id, (self.x, self.y))
    
    def tick(self, current_tick: int, p2p_network, event_logger=None) -> str:
        """
        Main agent loop called once per simulation tick.
        Returns action taken: "moved", "waited", "picked_up", "delivered", "idle", etc.
        """
        start_time = time.perf_counter()
        
        # 1. Process incoming P2P messages
        messages = p2p_network.receive_all(self.id)
        self._process_messages(messages, event_logger, current_tick)
        
        # 2. Broadcast position & intent at start of tick
        if current_tick % P2P_BROADCAST_INTERVAL == 0:
            self._broadcast_position(p2p_network, current_tick)
            self._broadcast_intent(p2p_network, current_tick)
        
        # 3. Save previous position for interpolation
        self.prev_x, self.prev_y = self.x, self.y
        
        # 4. Decide and act
        action = self._decide_and_act(current_tick, p2p_network, event_logger)
        
        # 5. Update battery
        if action == "moved":
            self.battery = max(0.0, self.battery - BATTERY_DRAIN_PER_MOVE)
        else:
            self.battery = max(0.0, self.battery - BATTERY_DRAIN_IDLE)
        
        # 6. Low battery check
        if self.battery <= BATTERY_LOW_THRESHOLD and self.status not in ("charging", "moving_to_charge"):
            self._go_to_charging(p2p_network, current_tick)
            if event_logger:
                event_logger.add_event(
                    "charging",
                    f"{self.name} battery low ({self.battery:.0f}%) -> rerouting to inductive charging pad",
                    robot_id=self.id,
                    tick=current_tick
                )
        
        self.decision_time_ms = (time.perf_counter() - start_time) * 1000.0
        return action
    
    def _process_messages(self, messages, event_logger=None, tick: int = 0):
        for msg in messages:
            if msg.msg_type == "pos":
                self.known_peer_positions[msg.sender_id] = (
                    msg.payload["x"],
                    msg.payload["y"],
                    msg.payload.get("tick", 0),
                )
            elif msg.msg_type == "intent":
                self.known_peer_intents[msg.sender_id] = msg.payload.get("path", [])
                self.known_peer_dists[msg.sender_id] = msg.payload.get("dist", len(self.known_peer_intents[msg.sender_id]))
            elif msg.msg_type == "blocked":
                blocked_cell = (msg.payload["x"], msg.payload["y"])
                self._handle_blocked_aisle(blocked_cell, event_logger, tick)
    
    def _broadcast_position(self, p2p_network, tick: int):
        p2p_network.broadcast(
            self.id,
            "pos",
            {"x": self.x, "y": self.y, "tick": tick},
        )
    
    def _broadcast_intent(self, p2p_network, tick: int):
        remaining_path = self.planned_path[self.path_index:] if self.planned_path else []
        p2p_network.broadcast(
            self.id,
            "intent",
            {
                "path": remaining_path[:LOOKAHEAD_WINDOW],
                "dist": self._distance_to_goal(),
                "tick": tick,
            },
        )
    
    def _decide_and_act(self, tick: int, p2p_network, event_logger=None) -> str:
        self.is_yielding = False
        if self.status == "idle":
            # If an active peer intends to enter our cell on its next step, politely yield/step aside
            for peer_id, intent in self.known_peer_intents.items():
                if intent and (intent[0] == (self.x, self.y) or (self.x, self.y) in intent[:3]):
                    neighbors = self.warehouse.get_neighbors(self.x, self.y)
                    occupied = set((p[0], p[1]) for p in self.known_peer_positions.values())
                    occupied |= self._sensed_cells()
                    free = [n for n in neighbors if n not in occupied and n != (self.x, self.y)]
                    best_free = [n for n in free if n not in intent]
                    chosen = best_free[0] if best_free else (free[0] if free else None)
                    if chosen:
                        self.is_yielding = True
                        self._move_to(chosen, p2p_network, tick)
                        return "stepped_aside"
            return "idle"
        
        if self.status == "charging":
            self.battery = min(float(BATTERY_MAX), self.battery + 2.0)
            if self.battery >= BATTERY_MAX:
                self.status = "idle"
                return "charged"
            return "charging"
        
        # Check if already at goal
        if not self.carrying and self.current_task:
            if (self.x, self.y) == self.current_task["pickup"]:
                return self._handle_arrival(tick, p2p_network)
        elif self.carrying and self.current_task:
            if (self.x, self.y) == self.current_task["dropoff"]:
                return self._handle_arrival(tick, p2p_network)
        elif self.status == "moving_to_charge":
            if (self.x, self.y) in self.warehouse.charging_stations:
                self.status = "charging"
                self.planned_path = []
                self.path_index = 0
                return "charging"
        
        # Ensure we have a valid planned path
        if not self.planned_path or self.path_index >= len(self.planned_path):
            self._replan_path(p2p_network, tick)
            if not self.planned_path or self.path_index >= len(self.planned_path):
                self.status = "waiting"
                self.wait_ticks += 1
                return "stuck"
        
        next_cell = self.planned_path[self.path_index]
        
        # Check if next cell was dynamically blocked
        if not self.warehouse.is_walkable(next_cell[0], next_cell[1]):
            self._replan_path(p2p_network, tick)
            if event_logger:
                event_logger.add_event(
                    "reroute",
                    f"{self.name} encountered blocked cell at {next_cell} -> rerouted via onboard A*",
                    robot_id=self.id,
                    tick=tick
                )
            if not self.planned_path or self.path_index >= len(self.planned_path):
                self.status = "waiting"
                self.wait_ticks += 1
                return "stuck"
            next_cell = self.planned_path[self.path_index]
        
        # Collision avoidance check
        if self._would_collide(next_cell):
            self.status = "waiting"
            self.is_yielding = True
            self.wait_ticks += 1
            self.consecutive_waits += 1
            if self.consecutive_waits >= REPLAN_AFTER_WAITS:
                self._replan_path(p2p_network, tick)
            return "waited"
        
        # Clear consecutive wait counter on successful movement
        self.consecutive_waits = 0
        if self.current_task:
            self.status = "moving_to_dropoff" if self.carrying else "moving_to_pickup"
        
        self._move_to(next_cell, p2p_network, tick)
        self.path_index += 1
        
        # Check if reached goal after moving
        if not self.carrying and self.current_task and (self.x, self.y) == self.current_task["pickup"]:
            return self._handle_arrival(tick, p2p_network)
        elif self.carrying and self.current_task and (self.x, self.y) == self.current_task["dropoff"]:
            return self._handle_arrival(tick, p2p_network)
        elif self.status == "moving_to_charge" and (self.x, self.y) in self.warehouse.charging_stations:
            self.status = "charging"
            self.planned_path = []
            self.path_index = 0
            return "charging"
        
        return "moved"
    
    def _sensed_cells(self) -> set[tuple[int, int]]:
        """Cells physically occupied by peers inside onboard sensor range.

        This is deliberately independent of the P2P radio: a unit inside a
        Wi-Fi dead zone still has eyes, so it can never drive into a body it
        can see. Radio silence degrades coordination, not safety.
        """
        sensed = set()
        for peer_id, cell in self.warehouse.robot_occupancy.items():
            if peer_id == self.id:
                continue
            if abs(cell[0] - self.x) + abs(cell[1] - self.y) <= SENSOR_RANGE:
                sensed.add(cell)
        return sensed
    
    def _would_collide(self, next_cell: tuple[int, int]) -> bool:
        # Onboard proximity sensing first — always available.
        if next_cell in self._sensed_cells():
            return True
        
        for peer_id, peer_info in self.known_peer_positions.items():
            px, py = peer_info[0], peer_info[1]
            
            # Physical cell is occupied right now
            if (px, py) == next_cell:
                return True
            
            # Future conflict in lookahead window
            peer_intent = self.known_peer_intents.get(peer_id, [])
            if not peer_intent:
                continue
            
            if next_cell in peer_intent[:LOOKAHEAD_WINDOW]:
                step_idx = peer_intent[:LOOKAHEAD_WINDOW].index(next_cell)
                # If peer is targeting this cell immediately or within 2 steps
                if step_idx <= 2:
                    my_dist = self._distance_to_goal()
                    peer_goal_dist = self.known_peer_dists.get(peer_id, len(peer_intent))
                    if my_dist > peer_goal_dist:
                        return True
                    elif my_dist == peer_goal_dist and self.id > peer_id:
                        return True
        return False
    
    def _distance_to_goal(self) -> int:
        if self.planned_path and self.path_index < len(self.planned_path):
            return len(self.planned_path) - self.path_index
        return 0
    
    def _move_to(self, cell: tuple[int, int], p2p_network=None, tick: int = 0):
        dx = cell[0] - self.x
        dy = cell[1] - self.y
        if dx == 1:
            self.heading = 0
        elif dx == -1:
            self.heading = 180
        elif dy == 1:
            self.heading = 90
        elif dy == -1:
            self.heading = 270
        self.x, self.y = cell
        self.total_distance += 1
        self.warehouse.set_occupancy(self.id, cell)
        
        if p2p_network:
            self._broadcast_position(p2p_network, tick)
    
    def _handle_arrival(self, tick: int, p2p_network) -> str:
        if not self.carrying and self.current_task:
            self.carrying = True
            self.status = "moving_to_dropoff"
            goal = self.current_task["dropoff"]
            occupied = set((p[0], p[1]) for p in self.known_peer_positions.values())
            self.planned_path = a_star(self.warehouse, (self.x, self.y), goal, occupied)
            if self.planned_path is None:
                self.planned_path = a_star(self.warehouse, (self.x, self.y), goal)
            self.path_index = 1 if self.planned_path and len(self.planned_path) > 1 else 0
            self._broadcast_intent(p2p_network, tick)
            return "picked_up"
        
        elif self.carrying and self.current_task:
            self.last_delivered_task_id = self.current_task["id"]
            self.tasks_completed += 1
            self.carrying = False
            self.current_task = None
            self.planned_path = []
            self.path_index = 0
            self.status = "idle"
            self._broadcast_position(p2p_network, tick)
            self._broadcast_intent(p2p_network, tick)
            return "delivered"
        
        return "idle"
    
    def _replan_path(self, p2p_network=None, tick: int = 0):
        if not self.current_task and self.status not in ("charging", "moving_to_charge"):
            self.planned_path = []
            self.path_index = 0
            return
        
        if self.status in ("charging", "moving_to_charge"):
            if not self.warehouse.charging_stations:
                self.planned_path = []
                self.path_index = 0
                return
            goal = min(
                self.warehouse.charging_stations,
                key=lambda c: abs(c[0] - self.x) + abs(c[1] - self.y),
            )
        elif self.carrying:
            goal = self.current_task["dropoff"]
        else:
            goal = self.current_task["pickup"]
        
        occupied = set((p[0], p[1]) for p in self.known_peer_positions.values())
        path = a_star(self.warehouse, (self.x, self.y), goal, occupied)
        if path is None:
            path = a_star(self.warehouse, (self.x, self.y), goal)
        
        self.planned_path = path or []
        self.path_index = 1 if self.planned_path and len(self.planned_path) > 1 else 0
        if p2p_network:
            self._broadcast_intent(p2p_network, tick)
    
    def _handle_blocked_aisle(self, blocked_cell, event_logger=None, tick: int = 0):
        if self.planned_path and blocked_cell in self.planned_path[self.path_index:]:
            self._replan_path()
            if event_logger:
                event_logger.add_event(
                    "reroute",
                    f"{self.name} heard a blocked-aisle alert at {blocked_cell} -> recalculated A* route",
                    robot_id=self.id,
                    tick=tick,
                )
    
    def _go_to_charging(self, p2p_network=None, tick: int = 0):
        if not self.warehouse.charging_stations:
            return
        # If currently carrying cargo, complete delivery to dropoff first before charging
        if self.carrying and self.current_task:
            return
        
        nearest = min(
            self.warehouse.charging_stations,
            key=lambda c: abs(c[0] - self.x) + abs(c[1] - self.y),
        )
        if self.current_task:
            self.abandoned_task = self.current_task
        self.current_task = None
        self.carrying = False
        self.status = "moving_to_charge"
        occupied = set((p[0], p[1]) for p in self.known_peer_positions.values())
        path = a_star(self.warehouse, (self.x, self.y), nearest, occupied)
        if path is None:
            path = a_star(self.warehouse, (self.x, self.y), nearest)
        self.planned_path = path or []
        self.path_index = 1 if self.planned_path and len(self.planned_path) > 1 else 0
        if p2p_network:
            self._broadcast_intent(p2p_network, tick)
    
    def calculate_bid(self, task: dict) -> float:
        pickup = task["pickup"]
        dropoff = task["dropoff"]
        dist_to_pickup = abs(pickup[0] - self.x) + abs(pickup[1] - self.y)
        dist_to_dropoff = abs(dropoff[0] - pickup[0]) + abs(dropoff[1] - pickup[1])
        total_dist = dist_to_pickup + dist_to_dropoff + 1
        battery_factor = self.battery / float(BATTERY_MAX)
        
        if self.status != "idle" or self.current_task is not None:
            return 0.0
        
        return battery_factor / float(total_dist)
    
    def assign_task(self, task: dict):
        self.current_task = task
        self.carrying = False
        self.status = "moving_to_pickup"
        occupied = set((p[0], p[1]) for p in self.known_peer_positions.values())
        path = a_star(self.warehouse, (self.x, self.y), task["pickup"], occupied)
        if path is None:
            path = a_star(self.warehouse, (self.x, self.y), task["pickup"])
        self.planned_path = path or []
        self.path_index = 1 if self.planned_path and len(self.planned_path) > 1 else 0
    
    def to_dict(self) -> dict:
        remaining_path = self.planned_path[self.path_index:] if self.planned_path else []
        status_str = "yielding" if getattr(self, "is_yielding", False) else self.status
        return {
            "id": self.id,
            "name": self.name,
            "x": self.x,
            "y": self.y,
            "prev_x": self.prev_x,
            "prev_y": self.prev_y,
            "heading": self.heading,
            "battery": round(self.battery, 1),
            "status": status_str,
            "is_yielding": getattr(self, "is_yielding", False),
            "task": self.current_task,
            "has_cargo": self.carrying,
            "carrying_task_id": self.current_task["id"] if (self.carrying and self.current_task) else None,
            "planned_path": remaining_path,
            "decision_ms": round(self.decision_time_ms, 2),
            "tasks_completed": self.tasks_completed,
            "total_distance": self.total_distance,
            "wait_ticks": self.wait_ticks,
        }
