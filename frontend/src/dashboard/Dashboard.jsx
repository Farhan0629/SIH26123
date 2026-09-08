import useStore from '../store'
import Controls from './Controls'
import RobotStatus from './RobotStatus'
import MetricsPanel from './MetricsPanel'
import TaskQueue from './TaskQueue'
import EventLog from './EventLog'

export default function Dashboard() {
  const robots = useStore((s) => s.robots)
  const sim = useStore((s) => s.sim)
  const episodeTicks = useStore((s) => s.metrics.episode_ticks)

  return (
    <div className="p-4 space-y-4">
      {/* App Header */}
      <div>
        <h1 className="text-lg font-black text-cyan-400 flex items-center gap-2 tracking-tight">
          <span>🤖</span> Edge-AI AMR Fleet Coordination
        </h1>
        <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
          <span>Tick: <strong className="font-mono text-gray-200">{episodeTicks}</strong></span>
          <span>•</span>
          <span>Speed: <strong className="font-mono text-gray-200">{sim.speed}x</strong></span>
          <span>•</span>
          <span
            className={
              sim.running
                ? sim.paused
                  ? 'text-yellow-400 font-bold'
                  : 'text-emerald-400 font-bold'
                : 'text-gray-500'
            }
          >
            {sim.running ? (sim.paused ? '⏸ Paused' : '▶ Running') : '⏹ Stopped'}
          </span>
        </p>
      </div>

      {/* Simulation Controls & Dynamic Obstacle Barricade */}
      <Controls />

      {/* Live Fleet Action & Decision Log */}
      <EventLog />

      {/* Performance Metrics */}
      <MetricsPanel />

      {/* AMR Fleet Telemetry Cards */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
          <span>⚡</span> AMR Fleet Real-Time Telemetry
        </h2>
        {robots.map((robot) => (
          <RobotStatus key={robot.id} robot={robot} />
        ))}
      </div>

      {/* Task Allocation Queue */}
      <TaskQueue />
    </div>
  )
}
