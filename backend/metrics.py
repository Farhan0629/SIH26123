class MetricsTracker:
    """Track simulation performance metrics."""
    
    def __init__(self):
        self.total_collisions = 0
        self.total_tasks_completed = 0
        self.task_completion_ticks = []      # ticks at completion of each task
        self.baseline_completion_ticks = []  # baseline comparison ticks
        self.episode_ticks = 0
        self.baseline_episode_ticks = 0
        self.robot_wait_ticks = {}
    
    def record_collision(self):
        self.total_collisions += 1
    
    def record_task_completion(self, ticks_taken: int):
        self.task_completion_ticks.append(ticks_taken)
        self.total_tasks_completed += 1
    
    def record_baseline_completion(self, ticks_taken: int):
        self.baseline_completion_ticks.append(ticks_taken)
    
    def record_baseline_episode(self, ticks: int):
        self.baseline_episode_ticks = ticks
    
    def get_improvement_pct(self) -> float:
        """Calculate % improvement over baseline."""
        if self.baseline_episode_ticks > 0 and self.episode_ticks > 0:
            return ((self.baseline_episode_ticks - self.episode_ticks) / float(self.baseline_episode_ticks)) * 100.0
        
        if not self.task_completion_ticks or not self.baseline_completion_ticks:
            return 0.0
        smart_avg = sum(self.task_completion_ticks) / len(self.task_completion_ticks)
        baseline_avg = sum(self.baseline_completion_ticks) / len(self.baseline_completion_ticks)
        if baseline_avg == 0:
            return 0.0
        return ((baseline_avg - smart_avg) / baseline_avg) * 100.0
    
    def to_dict(self) -> dict:
        smart_val = self.episode_ticks if self.episode_ticks > 0 else (
            round(sum(self.task_completion_ticks) / len(self.task_completion_ticks), 1)
            if self.task_completion_ticks else 0
        )
        baseline_val = self.baseline_episode_ticks if self.baseline_episode_ticks > 0 else (
            round(sum(self.baseline_completion_ticks) / len(self.baseline_completion_ticks), 1)
            if self.baseline_completion_ticks else 0
        )
        return {
            "collisions": self.total_collisions,
            "tasks_completed": self.total_tasks_completed,
            "avg_completion_ticks": smart_val,
            "baseline_avg_ticks": baseline_val,
            "improvement_pct": round(self.get_improvement_pct(), 1),
            "episode_ticks": self.episode_ticks,
        }
