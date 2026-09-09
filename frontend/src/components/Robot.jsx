import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import useStore from '../store'
import CargoBox from './CargoBox'
import PathTrail from './PathTrail'
import { getRobotStatusMeta } from '../utils/simulationState.js'
import { RIG, headingToYaw, angleDelta, createMotion, queueMotion, advanceMotion, transferPose } from '../utils/presentation.js'

const ACCENTS = ['#2864b7', '#98702a', '#398270', '#8551a2', '#b24e5e']
const SHELL = '#e5eaf0', JOINT = '#243141'
function Shell({ at = [0, 0, 0], size = [1, 1, 1], color = SHELL }) {
  return <mesh position={at} scale={size} castShadow><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color={color} roughness={0.44} metalness={0.3} /></mesh>
}
function Joint({ at = [0, 0, 0], radius = 0.05 }) {
  return <mesh position={at}><sphereGeometry args={[radius, 10, 8]} /><meshStandardMaterial color={JOINT} metalness={0.6} roughness={0.4} /></mesh>
}
function Arm({ side, upper, elbow, color }) {
  return <group position={[side * 0.27, RIG.shoulder, 0]}>
    <Joint radius={0.075} />
    <group ref={upper} rotation={[0, 0, -side * 0.1]}>
      <Shell at={[0, -0.13, 0]} size={[0.066, 0.145, 0.071]} />
      <Shell at={[0, -0.05, 0.04]} size={[0.058, 0.064, 0.038]} color={color} />
      <group ref={elbow} position={[0, -0.29, 0]}>
        <Joint radius={0.05} />
        <Shell at={[0, -0.11, 0]} size={[0.055, 0.115, 0.059]} />
        <Joint at={[0, -0.23, 0]} radius={0.035} />
        <mesh position={[0, -0.27, 0.025]} castShadow><boxGeometry args={[0.075, 0.07, 0.07]} /><meshStandardMaterial color={JOINT} /></mesh>
        {[-1, 1].map((s) => <mesh key={s} position={[s * 0.029, -0.285, 0.074]}><boxGeometry args={[0.014, 0.036, 0.056]} /><meshStandardMaterial color="#a1aebb" metalness={0.7} roughness={0.3} /></mesh>)}
      </group>
    </group>
  </group>
}
function Leg({ side, hip, knee }) {
  return <group position={[side * 0.125, RIG.hip, 0]}>
    <Joint radius={0.073} />
    <group ref={hip}>
      <Shell at={[0, -0.16, 0]} size={[0.075, 0.17, 0.083]} />
      <group ref={knee} position={[0, -RIG.upperLeg, 0]}>
        <Joint radius={0.055} />
        <Shell at={[0, -0.02, 0.044]} size={[0.056, 0.073, 0.04]} color="#94a4b6" />
        <Shell at={[0, -0.17, 0]} size={[0.059, 0.165, 0.062]} />
        <Joint at={[0, -RIG.lowerLeg, 0]} radius={0.042} />
        <Shell at={[0, -RIG.lowerLeg - 0.05, 0.055]} size={[0.084, 0.055, 0.15]} color={JOINT} />
      </group>
    </group>
  </group>
}

export default function Robot({ robot, selected = false, onSelect }) {
  const root = useRef(), body = useRef(), cargo = useRef()
  const leftArm = useRef(), rightArm = useRef(), leftElbow = useRef(), rightElbow = useRef()
  const leftHip = useRef(), rightHip = useRef(), leftKnee = useRef(), rightKnee = useRef()
  const motion = useRef(createMotion(robot.x + 0.5, robot.y + 0.5))
  const phase = useRef(0), gaitStrength = useRef(0)
  const yaw = useRef(headingToYaw(robot.heading))
  const reduced = useStore((s) => s.reducedMotion)
  const sim = useStore((s) => s.sim)
  const connected = useStore((s) => s.connected)
  const routes = useStore((s) => s.showRoutes)
  const network = useStore((s) => s.network)
  const color = ACCENTS[(robot.id - 1) % ACCENTS.length]
  const handling = robot.handling
  const hasPackage = Boolean(robot.has_cargo || handling)
  const taskId = handling?.task_id || robot.carrying_task_id || robot.task?.id
  const status = getRobotStatusMeta(robot)
  const paused = sim.paused || !connected
  const name = robot.name || `UNIT ${String(robot.id).padStart(2, '0')}`
  const offline = (network?.partitioned ?? []).includes(robot.id)

  useEffect(() => {
    queueMotion(motion.current, robot.x + 0.5, robot.y + 0.5, 0.1 / Math.max(0.1, sim.speed), reduced)
  }, [robot.x, robot.y, reduced, sim.speed])

  useFrame((_, rawDelta) => {
    if (!root.current) return
    const delta = Math.min(rawDelta, 0.05)
    const distance = advanceMotion(motion.current, delta, paused)
    root.current.position.set(motion.current.x, 0, motion.current.z)
    const desiredYaw = headingToYaw(handling ? 0 : robot.heading)
    if (reduced) yaw.current = desiredYaw
    else if (!paused) yaw.current += angleDelta(yaw.current, desiredYaw) * (1 - Math.exp(-14 * delta))
    root.current.rotation.y = yaw.current
    if (!paused) {
      const moving = !reduced && !handling && distance > 0.0001
      gaitStrength.current += ((moving ? 1 : 0) - gaitStrength.current) * (1 - Math.exp(-18 * delta))
      phase.current += distance * 10
      const swing = Math.sin(phase.current) * gaitStrength.current
      leftHip.current.rotation.x = swing * 0.35
      rightHip.current.rotation.x = -swing * 0.35
      leftKnee.current.rotation.x = Math.max(0, -swing) * 0.55
      rightKnee.current.rotation.x = Math.max(0, swing) * 0.55
      body.current.position.y = 0
      const pose = transferPose(handling)
      const arm = hasPackage ? -0.28 - pose.reach * 0.24 : -swing * 0.4
      leftArm.current.rotation.x = arm
      rightArm.current.rotation.x = hasPackage ? arm : swing * 0.4
      leftElbow.current.rotation.x = rightElbow.current.rotation.x = hasPackage ? -1.18 + pose.reach * 0.25 : -0.15
    }
    if (cargo.current) cargo.current.position.set(...transferPose(handling).position)
  })

  return <>
    <group ref={root} position={[robot.x + 0.5, 0, robot.y + 0.5]} onClick={(event) => { event.stopPropagation(); onSelect?.(robot.id) }}>
      <mesh position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.36, selected ? 0.43 : 0.38, 40]} /><meshBasicMaterial color={color} transparent opacity={selected ? 0.85 : 0.35} depthWrite={false} /></mesh>
      <group ref={body}>
        <Shell at={[0, 0.86, 0]} size={[0.21, 0.10, 0.135]} color={JOINT} />
        <Shell at={[0, RIG.chest, 0]} size={[0.23, 0.25, 0.15]} />
        <Shell at={[0, 1.22, 0.125]} size={[0.165, 0.135, 0.05]} color={color} />
        <mesh position={[0, 1.08, 0.15]}><boxGeometry args={[0.18, 0.035, 0.012]} /><meshBasicMaterial color={offline ? '#e0546a' : handling ? '#f2b544' : '#9ed8d3'} /></mesh>
        <Shell at={[0, 1.18, -0.15]} size={[0.16, 0.18, 0.072]} color={JOINT} />
        <Joint at={[0, 1.43, 0]} radius={0.065} />
        <Shell at={[0, RIG.head, 0]} size={[0.165, 0.17, 0.145]} />
        <Shell at={[0, RIG.head + 0.005, 0.113]} size={[0.137, 0.078, 0.06]} color="#101e30" />
        {[-1, 1].map((s) => <mesh key={s} position={[s * 0.064, RIG.head + 0.014, 0.173]}><boxGeometry args={[0.048, 0.016, 0.01]} /><meshBasicMaterial color="#8bd4f7" /></mesh>)}
        <Arm side={-1} upper={leftArm} elbow={leftElbow} color={color} />
        <Arm side={1} upper={rightArm} elbow={rightElbow} color={color} />
        <Leg side={-1} hip={leftHip} knee={leftKnee} />
        <Leg side={1} hip={rightHip} knee={rightKnee} />
        {hasPackage && <group ref={cargo} position={transferPose(handling).position}><CargoBox taskId={taskId} scale={1} /></group>}
      </group>
      <Html position={[0, 1.93, 0]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
        <button onClick={() => onSelect?.(robot.id)} aria-label={`Inspect ${name}${offline ? ', radio offline' : ''}`} style={{ pointerEvents: 'auto', whiteSpace: 'nowrap', minHeight: 44, padding: '6px 10px', fontSize: 14, borderRadius: 8, border: `2px solid ${offline ? '#e0546a' : color}`, background: selected ? color : '#fff', color: selected ? '#fff' : '#243141' }}>
          {name}{offline ? ' · no radio' : ''}{selected ? ` · ${handling ? transferPose(handling).label : status.label}` : ''}
        </button>
      </Html>
    </group>
    {routes && robot.planned_path?.length > 0 && <PathTrail path={robot.planned_path} color={color} />}
  </>
}
