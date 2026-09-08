export const STATUS_COPY = {
  idle: { label: 'Idle', tone: 'slate' },
  moving_to_pickup: { label: 'To pickup', tone: 'amber' },
  moving_to_dropoff: { label: 'Transporting', tone: 'cobalt' },
  waiting: { label: 'Waiting', tone: 'amber' },
  yielding: { label: 'Yielding', tone: 'amber' },
  charging: { label: 'Charging', tone: 'green' },
  moving_to_charge: { label: 'To charger', tone: 'green' },
}

export function getRobotStatusMeta(robot) {
  const carrying = Boolean(robot?.has_cargo)
  if (carrying && robot?.status !== 'charging') {
    return { label: 'Transporting', tone: 'cobalt' }
  }
  return STATUS_COPY[robot?.status] || { label: robot?.status || 'Unknown', tone: 'slate' }
}

export function getRobotNextDestination(robot) {
  if (!robot?.task) return null
  if (robot.has_cargo) {
    return { type: 'DISPATCH', coordinate: robot.task.dropoff }
  }
  return { type: 'RECEIVING', coordinate: robot.task.pickup }
}

export function mapCargoLifecycle(tasks, robots) {
  const safeTasks = tasks || {}
  const safeRobots = robots || []

  const pickupCargo = []
  for (const t of safeTasks.pending || []) {
    pickupCargo.push({ taskId: t.id, pickup: t.pickup, state: 'pending' })
  }

  for (const t of safeTasks.active || []) {
    const assigned = safeRobots.find((robot) => robot.id === t.assigned_to)
    const robotCarryingSameTask = Boolean(assigned?.has_cargo && assigned?.task?.id === t.id)
    if (!robotCarryingSameTask) {
      pickupCargo.push({ taskId: t.id, pickup: t.pickup, state: 'assigned' })
    }
  }

  const carryingCargo = safeRobots
    .filter((robot) => robot.has_cargo && robot.task)
    .map((robot) => ({ taskId: robot.task.id, robotId: robot.id, dropoff: robot.task.dropoff }))

  const deliveredCargo = (safeTasks.completed || []).map((t) => ({ taskId: t.id, dropoff: t.dropoff }))

  return { pickupCargo, carryingCargo, deliveredCargo }
}

export function getMissionSummary(tasks) {
  const total = tasks?.total_count ?? 0
  const completed = tasks?.completed_count ?? 0
  const active = tasks?.active?.length ?? 0
  const pending = tasks?.pending?.length ?? 0
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

  return { total, completed, active, pending, progress }
}
