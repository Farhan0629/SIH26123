const ROBOT_COLORS = ['#00f0ff', '#f43f5e', '#eab308', '#10b981', '#a855f7']

export default function RobotStatus({ robot }) {
  const color = ROBOT_COLORS[(robot.id - 1) % ROBOT_COLORS.length]
  const batteryColor = robot.battery > 50 ? '#22c55e' : robot.battery > 20 ? '#eab308' : '#ef4444'
  const isCarrying = Boolean(robot.has_cargo || robot.carrying)

  return (
    <div className="bg-gray-800/90 rounded-lg p-3 text-xs border border-gray-700/50 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ color }}>AMR-{robot.id}</span>
          {isCarrying ? (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-500/50 flex items-center gap-1">
              <span>📦</span>
              <span>Box #{robot.carrying_task_id || robot.task?.id}</span>
            </span>
          ) : (
            <span className="text-[10px] text-gray-500 italic">No Cargo</span>
          )}
        </div>
        <span
          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
          style={{
            background:
              robot.status === 'yielding'
                ? '#78350f'
                : robot.status === 'idle'
                ? '#374151'
                : robot.status === 'waiting'
                ? '#991b1b'
                : robot.status === 'charging'
                ? '#065f46'
                : '#1e3a5f',
            color: robot.status === 'yielding' ? '#fde68a' : robot.status === 'waiting' ? '#fca5a5' : '#e2e8f0',
          }}
        >
          {robot.status}
        </span>
      </div>

      {/* Battery bar */}
      <div className="flex items-center gap-2">
        <span className="text-gray-400 w-14 font-mono text-[11px]">🔋 {robot.battery}%</span>
        <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, Math.max(0, robot.battery))}%`,
              backgroundColor: batteryColor,
            }}
          />
        </div>
      </div>

      {/* Position + metrics */}
      <div className="text-gray-400 flex justify-between font-mono text-[10px] pt-0.5 border-t border-gray-700/40">
        <span>📍 ({robot.x}, {robot.y})</span>
        <span>✅ {robot.tasks_completed} done</span>
        <span>⏱ {robot.decision_ms}ms</span>
      </div>
    </div>
  )
}
