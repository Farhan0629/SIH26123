export const STATUS_COPY = {
  idle: { label: 'Idle', tone: 'slate' }, moving_to_pickup: { label: 'To pickup', tone: 'amber' }, picking_up: { label: 'Picking up', tone: 'amber' }, moving_to_dropoff: { label: 'Transporting', tone: 'cobalt' }, placing: { label: 'Placing package', tone: 'green' }, waiting: { label: 'Waiting', tone: 'amber' }, yielding: { label: 'Yielding', tone: 'amber' }, charging: { label: 'Charging', tone: 'green' }, moving_to_charge: { label: 'To charger', tone: 'green' },
}
export function getRobotStatusMeta(robot) {
  if (robot?.handling) return STATUS_COPY[robot.handling.kind === 'pickup' ? 'picking_up' : 'placing']
  if (['waiting', 'yielding', 'charging', 'moving_to_charge'].includes(robot?.status)) return STATUS_COPY[robot.status]
  if (robot?.has_cargo) return STATUS_COPY.moving_to_dropoff
  return STATUS_COPY[robot?.status] || { label: robot?.status || 'Unknown', tone: 'slate' }
}
export function getRobotNextDestination(robot) {
  if (robot?.status === 'moving_to_charge' && robot.planned_path?.length) return { type: 'CHARGING', coordinate: robot.planned_path[robot.planned_path.length - 1] }
  if (!robot?.task) return null
  return { type: robot.has_cargo ? 'DISPATCH' : 'RECEIVING', coordinate: robot.has_cargo ? robot.task.dropoff : robot.task.pickup }
}
export function mapCargoLifecycle(tasks, robots) {
  const fleet = robots || [], safe = tasks || {}
  const transfers = new Set(fleet.filter((r) => r.handling).map((r) => r.handling.task_id))
  const pickupCargo = []
  for (const t of safe.pending || []) if (!transfers.has(t.id)) pickupCargo.push({ taskId: t.id, pickup: t.pickup, state: 'pending' })
  for (const t of safe.active || []) {
    const assigned = fleet.find((r) => r.id === t.assigned_to)
    if (!transfers.has(t.id) && !(assigned?.has_cargo && assigned.task?.id === t.id)) pickupCargo.push({ taskId: t.id, pickup: t.pickup, state: 'assigned' })
  }
  const carryingCargo = fleet.filter((r) => r.has_cargo && r.task && !r.handling).map((r) => ({ taskId: r.task.id, robotId: r.id, dropoff: r.task.dropoff }))
  const handlingCargo = fleet.filter((r) => r.handling).map((r) => ({ ...r.handling, robotId: r.id }))
  const deliveredCargo = (safe.completed || []).filter((t) => !transfers.has(t.id)).map((t) => ({ taskId: t.id, dropoff: t.dropoff }))
  return { pickupCargo, carryingCargo, deliveredCargo, handlingCargo }
}
export function getMissionSummary(tasks) {
  const total = tasks?.total_count ?? 0, completed = tasks?.completed_count ?? 0
  return { total, completed, active: tasks?.active?.length ?? 0, pending: tasks?.pending?.length ?? 0, progress: total > 0 ? Math.round(completed / total * 100) : 0 }
}
