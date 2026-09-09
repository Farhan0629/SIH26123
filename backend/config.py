# ─── Warehouse Grid ───
GRID_WIDTH = 20          # columns
GRID_HEIGHT = 20         # rows
CELL_SIZE = 1.0          # 1 unit = 1 meter in 3D

# ─── Cell Types ───
EMPTY = 0
SHELF = 1
WALL = 2
PICKUP = 3
DROPOFF = 4
CHARGING = 5

# ─── Robot Settings ───
NUM_ROBOTS = 3
ROBOT_SPEED = 1          # cells per tick
BATTERY_MAX = 100
BATTERY_DRAIN_PER_MOVE = 0.5
BATTERY_DRAIN_IDLE = 0.1
BATTERY_LOW_THRESHOLD = 20
SENSOR_RANGE = 5         # cells visible around robot (onboard LiDAR-style sensing)
DEFAULT_ROBOT_STARTS = [
    (1, 1), (1, 10), (1, 18),
    (4, 1), (7, 1), (10, 1),
    (13, 1), (16, 1), (4, 18), (7, 18)
]

# ─── Fleet Identity ───
# Named units keep the demonstration readable: the 3D labels, the fleet cards
# and the event log all refer to the same three operators.
ROBOT_NAMES = ["Farhan", "Debojyoti", "Gaurav"]


def robot_name(robot_id: int) -> str:
    """Human-readable name for a 1-based robot id. Falls back to UNIT-nn."""
    if 1 <= robot_id <= len(ROBOT_NAMES):
        return ROBOT_NAMES[robot_id - 1]
    return f"UNIT-{robot_id:02d}"


# ─── Simulation ───
TICK_RATE = 10           # ticks per second (10Hz)
TICK_INTERVAL = 1.0 / TICK_RATE  # 0.1 seconds
MAX_TICKS = 2000         # max ticks per episode before timeout

# ─── Collision Avoidance ───
LOOKAHEAD_WINDOW = 5     # check next 5 steps for conflicts
SAFETY_DISTANCE = 1      # minimum cells between robots

# ─── Task Settings ───
# The demonstration floor is a fixed manifest: six staged packages on the west
# loading tables, six empty delivery tables on the east. Nothing spawns
# mid-episode, so every package on screen has a visible origin.
TASKS_PER_EPISODE = 6
TASK_SPAWN_INTERVAL = 10  # legacy knob, unused by the fixed-manifest benchmark

# ─── P2P Communication ───
P2P_BROADCAST_INTERVAL = 1  # ticks between position broadcasts (10Hz)
FACILITY_BEACON_ID = 0      # pseudo-sender so every robot receives hazard alerts
MESSAGE_TYPES = {
    "POSITION_UPDATE": "pos",
    "INTENT_BROADCAST": "intent",
    "TASK_BID": "bid",
    "TASK_RESULT": "result",
    "BLOCKED_AISLE": "blocked",
    "HEARTBEAT": "heartbeat"
}
