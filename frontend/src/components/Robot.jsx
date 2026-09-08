import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useStore from '../store'
import PathTrail from './PathTrail'
import CargoBox from './CargoBox'
import { getRobotStatusMeta, getRobotNextDestination } from '../utils/simulationState.js'

const ACCENTS = ['#315c9f', '#6a86b8', '#3f6aaf', '#506fa8', '#7a8fb9']
const DARK = '#1f2937'
const SHELL = '#dfe5ee'
const JOINT = '#334155'

export default function Robot({ robot, selected = false, onSelect }) {
  const groupRef = useRef()
  const phaseRef = useRef(Math.random() * Math.PI * 2)
  const leftArmRef = useRef()
  const rightArmRef = useRef()
  const leftLegRef = useRef()
  const rightLegRef = useRef()
  const torsoRef = useRef()
  const headRef = useRef()

  const reducedMotion = useStore((s) => s.reducedMotion)
  const sim = useStore((s) => s.sim)
  const showRoutes = useStore((s) => s.showRoutes)

  const accent = ACCENTS[(robot.id - 1) % ACCENTS.length]
  const status = getRobotStatusMeta(robot)
  const destination = getRobotNextDestination(robot)

  const shouldWalk = !reducedMotion && sim.running && !sim.paused && ['moving_to_pickup', 'moving_to_dropoff', 'moving_to_charge', 'yielding'].includes(robot.status)
  const isCarrying = Boolean(robot.has_cargo)

  const target = useMemo(() => new THREE.Vector3(), [])
  const current = useMemo(() => new THREE.Vector3(robot.x + 0.5, 0, robot.y + 0.5), [robot.x, robot.y])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    target.set(robot.x + 0.5, 0, robot.y + 0.5)
    if (current.distanceTo(target) > 2.2) {
      current.copy(target)
    } else {
      current.lerp(target, Math.min(1, delta * 9))
    }
    groupRef.current.position.copy(current)

    const targetRot = -robot.heading * (Math.PI / 180)
    let diff = (targetRot - groupRef.current.rotation.y) % (Math.PI * 2)
    if (diff < -Math.PI) diff += Math.PI * 2
    if (diff > Math.PI) diff -= Math.PI * 2
    groupRef.current.rotation.y += diff * Math.min(1, delta * 8)

    const gait = shouldWalk ? Math.sin((phaseRef.current += delta * 8)) : 0
    const carryingArm = isCarrying ? -0.95 : 0.2

    if (leftArmRef.current) leftArmRef.current.rotation.x = carryingArm + (isCarrying ? 0.08 : gait * 0.5)
    if (rightArmRef.current) rightArmRef.current.rotation.x = carryingArm + (isCarrying ? -0.08 : -gait * 0.5)
    if (leftLegRef.current) leftLegRef.current.rotation.x = isCarrying ? gait * 0.16 : gait * 0.45
    if (rightLegRef.current) rightLegRef.current.rotation.x = isCarrying ? -gait * 0.16 : -gait * 0.45
    if (torsoRef.current) torsoRef.current.position.y = 0.78 + (shouldWalk ? Math.abs(gait) * 0.02 : 0)
    if (headRef.current) headRef.current.rotation.x = shouldWalk ? Math.sin(phaseRef.current * 0.5) * 0.03 : 0
  })

  return (
    <>
      <group ref={groupRef} position={[robot.x + 0.5, 0, robot.y + 0.5]} onClick={() => onSelect?.(robot.id)}>
        {selected && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.42, 0.5, 40]} />
            <meshBasicMaterial color={accent} transparent opacity={0.75} />
          </mesh>
        )}

        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.38, 0.12, 0.26]} />
          <meshStandardMaterial color={DARK} roughness={0.75} />
        </mesh>

        <group ref={torsoRef}>
          <mesh position={[0, 0.8, 0]}>
            <capsuleGeometry args={[0.14, 0.24, 8, 16]} />
            <meshStandardMaterial color={SHELL} metalness={0.2} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.8, 0.11]}>
            <boxGeometry args={[0.18, 0.22, 0.03]} />
            <meshStandardMaterial color={accent} metalness={0.25} roughness={0.45} />
          </mesh>
        </group>

        <mesh position={[0, 0.58, 0]}>
          <boxGeometry args={[0.22, 0.08, 0.16]} />
          <meshStandardMaterial color={JOINT} roughness={0.6} />
        </mesh>

        <group ref={headRef} position={[0, 1.08, 0]}>
          <mesh>
            <sphereGeometry args={[0.12, 18, 16]} />
            <meshStandardMaterial color={SHELL} roughness={0.45} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.01, 0.095]}>
            <boxGeometry args={[0.17, 0.07, 0.03]} />
            <meshStandardMaterial color="#0f172a" emissive="#1e293b" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[-0.04, 0.01, 0.112]}>
            <boxGeometry args={[0.015, 0.015, 0.005]} />
            <meshBasicMaterial color="#93c5fd" />
          </mesh>
          <mesh position={[0.04, 0.01, 0.112]}>
            <boxGeometry args={[0.015, 0.015, 0.005]} />
            <meshBasicMaterial color="#93c5fd" />
          </mesh>
        </group>

        <group position={[0, 0.92, 0]}>
          <group position={[-0.16, 0, 0]}>
            <mesh position={[0, -0.03, 0]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial color={JOINT} />
            </mesh>
            <group ref={leftArmRef} position={[0, -0.03, 0]}>
              <mesh position={[0, -0.13, 0]}>
                <capsuleGeometry args={[0.03, 0.16, 6, 12]} />
                <meshStandardMaterial color={SHELL} roughness={0.55} />
              </mesh>
              <mesh position={[0, -0.24, 0]}>
                <sphereGeometry args={[0.03, 10, 10]} />
                <meshStandardMaterial color={JOINT} />
              </mesh>
              <mesh position={[0, -0.32, 0]}>
                <capsuleGeometry args={[0.025, 0.1, 6, 12]} />
                <meshStandardMaterial color={SHELL} roughness={0.55} />
              </mesh>
              <mesh position={[0, -0.4, 0.03]}>
                <boxGeometry args={[0.06, 0.035, 0.08]} />
                <meshStandardMaterial color={DARK} />
              </mesh>
            </group>
          </group>

          <group position={[0.16, 0, 0]}>
            <mesh position={[0, -0.03, 0]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial color={JOINT} />
            </mesh>
            <group ref={rightArmRef} position={[0, -0.03, 0]}>
              <mesh position={[0, -0.13, 0]}>
                <capsuleGeometry args={[0.03, 0.16, 6, 12]} />
                <meshStandardMaterial color={SHELL} roughness={0.55} />
              </mesh>
              <mesh position={[0, -0.24, 0]}>
                <sphereGeometry args={[0.03, 10, 10]} />
                <meshStandardMaterial color={JOINT} />
              </mesh>
              <mesh position={[0, -0.32, 0]}>
                <capsuleGeometry args={[0.025, 0.1, 6, 12]} />
                <meshStandardMaterial color={SHELL} roughness={0.55} />
              </mesh>
              <mesh position={[0, -0.4, 0.03]}>
                <boxGeometry args={[0.06, 0.035, 0.08]} />
                <meshStandardMaterial color={DARK} />
              </mesh>
            </group>
          </group>
        </group>

        <group position={[0, 0.5, 0]}>
          <group position={[-0.08, 0, 0]}>
            <mesh>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshStandardMaterial color={JOINT} />
            </mesh>
            <group ref={leftLegRef}>
              <mesh position={[0, -0.16, 0]}>
                <capsuleGeometry args={[0.036, 0.18, 6, 12]} />
                <meshStandardMaterial color={SHELL} roughness={0.55} />
              </mesh>
              <mesh position={[0, -0.29, 0]}>
                <sphereGeometry args={[0.032, 10, 10]} />
                <meshStandardMaterial color={JOINT} />
              </mesh>
              <mesh position={[0, -0.4, 0.02]}>
                <capsuleGeometry args={[0.028, 0.12, 6, 12]} />
                <meshStandardMaterial color={SHELL} roughness={0.55} />
              </mesh>
              <mesh position={[0, -0.49, 0.06]}>
                <boxGeometry args={[0.1, 0.04, 0.16]} />
                <meshStandardMaterial color={DARK} roughness={0.6} />
              </mesh>
            </group>
          </group>

          <group position={[0.08, 0, 0]}>
            <mesh>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshStandardMaterial color={JOINT} />
            </mesh>
            <group ref={rightLegRef}>
              <mesh position={[0, -0.16, 0]}>
                <capsuleGeometry args={[0.036, 0.18, 6, 12]} />
                <meshStandardMaterial color={SHELL} roughness={0.55} />
              </mesh>
              <mesh position={[0, -0.29, 0]}>
                <sphereGeometry args={[0.032, 10, 10]} />
                <meshStandardMaterial color={JOINT} />
              </mesh>
              <mesh position={[0, -0.4, 0.02]}>
                <capsuleGeometry args={[0.028, 0.12, 6, 12]} />
                <meshStandardMaterial color={SHELL} roughness={0.55} />
              </mesh>
              <mesh position={[0, -0.49, 0.06]}>
                <boxGeometry args={[0.1, 0.04, 0.16]} />
                <meshStandardMaterial color={DARK} roughness={0.6} />
              </mesh>
            </group>
          </group>
        </group>

        {isCarrying && (
          <group position={[0, 0.62, 0.22]}>
            <CargoBox taskId={robot.carrying_task_id || robot.task?.id} scale={0.42} />
          </group>
        )}

        <Html position={[0, 1.26, 0]} center distanceFactor={22}>
          <button
            type="button"
            onClick={() => onSelect?.(robot.id)}
            className={`rounded px-2 py-0.5 text-[11px] font-semibold shadow-sm ${selected ? 'bg-blue-700 text-white' : 'bg-slate-900/85 text-slate-100'}`}
          >
            UNIT-{String(robot.id).padStart(2, '0')}
          </button>
        </Html>

        {selected && (
          <Html position={[0, 1.5, 0]} center distanceFactor={16}>
            <div className="rounded-md border border-slate-300/40 bg-white/90 px-2 py-1 text-[11px] text-slate-900 shadow-sm">
              <div className="font-semibold">{status.label}</div>
              <div className="text-slate-600">{destination ? `${destination.type} (${destination.coordinate[0]},${destination.coordinate[1]})` : 'Awaiting assignment'}</div>
            </div>
          </Html>
        )}
      </group>

      {showRoutes && robot.planned_path?.length > 0 && (
        <PathTrail path={robot.planned_path} color={accent} />
      )}
    </>
  )
}
