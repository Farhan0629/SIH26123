// Pure presentation math: testable without React or WebGL.
export const RIG = Object.freeze({ hip: 0.83, chest: 1.15, shoulder: 1.34, head: 1.59, upperLeg: 0.34, lowerLeg: 0.36 })
export const CARRY = Object.freeze([0, 1.04, 0.35])
export const STATION = Object.freeze([0, 0.91, 0.40])
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const smooth = (v) => { const t = clamp(v); return t * t * (3 - 2 * t) }
// Model faces +Z; backend heading 0 means +X.
export const headingToYaw = (degrees = 0) => Math.PI / 2 - degrees * Math.PI / 180
export const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))
export function createMotion(x, z) { return { x, z, endX: x, endZ: z, queue: [] } }
export function queueMotion(m, x, z, duration = 0.2, snap = false) {
  const distance = Math.abs(x - m.endX) + Math.abs(z - m.endZ)
  if (snap || distance > 1.01 || m.queue.length > 4) {
    Object.assign(m, createMotion(x, z)); return
  }
  if (distance < 0.001) return
  m.queue.push({ x0: m.endX, z0: m.endZ, x, z, time: 0, duration: Math.max(0.025, duration) })
  m.endX = x; m.endZ = z
}
export function advanceMotion(m, delta, paused = false) {
  if (paused) return 0
  const oldX = m.x, oldZ = m.z
  let time = Math.min(Math.max(delta, 0), 0.1)
  while (m.queue.length && time > 0) {
    const segment = m.queue[0]
    const step = Math.min(time, segment.duration - segment.time)
    segment.time += step; time -= step
    const t = clamp(segment.time / segment.duration)
    m.x = segment.x0 + (segment.x - segment.x0) * t
    m.z = segment.z0 + (segment.z - segment.z0) * t
    if (t >= 1) m.queue.shift()
  }
  return Math.hypot(m.x - oldX, m.z - oldZ)
}
export function transferPose(handling) {
  if (!handling) return { position: [...CARRY], reach: 0, label: 'Transporting' }
  const p = clamp(handling.progress || 0)
  const lift = smooth((p - 0.25) / 0.5)
  const t = handling.kind === 'pickup' ? lift : 1 - lift
  return {
    position: STATION.map((value, i) => value + (CARRY[i] - value) * t),
    reach: 1 - t,
    label: handling.kind === 'pickup' ? (p < 0.25 ? 'Reaching' : p < 0.8 ? 'Lifting package' : 'Securing package') : (p < 0.25 ? 'Aligning package' : p < 0.8 ? 'Placing package' : 'Releasing package'),
  }
}
export function chooseFollowRobot(robots, selectedId, previousId) {
  return robots.find((r) => r.id === selectedId) || robots.find((r) => r.id === previousId) || robots[0] || null
}
