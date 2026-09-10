import test from 'node:test'
import assert from 'node:assert/strict'
import { getRobotStatusMeta, mapCargoLifecycle } from './simulationState.js'

test('mapCargoLifecycle keeps active cargo at pickup until robot actually carries it', () => {
  const tasks = {
    pending: [{ id: 1, pickup: [2, 3], dropoff: [10, 10] }],
    active: [{ id: 2, pickup: [4, 5], dropoff: [8, 8], assigned_to: 1 }],
    completed: [{ id: 3, pickup: [1, 1], dropoff: [9, 9] }],
  }
  const robots = [{ id: 1, has_cargo: false, task: { id: 2, pickup: [4, 5], dropoff: [8, 8] } }]

  const state = mapCargoLifecycle(tasks, robots)

  assert.equal(state.pickupCargo.length, 2)
  assert.deepEqual(state.pickupCargo.map((item) => item.taskId), [1, 2])
  assert.equal(state.carryingCargo.length, 0)
  assert.deepEqual(state.deliveredCargo[0], { taskId: 3, dropoff: [9, 9] })
})

test('mapCargoLifecycle moves active task to carrying list once robot has cargo', () => {
  const tasks = {
    pending: [],
    active: [{ id: 7, pickup: [5, 5], dropoff: [7, 7], assigned_to: 2 }],
    completed: [],
  }
  const robots = [{ id: 2, has_cargo: true, task: { id: 7, pickup: [5, 5], dropoff: [7, 7] } }]

  const state = mapCargoLifecycle(tasks, robots)

  assert.equal(state.pickupCargo.length, 0)
  assert.deepEqual(state.carryingCargo, [{ taskId: 7, robotId: 2, dropoff: [7, 7] }])
})

test('getRobotStatusMeta prioritizes carrying state for transport label', () => {
  assert.deepEqual(getRobotStatusMeta({ status: 'moving_to_dropoff', has_cargo: true }), { label: 'Transporting', tone: 'cobalt' })
  assert.deepEqual(getRobotStatusMeta({ status: 'charging', has_cargo: true }), { label: 'Charging', tone: 'green' })
})

test('rack transfers read as storage work, not generic pick and place', () => {
  assert.equal(getRobotStatusMeta({ handling: { kind: 'dropoff', place: 'rack' } }).label, 'Storing in rack')
  assert.equal(getRobotStatusMeta({ handling: { kind: 'pickup', place: 'rack' } }).label, 'Picking from rack')
})
