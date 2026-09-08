"""Server-only handling dwell; the original Robot/headless benchmark stay unchanged.
Cargo ownership changes only after HANDLING_TICKS, while the occupied cell is
reserved through normal P2P position broadcasts. Pause and speed use server ticks.
"""
import time
from robot import Robot
from config import BATTERY_DRAIN_IDLE
HANDLING_TICKS = 10

class PresentationRobot(Robot):
    def __init__(self, robot_id, start_pos, warehouse):
        super().__init__(robot_id, start_pos, warehouse)
        self.handling = None
        self._handling_start = None

    def _handle_arrival(self, tick, p2p_network):
        if not self.current_task:
            return super()._handle_arrival(tick, p2p_network)
        if self.handling is None:
            kind = "dropoff" if self.carrying else "pickup"
            self.handling = {"kind": kind, "task_id": self.current_task["id"], "station": list(self.current_task["dropoff" if self.carrying else "pickup"]), "progress": 0.0}
            self._handling_start = tick
            self.status = "placing" if self.carrying else "picking_up"
            self.is_yielding = False
            self.consecutive_waits = 0
            self.planned_path = []
            self.path_index = 0
            self._broadcast_position(p2p_network, tick)
            self._broadcast_intent(p2p_network, tick)
        return "handling"

    def tick(self, current_tick, p2p_network, event_logger=None):
        if self.handling is None:
            return super().tick(current_tick, p2p_network, event_logger)
        start = time.perf_counter()
        self.prev_x, self.prev_y = self.x, self.y
        self._process_messages(p2p_network.receive_all(self.id), event_logger, current_tick)
        self.battery = max(0.0, self.battery - BATTERY_DRAIN_IDLE)
        elapsed = current_tick - self._handling_start
        self.handling["progress"] = min(1.0, max(0.0, elapsed / HANDLING_TICKS))
        self._broadcast_position(p2p_network, current_tick)
        self._broadcast_intent(p2p_network, current_tick)
        if elapsed >= HANDLING_TICKS:
            self.handling = None
            self._handling_start = None
            action = super()._handle_arrival(current_tick, p2p_network)
        else:
            action = "handling"
        self.decision_time_ms = (time.perf_counter() - start) * 1000
        return action

    def _broadcast_intent(self, p2p_network, tick):
        if self.handling:
            p2p_network.broadcast(self.id, "intent", {"path": [], "dist": 0, "tick": tick})
        else:
            super()._broadcast_intent(p2p_network, tick)

    def _go_to_charging(self, p2p_network=None, tick=0):
        if self.handling is None:
            super()._go_to_charging(p2p_network, tick)

    def to_dict(self):
        result = super().to_dict()
        result["handling"] = dict(self.handling) if self.handling else None
        return result
