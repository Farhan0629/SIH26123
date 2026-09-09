import useStore from '../store'

function TaskRow({ task, state }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900">PKG-{String(task.id).padStart(3, '0')}</span>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">{state}</span>
      </div>
      <p className="mt-1 font-mono text-[11px]">R({task.pickup[0]},{task.pickup[1]}) → D({task.dropoff[0]},{task.dropoff[1]})</p>
    </div>
  )
}

export default function TaskQueue() {
  const tasks = useStore((s) => s.tasks)
  const robots = useStore((s) => s.robots)

  const active = tasks.active || []
  const pending = tasks.pending || []
  const assigneeLabel = (id) => {
    const owner = robots.find((robot) => robot.id === id)
    return owner?.name || `R${id}`
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Task queue</h2>
        <p className="text-xs text-slate-600">{tasks.completed_count}/{tasks.total_count} delivered</p>
      </div>

      <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">Workflow</p>
        <p className="mt-1">RECEIVE → PICK UP → TRANSPORT → DELIVER</p>
      </div>

      <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
        {active.map((task) => <TaskRow key={`active-${task.id}`} task={task} state={assigneeLabel(task.assigned_to)} />)}
        {pending.map((task) => <TaskRow key={`pending-${task.id}`} task={task} state="pending" />)}
        {!active.length && !pending.length && <p className="py-4 text-center text-xs text-slate-500">No queued tasks.</p>}
      </div>
    </section>
  )
}
