"""
Event Logger for Edge-AI AMR Fleet Coordination.
Captures real-time decentralized decisions, conflict resolutions, rerouting, and cargo events.
"""

class EventLogger:
    def __init__(self, max_events: int = 100):
        self.max_events = max_events
        self.events: list[dict] = []
        self._counter = 0

    def add_event(self, event_type: str, message: str, robot_id: int = None, tick: int = 0):
        self._counter += 1
        # Virtual simulated time: start at 12:00, advance 1s per tick
        sim_seconds = tick
        minutes = (sim_seconds // 60) % 60
        seconds = sim_seconds % 60
        timestamp = f"12:{minutes:02d}:{seconds:02d}"

        event = {
            "id": self._counter,
            "tick": tick,
            "time": timestamp,
            "type": event_type,  # 'pickup', 'delivery', 'storage', 'yield', 'reroute', 'hazard', 'charging', 'auction', 'system'
            "robot_id": robot_id,
            "text": message,
        }
        self.events.append(event)
        if len(self.events) > self.max_events:
            self.events.pop(0)

    def get_recent_events(self, limit: int = 40) -> list[dict]:
        return self.events[-limit:]

    def clear(self):
        self.events.clear()
