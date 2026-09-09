from config import (
    GRID_WIDTH, GRID_HEIGHT, EMPTY, SHELF, WALL, PICKUP, DROPOFF, CHARGING
)

# Fixed demonstration floor.
# Six loading tables sit on the WEST aisle (column 2) and six delivery tables
# sit on the EAST aisle (column 16), so every package must cross the whole
# warehouse. Rack islands are 2x2 blocks that force real aisle navigation.
LAYOUT = [
    "WWWWWWWWWWWWWWWWWWWW",  # 0
    "WC................CW",  # 1  chargers at (1,1) and (18,1)
    "W.P.............D..W",  # 2  load 1 / drop 1
    "W....##..##..##....W",  # 3
    "W....##..##..##....W",  # 4
    "W.P.............D..W",  # 5  load 2 / drop 2
    "W..................W",  # 6
    "W..................W",  # 7
    "W.P.............D..W",  # 8  load 3 / drop 3
    "W....##..##..##....W",  # 9
    "W....##..##..##....W",  # 10
    "W.P.............D..W",  # 11 load 4 / drop 4
    "W..................W",  # 12
    "W..................W",  # 13
    "W.P.............D..W",  # 14 load 5 / drop 5
    "W....##..##..##....W",  # 15
    "W....##..##..##....W",  # 16
    "W.P.............D..W",  # 17 load 6 / drop 6
    "WC................CW",  # 18 chargers at (1,18) and (18,18)
    "WWWWWWWWWWWWWWWWWWWW",  # 19
]

CHAR_TO_CELL = {
    ".": EMPTY,
    "#": SHELF,
    "W": WALL,
    "P": PICKUP,
    "D": DROPOFF,
    "C": CHARGING,
}


class Warehouse:
    """Warehouse grid map: neighbor lookup, walkability, and special cells."""

    def __init__(self):
        self.width = GRID_WIDTH
        self.height = GRID_HEIGHT
        self.grid = self._build_grid()
        self.pickup_points = []
        self.dropoff_points = []
        self.charging_stations = []
        self._extract_special_cells()
        self.blocked_cells = set()

    def _build_grid(self) -> list[list[int]]:
        grid = []
        for row_str in LAYOUT:
            grid.append([CHAR_TO_CELL.get(ch, EMPTY) for ch in row_str])
        return grid

    def _extract_special_cells(self):
        # Sorted north-to-south so loading table N pairs with a delivery table.
        for y in range(self.height):
            for x in range(self.width):
                val = self.grid[y][x]
                if val == PICKUP:
                    self.pickup_points.append((x, y))
                elif val == DROPOFF:
                    self.dropoff_points.append((x, y))
                elif val == CHARGING:
                    self.charging_stations.append((x, y))

    def is_walkable(self, x: int, y: int) -> bool:
        """Return True if cell (x,y) is in bounds, not SHELF/WALL, not blocked."""
        return (
            0 <= x < self.width
            and 0 <= y < self.height
            and self.grid[y][x] not in (SHELF, WALL)
            and (x, y) not in self.blocked_cells
        )

    def get_neighbors(self, x: int, y: int) -> list[tuple[int, int]]:
        """Return walkable 4-connected neighbors."""
        candidates = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        return [(nx, ny) for nx, ny in candidates if self.is_walkable(nx, ny)]

    def block_aisle(self, x: int, y: int):
        self.blocked_cells.add((x, y))

    def unblock_aisle(self, x: int, y: int):
        self.blocked_cells.discard((x, y))

    def to_serializable(self) -> dict:
        return {
            "width": self.width,
            "height": self.height,
            "grid": self.grid,
            "blocked": list(self.blocked_cells),
            "pickups": self.pickup_points,
            "dropoffs": self.dropoff_points,
            "chargers": self.charging_stations,
        }
