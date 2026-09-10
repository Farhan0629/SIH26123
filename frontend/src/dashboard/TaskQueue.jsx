import useStore from '../store'

// A package now runs two legs. The chip says which one is on the floor right
// now, so "PKG-003" appearing twice reads as one carton moving through the
// cycle instead of two different jobs.
const STAGE = {
  putaway: { label: 'Putaway', className: 'bg-violet-100 text-violet-700' },
  retrieval: { label: 'Pick', className: 'bg-emerald-100 text-emerald-700' },
  direct: { label: 'Direct', className: 'bg-slate-100 text-slate-600' },
}

function TaskRow({ task, state }) {
  const stage = STAGE[task.stage] || STAGE.direct
  const from = task.pickup_kind === 'rack' ? task.slot_code : `R(${task.pickup[0]},${task.pickup[1]})`
  const to = task.dropoff_kind === 'rack' ? task.slot_code : `D(${task.dropoff[0]},${task.dropoff[1]})`
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold text-slate-900">
          PKG-{String(task.id).padStart(3, '0')}
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${stage.className}`}>{stage.label}</span>
        </span>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">{state}</span>
      </div>
      <p className="mt-1 font-mono text-[11px]">{from} → {to}</p>
    </div>
  )
}

export default function TaskQueue() {
  const tasks = useStore((s) => s.tasks)
  const robots = useStore((s) => s.robots)

  const active = tasks.active || []
  const pending = tasks.pending || []
  const storage = (tasks.stored_count ?? 0) > 0 || active.concat(pending).some((task) => task.stage && task.stage !== 'direct')
  const assigneeLabel = (id) => {
    const owner = robots.find((robot) => robot.id === id)
    return owner?.name || `R${id}`
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Task queue</h2>
        <p className="text-xs text-slate-600">{tasks.completed_count}/{tasks.total_count} dispatched</p>
      </div>

      <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">Workflow</p>
        {storage ? (
          <>
            <p className="mt-1">RECEIVE → PUTAWAY → STORE</p>
            <p>PICK → PACK → DISPATCH</p>
            <p className="mt-1 text-[11px] text-slate-500">{tasks.in_racks ?? 0} in racks · {tasks.stored_count ?? 0} put away</p>
          </>
        ) : (
          <p className="mt-1">RECEIVE → PICK UP → TRANSPORT → DELIVER</p>
        )}
      </div>

      <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
        {active.map((task) => <TaskRow key={`active-${task.id}-${task.stage}`} task={task} state={assigneeLabel(task.assigned_to)} />)}
        {pending.map((task) => <TaskRow key={`pending-${task.id}-${task.stage}`} task={task} state="pending" />)}
        {!active.length && !pending.length && <p className="py-4 text-center text-xs text-slate-500">No queued tasks.</p>}
      </div>
    </section>
  )
}
