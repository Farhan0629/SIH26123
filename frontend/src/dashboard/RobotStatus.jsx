import useStore from '../store'
import { getRobotNextDestination, getRobotStatusMeta } from '../utils/simulationState.js'

const ACCENTS = ['#315c9f', '#6a86b8', '#3f6aaf', '#506fa8', '#7a8fb9']

export default function RobotStatus({ robot }) {
  const selectedRobotId = useStore((s) => s.selectedRobotId)
  const selectRobot = useStore((s) => s.selectRobot)
  const setFollowRobot = useStore((s) => s.setFollowRobot)

  const selected = selectedRobotId === robot.id
  const accent = ACCENTS[(robot.id - 1) % ACCENTS.length]
  const status = getRobotStatusMeta(robot)
  const destination = getRobotNextDestination(robot)

  return (
    <article
      className={`rounded-lg border bg-white p-3 shadow-sm transition ${selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}
      aria-label={`Robot ${robot.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => selectRobot(robot.id)}
          className="min-h-11 min-w-11 text-left"
        >
          <p className="text-sm font-semibold" style={{ color: accent }}>UNIT-{String(robot.id).padStart(2, '0')}</p>
          <p className="text-xs text-slate-500">{status.label}</p>
        </button>
        <button
          type="button"
          onClick={() => setFollowRobot(robot.id)}
          className="min-h-11 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700"
        >
          Follow
        </button>
      </div>

      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-emerald-500"
          style={{ width: `${Math.max(4, Math.min(100, robot.battery || 0))}%` }}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <p>Battery <span className="font-semibold text-slate-900">{Math.round(robot.battery)}%</span></p>
        <p>Completed <span className="font-semibold text-slate-900">{robot.tasks_completed}</span></p>
        <p>Location <span className="font-semibold text-slate-900">({robot.x},{robot.y})</span></p>
        <p>{robot.has_cargo ? `Package PKG-${String(robot.carrying_task_id || robot.task?.id || 0).padStart(3, '0')}` : 'No package'}</p>
      </div>

      <p className="mt-2 text-xs text-slate-600">
        Next destination:{' '}
        <span className="font-semibold text-slate-900">
          {destination ? `${destination.type} (${destination.coordinate[0]},${destination.coordinate[1]})` : 'Awaiting task'}
        </span>
      </p>
    </article>
  )
}
