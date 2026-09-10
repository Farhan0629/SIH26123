from config import (
    GRID_WIDTH, GRID_HEIGHT, EMPTY, SHELF, WALL, PICKUP, DROPOFF, CHARGING
)

# Fixed demonstration floor.
# Twelve staging tables: six on the WEST aisle (column 2) and six on the EAST
# aisle (column 16). In a storage round every one of them starts with a carton
# on it and the fleet works the whole floor. Rack islands are 2x2 blocks that
# force real aisle navigation.
# The two cell types (P/D) are kept because the headless benchmark still runs
# the original west-to-east delivery manifest for its baseline comparison.
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

# Island rows are labelled A/B/C from north to south, columns 1..3 from west to
# east, so a slot address reads like a real warehouse location: B2-03.
RACK_BANDS = "ABCDEFGH"


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
        # Twelve staging tables, addressed T01..T12 (west first, north to
        # south). A table is either "loaded" (one carton sitting on it) or
        # "empty". It is emptied the moment a unit starts lifting and is never
        # refilled during a round, so a carton can never reappear on a table it
        # has already left.
        self.tables: list[dict] = []
        self.blocked_cells = set()
        # Rack islands are real inventory locations, not scenery: every shelf
        # cell with an adjacent aisle is an addressable slot that can hold one
        # carton.
        self.rack_slots: list[dict] = []
        self.rack_islands: list[dict] = []
        self._extract_rack_slots()
        self._extract_tables()
        # Physical floor occupancy, written by robots as they move. This stands
        # in for onboard proximity sensing: a robot can see a body in the next
        # cell even when its radio is down, exactly like a real LiDAR bumper.
        self.robot_occupancy: dict[int, tuple[int, int]] = {}

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

    # ─── Staging tables ───────────────────────────────────────────────────

    def _extract_tables(self):
        """Address every table on the floor: T01..T06 west, T07..T12 east."""
        west = sorted(self.pickup_points, key=lambda cell: (cell[1], cell[0]))
        east = sorted(self.dropoff_points, key=lambda cell: (cell[1], cell[0]))
        for index, cell in enumerate(west + east):
            self.tables.append({
                "id": index,
                "code": f"T{index + 1:02d}",
                "cell": cell,
                "side": "west" if index < len(west) else "east",
                "state": "empty",   # "empty" | "loaded"
                "task_id": None,
            })

    def table_at(self, cell) -> dict | None:
        cell = tuple(cell)
        for table in self.tables:
            if table["cell"] == cell:
                return table
        return None

    def load_table(self, cell, task_id: int) -> bool:
        """Place the staged carton for `task_id` on the table at `cell`."""
        table = self.table_at(cell)
        if table is None:
            return False
        table["state"] = "loaded"
        table["task_id"] = task_id
        return True

    def mark_table_empty(self, cell) -> bool:
        """The carton has physically left the table - a unit is lifting it."""
        table = self.table_at(cell)
        if table is None or table["state"] == "empty":
            return False
        table["state"] = "empty"
        table["task_id"] = None
        return True

    def reset_tables(self):
        for table in self.tables:
            table["state"] = "empty"
            table["task_id"] = None

    def loaded_tables(self) -> list[dict]:
        return [table for table in self.tables if table["state"] == "loaded"]

    # ─── Rack inventory ───────────────────────────────────────────────────

    def _structurally_walkable(self, x: int, y: int) -> bool:
        """Walkable ignoring temporary barriers.

        A slot address is a property of the building, so a barrier dropped in
        an aisle during a drill must not delete the address; it only makes the
        route to it longer.
        """
        return (
            0 <= x < self.width
            and 0 <= y < self.height
            and self.grid[y][x] not in (SHELF, WALL)
        )

    def _extract_rack_slots(self):
        """Turn every contiguous shelf block into an addressable rack island."""
        seen: set[tuple[int, int]] = set()
        blocks: list[list[tuple[int, int]]] = []
        for y in range(self.height):
            for x in range(self.width):
                if self.grid[y][x] != SHELF or (x, y) in seen:
                    continue
                block: list[tuple[int, int]] = []
                stack = [(x, y)]
                while stack:
                    cx, cy = stack.pop()
                    if (cx, cy) in seen:
                        continue
                    if not (0 <= cx < self.width and 0 <= cy < self.height):
                        continue
                    if self.grid[cy][cx] != SHELF:
                        continue
                    seen.add((cx, cy))
                    block.append((cx, cy))
                    stack.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)])
                blocks.append(sorted(block, key=lambda cell: (cell[1], cell[0])))

        blocks.sort(key=lambda block: (block[0][1], block[0][0]))
        bands = sorted({block[0][1] for block in blocks})
        columns = sorted({block[0][0] for block in blocks})

        for block in blocks:
            band = bands.index(block[0][1])
            column = columns.index(block[0][0])
            letter = RACK_BANDS[band] if band < len(RACK_BANDS) else "Z"
            island_code = f"{letter}{column + 1}"
            slot_ids = []
            for number, cell in enumerate(block, start=1):
                access = None
                # Prefer the west aisle, then east, then north, then south, so
                # neighbouring islands hand their traffic to different aisles.
                for candidate in (
                    (cell[0] - 1, cell[1]),
                    (cell[0] + 1, cell[1]),
                    (cell[0], cell[1] - 1),
                    (cell[0], cell[1] + 1),
                ):
                    if self._structurally_walkable(*candidate):
                        access = candidate
                        break
                if access is None:
                    continue  # a fully enclosed shelf cell is not addressable
                slot = {
                    "id": len(self.rack_slots),
                    "code": f"{island_code}-{number:02d}",
                    "island": island_code,
                    "cell": cell,
                    "access": access,
                    "state": "empty",   # "empty" | "reserved" | "stored"
                    "task_id": None,
                }
                self.rack_slots.append(slot)
                slot_ids.append(slot["id"])
            self.rack_islands.append({
                "code": island_code,
                "cell": block[0],
                "size": len(block),
                "slots": slot_ids,
            })

    def get_slot(self, slot_id: int) -> dict | None:
        if slot_id is None or not (0 <= slot_id < len(self.rack_slots)):
            return None
        return self.rack_slots[slot_id]

    def free_slots(self) -> list[dict]:
        return [slot for slot in self.rack_slots if slot["state"] == "empty"]

    def reserve_slot(self, slot_id: int, task_id: int) -> bool:
        slot = self.get_slot(slot_id)
        if slot is None or slot["state"] != "empty":
            return False
        slot["state"] = "reserved"
        slot["task_id"] = task_id
        return True

    def mark_slot_stored(self, slot_id: int) -> bool:
        slot = self.get_slot(slot_id)
        if slot is None:
            return False
        slot["state"] = "stored"
        return True

    def release_slot(self, slot_id: int) -> bool:
        slot = self.get_slot(slot_id)
        if slot is None:
            return False
        slot["state"] = "empty"
        slot["task_id"] = None
        return True

    def reset_racks(self):
        """Empty every slot. Called when a demonstration restarts."""
        for slot in self.rack_slots:
            slot["state"] = "empty"
            slot["task_id"] = None

    def stored_slots(self) -> list[dict]:
        return [slot for slot in self.rack_slots if slot["state"] == "stored"]

    # ─── Navigation ────────────────────────────────────────────────────────

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

    def set_occupancy(self, robot_id: int, cell: tuple[int, int]):
        """Record where a robot physically is."""
        self.robot_occupancy[robot_id] = cell

    def to_serializable(self) -> dict:
        return {
            "width": self.width,
            "height": self.height,
            "grid": self.grid,
            "blocked": list(self.blocked_cells),
            "pickups": self.pickup_points,
            "dropoffs": self.dropoff_points,
            "chargers": self.charging_stations,
            "tables": [
                {
                    "id": table["id"],
                    "code": table["code"],
                    "cell": list(table["cell"]),
                    "side": table["side"],
                    "state": table["state"],
                    "task_id": table["task_id"],
                }
                for table in self.tables
            ],
            "racks": [
                {
                    "id": slot["id"],
                    "code": slot["code"],
                    "island": slot["island"],
                    "cell": list(slot["cell"]),
                    "access": list(slot["access"]),
                    "state": slot["state"],
                    "task_id": slot["task_id"],
                }
                for slot in self.rack_slots
            ],
            "rack_islands": [
                {"code": island["code"], "cell": list(island["cell"]), "size": island["size"]}
                for island in self.rack_islands
            ],
        }
