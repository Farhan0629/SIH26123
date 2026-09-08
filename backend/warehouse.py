from config import (
    GRID_WIDTH, GRID_HEIGHT, EMPTY, SHELF, WALL, PICKUP, DROPOFF, CHARGING
)

LAYOUT = [
    "WWWWWWWWWWWWWWWWWWWW",  # Row 0
    "W..................W",  # Row 1
    "W.##.##.##.##.##...W",  # Row 2
    "W.##.##.##.##.##...W",  # Row 3
    "W..................W",  # Row 4
    "W.##.##.##.##.##.P.W",  # Row 5  (P at 17,5)
    "W.##.##.##.##.##...W",  # Row 6
    "W..................W",  # Row 7
    "W.##.##.##.##.##...W",  # Row 8
    "W.##.##.##.##.##.P.W",  # Row 9  (P at 17,9)
    "W..................W",  # Row 10
    "W.##.##.##.##.##...W",  # Row 11
    "W.##.##.##.##.##...W",  # Row 12
    "W..................W",  # Row 13
    "W.##.##.##.##.##.D.W",  # Row 14 (D at 17,14)
    "W.##.##.##.##.##...W",  # Row 15
    "W..................W",  # Row 16
    "W................D.W",  # Row 17 (D at 17,17)
    "WC.......C.........W",  # Row 18 (C at 1,18 and 9,18)
    "WWWWWWWWWWWWWWWWWWWW",  # Row 19
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
    """
    Warehouse grid map.
    Provides neighbor lookup, walkability checks, and distance calculations.
    """

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
        for y, row_str in enumerate(LAYOUT):
            row = []
            for x, ch in enumerate(row_str):
                row.append(CHAR_TO_CELL.get(ch, EMPTY))
            grid.append(row)
        return grid

    def _extract_special_cells(self):
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
        """Return True if cell (x,y) is within bounds, not SHELF/WALL, and not blocked."""
        return (
            0 <= x < self.width
            and 0 <= y < self.height
            and self.grid[y][x] not in (SHELF, WALL)
            and (x, y) not in self.blocked_cells
        )

    def get_neighbors(self, x: int, y: int) -> list[tuple[int, int]]:
        """Return walkable 4-connected neighbors: up, down, left, right."""
        candidates = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        return [(nx, ny) for nx, ny in candidates if self.is_walkable(nx, ny)]

    def block_aisle(self, x: int, y: int):
        """Add cell to blocked_cells set (for dynamic obstacle demo)."""
        self.blocked_cells.add((x, y))

    def unblock_aisle(self, x: int, y: int):
        """Remove cell from blocked_cells set."""
        self.blocked_cells.discard((x, y))

    def to_serializable(self) -> dict:
        """Return grid as JSON-serializable dict for frontend."""
        return {
            "width": self.width,
            "height": self.height,
            "grid": self.grid,
            "blocked": list(self.blocked_cells),
            "pickups": self.pickup_points,
            "dropoffs": self.dropoff_points,
            "chargers": self.charging_stations,
        }
