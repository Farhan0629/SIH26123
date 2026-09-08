import useStore from '../store'
import Controls from './Controls'
import RobotStatus from './RobotStatus'
import MetricsPanel from './MetricsPanel'
import TaskQueue from './TaskQueue'
import EventLog from './EventLog'
import { getMissionSummary, getRobotNextDestination } from '../utils/simulationState.js'

function SelectedInspector({ robot }) {
  const destination = getRobotNextDestination(robot)

  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="text-sm font-semibold text-slate-900">Selected unit</h2>
      {robot ? (
        <>
          <p className="text-sm font-semibold text-slate-900">UNIT-{String(robot.id).padStart(2, '0')}</p>
          <p className="text-xs text-slate-600">Status: {robot.status}</p>
          <p className="text-xs text-slate-600">
            Cargo: {robot.has_cargo ? `PKG-${String(robot.carrying_task_id || robot.task?.id || 0).padStart(3, '0')}` : 'None'}
          </p>
          <p className="text-xs text-slate-600">
            Next stop: {destination ? `${destination.type} (${destination.coordinate[0]},${destination.coordinate[1]})` : 'Awaiting task'}
          </p>
        </>
      ) : (
        <p className="text-xs text-slate-600">Select a robot card to inspect and use follow camera.</p>
      )}
    </section>
  )
}

export default function Dashboard() {
  const robots = useStore((s) => s.robots)
  const sim = useStore((s) => s.sim)
  const tasks = useStore((s) => s.tasks)
  const selectedRobotId = useStore((s) => s.selectedRobotId)

  const selectedRobot = robots.find((robot) => robot.id === selectedRobotId)
  const mission = getMissionSummary(tasks)

  return (
    <div className="space-y-3 p-3 md:p-4">
      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Live mission summary</h2>
            <p className="text-xs text-slate-600">{sim.running ? (sim.paused ? 'Paused' : 'Running') : 'Stopped'} • {sim.speed}x</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold text-slate-900">{mission.progress}%</p>
            <p className="text-xs text-slate-500">complete</p>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-700">Pending <span className="block text-sm font-semibold text-slate-900">{mission.pending}</span></div>
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-700">Active <span className="block text-sm font-semibold text-slate-900">{mission.active}</span></div>
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-700">Delivered <span className="block text-sm font-semibold text-slate-900">{mission.completed}</span></div>
        </div>
      </section>

      <Controls />
      <SelectedInspector robot={selectedRobot} />
      <MetricsPanel />

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <h2 className="text-sm font-semibold text-slate-900">Robot fleet</h2>
        <div className="space-y-2">
          {robots.map((robot) => <RobotStatus key={robot.id} robot={robot} />)}
          {!robots.length && <p className="text-xs text-slate-500">Waiting for robot state from backend.</p>}
        </div>
      </section>

      <TaskQueue />
      <EventLog />
    </div>
  )
}
