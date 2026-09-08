import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import PathTrail from './PathTrail'
import CargoBox from './CargoBox'

const ROBOT_COLORS = ['#00f0ff', '#f43f5e', '#eab308', '#10b981', '#a855f7']

/**
 * Industrial Smart AMR Robot Model
 * Inspired by KUKA KMP / Amazon Hercules / Otto Motors heavy-duty warehouse robots.
 * Features:
 * - Low-profile chassis with protective rubber bumper & accent livery
 * - Recessed side drive wheels with treads + omnidirectional front/rear casters
 * - Mechanical lifter deck / turntable carrying physical cargo
 * - Continuously spinning high-precision LiDAR scanner
 * - Status-responsive LED headlights and underglow halo
 * - E-Stop safety mushroom button and RF telemetry antenna
 */
export default function Robot({ robot }) {
  const groupRef = useRef()
  const lidarRef = useRef()
  const targetPos = useRef(new THREE.Vector3(robot.x + 0.5, 0, robot.y + 0.5))
  const currentPos = useRef(new THREE.Vector3(robot.x + 0.5, 0, robot.y + 0.5))

  const robotLiveryColor = ROBOT_COLORS[(robot.id - 1) % ROBOT_COLORS.length]

  targetPos.current.set(robot.x + 0.5, 0, robot.y + 0.5)

  useFrame((_, delta) => {
    if (groupRef.current) {
      // If position jumped significantly (e.g. simulation reset or respawn), snap directly
      if (currentPos.current.distanceTo(targetPos.current) > 2.5) {
        currentPos.current.copy(targetPos.current)
      } else {
        // Smooth position interpolation
        currentPos.current.lerp(targetPos.current, Math.min(1, delta * 12))
      }
      groupRef.current.position.copy(currentPos.current)

      // Heading: 0=+X, 90=+Z, 180=-X, 270=-Z
      const targetRotY = -robot.heading * (Math.PI / 180)
      let diff = (targetRotY - groupRef.current.rotation.y) % (Math.PI * 2)
      if (diff < -Math.PI) diff += Math.PI * 2
      if (diff > Math.PI) diff -= Math.PI * 2
      groupRef.current.rotation.y += diff * Math.min(1, delta * 10)
    }

    // Spin LiDAR puck
    if (lidarRef.current) {
      lidarRef.current.rotation.y += delta * 14
    }
  })

  // Dynamic status lighting
  const isCarrying = Boolean(robot.has_cargo || robot.carrying)
  const isYielding = Boolean(robot.is_yielding || robot.status === 'yielding')
  let statusColor = '#00f0ff' // Default moving: cyan
  let statusText = robot.status

  if (isYielding) {
    statusColor = '#f59e0b' // Yielding / resolving conflict: Amber / Yellow
    statusText = 'yielding'
  } else if (robot.status === 'waiting') {
    statusColor = '#ef4444' // Blocked/waiting: Red
  } else if (robot.status === 'idle') {
    statusColor = '#64748b' // Idle: Cool Gray
  } else if (robot.status === 'charging' || robot.status === 'moving_to_charge') {
    statusColor = '#22c55e' // Charging: Bright Green
  } else if (isCarrying) {
    statusColor = '#3b82f6' // Carrying cargo: High-Vis Blue
  } else {
    statusColor = robotLiveryColor
  }

  const batteryColor = robot.battery > 50 ? '#22c55e' : robot.battery > 20 ? '#eab308' : '#ef4444'

  return (
    <>
      <group ref={groupRef} position={[robot.x + 0.5, 0, robot.y + 0.5]}>
        {/* ─── Ground LED Safety Underglow Strip ─── */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <planeGeometry args={[0.7, 0.56]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.4} />
        </mesh>

        {/* ─── Heavy Industrial Rubber Bumper (Base Perimeter) ─── */}
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[0.72, 0.08, 0.58]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>

        {/* ─── Main AMR Chassis Body ─── */}
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.66, 0.1, 0.52]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.6} />
        </mesh>

        {/* Robot Livery Accent Stripes (Top Sides) */}
        <mesh position={[0, 0.175, 0.24]}>
          <boxGeometry args={[0.62, 0.01, 0.03]} />
          <meshStandardMaterial color={robotLiveryColor} emissive={robotLiveryColor} emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0.175, -0.24]}>
          <boxGeometry args={[0.62, 0.01, 0.03]} />
          <meshStandardMaterial color={robotLiveryColor} emissive={robotLiveryColor} emissiveIntensity={0.6} />
        </mesh>

        {/* ─── Drive Wheels (Left & Right Recessed) ─── */}
        {/* Left Drive Wheel (+Z) */}
        <mesh position={[0, 0.08, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.04, 16]} />
          <meshStandardMaterial color="#18181b" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.08, 0.301]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.005, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} />
        </mesh>

        {/* Right Drive Wheel (-Z) */}
        <mesh position={[0, 0.08, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.04, 16]} />
          <meshStandardMaterial color="#18181b" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.08, -0.301]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.005, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} />
        </mesh>

        {/* Front Omni-Directional Caster Wheel (+X) */}
        <mesh position={[0.26, 0.045, 0]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Rear Omni-Directional Caster Wheel (-X) */}
        <mesh position={[-0.26, 0.045, 0]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* ─── Mechanical Lifter Deck / Turntable Platform ─── */}
        <group position={[0, isCarrying ? 0.20 : 0.175, 0]}>
          {/* Turntable Base Plate */}
          <mesh>
            <cylinderGeometry args={[0.22, 0.24, 0.03, 24]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Top Non-Slip Rubber Gripper Mat */}
          <mesh position={[0, 0.016, 0]}>
            <cylinderGeometry args={[0.21, 0.21, 0.005, 24]} />
            <meshStandardMaterial color="#09090b" roughness={0.9} />
          </mesh>

          {/* ─── Physical Cargo Mounting ─── */}
          {isCarrying && (
            <group position={[0, 0.02, 0]}>
              <CargoBox
                taskId={robot.carrying_task_id || robot.task?.id}
                scale={0.88}
              />
            </group>
          )}
        </group>

        {/* ─── Front High-Precision LiDAR Laser Scanner (+X) ─── */}
        <group position={[0.24, 0.18, 0]}>
          {/* LiDAR Stationary Mounting Stalk */}
          <mesh position={[0, 0.015, 0]}>
            <cylinderGeometry args={[0.045, 0.05, 0.03, 16]} />
            <meshStandardMaterial color="#09090b" />
          </mesh>
          {/* Rotating LiDAR Puck */}
          <mesh ref={lidarRef} position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 16]} />
            <meshStandardMaterial color="#18181b" roughness={0.3} metalness={0.8} />
          </mesh>
          {/* Pulsing Cyan Laser Aperture */}
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.041, 0.041, 0.008, 16]} />
            <meshBasicMaterial color="#00ffff" />
          </mesh>
        </group>

        {/* ─── Front LED Headlights & Status Lightbar (+X) ─── */}
        <mesh position={[0.362, 0.11, 0.14]}>
          <boxGeometry args={[0.01, 0.035, 0.09]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={1.8} />
        </mesh>
        <mesh position={[0.362, 0.11, -0.14]}>
          <boxGeometry args={[0.01, 0.035, 0.09]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={1.8} />
        </mesh>
        {/* Center Optical Camera Lens */}
        <mesh position={[0.362, 0.11, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.01, 12]} rotation={[0, 0, Math.PI / 2]} />
          <meshBasicMaterial color="#0284c7" />
        </mesh>

        {/* ─── Rear Industrial Safety Features (-X) ─── */}
        {/* Emergency Stop (E-Stop) Mushroom Switch */}
        <group position={[-0.26, 0.18, 0.18]}>
          {/* Yellow Safety Collar Base */}
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.025, 0.03, 0.02, 12]} />
            <meshStandardMaterial color="#eab308" />
          </mesh>
          {/* Red Mushroom Button */}
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.028, 0.02, 0.02, 12]} />
            <meshStandardMaterial color="#dc2626" roughness={0.3} />
          </mesh>
        </group>

        {/* Industrial RF Radio Telemetry Antenna */}
        <group position={[-0.26, 0.18, -0.18]}>
          {/* Antenna Brass Socket */}
          <mesh position={[0, 0.015, 0]}>
            <cylinderGeometry args={[0.015, 0.02, 0.03, 10]} />
            <meshStandardMaterial color="#b45309" metalness={0.8} />
          </mesh>
          {/* Flexible Antenna Rod */}
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.004, 0.006, 0.26, 8]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Antenna RF Tip */}
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshBasicMaterial color={statusColor} />
          </mesh>
        </group>

        {/* ─── Real-Time Industrial HTML Telemetry Tag ─── */}
        <Html position={[0, isCarrying ? 1.05 : 0.85, 0]} center distanceFactor={16}>
          <div className="flex flex-col items-center pointer-events-none select-none">
            <div
              className="px-2 py-0.5 rounded-md text-[11px] font-bold border whitespace-nowrap shadow-lg flex items-center gap-1.5 backdrop-blur-md transition-all duration-200"
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                borderColor: statusColor,
                color: statusColor,
                boxShadow: `0 0 10px ${statusColor}44`,
              }}
            >
              <span>AMR-{robot.id}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-200 text-[10px] font-medium">{statusText}</span>
              <span className="font-mono text-[9px] px-1 rounded bg-black/40" style={{ color: batteryColor }}>
                {Math.round(robot.battery)}%
              </span>
            </div>
            {isYielding && (
              <div className="mt-0.5 px-1.5 py-0.2 bg-amber-950/90 text-amber-300 text-[9px] font-mono rounded border border-amber-500/50 shadow flex items-center gap-1 animate-pulse">
                <span>⚠️</span>
                <span>YIELDING P2P</span>
              </div>
            )}
            {isCarrying && (
              <div className="mt-0.5 px-1.5 py-0.2 bg-blue-950/90 text-blue-200 text-[9px] font-mono rounded border border-blue-500/50 shadow flex items-center gap-1">
                <span>📦</span>
                <span>Box #{robot.carrying_task_id || robot.task?.id || '1'}</span>
              </div>
            )}
          </div>
        </Html>
      </group>

      {/* Path trail */}
      {robot.planned_path && robot.planned_path.length > 0 && (
        <PathTrail path={robot.planned_path} color={robotLiveryColor} />
      )}
    </>
  )
}
