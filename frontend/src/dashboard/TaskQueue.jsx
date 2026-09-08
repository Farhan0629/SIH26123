import useStore from '../store'

export default function TaskQueue() {
  const tasks = useStore((s) => s.tasks)
  
  return (
    <div className="bg-gray-800/90 rounded p-3 border border-gray-700/50 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
          <span>📦</span> Task Allocation
        </h2>
        <span className="text-[11px] text-cyan-400 font-mono font-medium">
          {tasks.completed_count}/{tasks.total_count} done
        </span>
      </div>
      
      {/* Active and Pending tasks */}
      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
        {tasks.active && tasks.active.length > 0 ? (
          tasks.active.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-gray-900/70 border border-gray-700/40"
            >
              <span className="text-cyan-400 font-bold">#{task.id}</span>
              <span className="text-gray-300 font-mono text-[10px]">
                ({task.pickup[0]},{task.pickup[1]}) → ({task.dropoff[0]},{task.dropoff[1]})
              </span>
              <span className="text-yellow-400 font-bold text-[10px]">R{task.assigned_to}</span>
            </div>
          ))
        ) : null}
        
        {tasks.pending && tasks.pending.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-gray-900/30 border border-gray-800/40 opacity-60"
          >
            <span className="text-gray-400">#{task.id}</span>
            <span className="text-gray-400 font-mono text-[10px]">
              ({task.pickup[0]},{task.pickup[1]}) → ({task.dropoff[0]},{task.dropoff[1]})
            </span>
            <span className="text-gray-500 text-[10px] italic">pending</span>
          </div>
        ))}
        
        {(!tasks.active || tasks.active.length === 0) && (!tasks.pending || tasks.pending.length === 0) && (
          <div className="text-center py-2 text-gray-500 text-[11px]">
            No pending tasks
          </div>
        )}
      </div>
    </div>
  )
}
