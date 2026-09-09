import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Sign from './Signage'

/**
 * Physical barricade for a blocked aisle cell.
 *
 * Blockages are now hand-placed (and drag-painted) from the dashboard while the
 * demo is paused, so a run can carry many of them at once. Two changes keep
 * that affordable and readable:
 *  - the floating HTML warning card is gone, replaced by a 3D hazard sign that
 *    lives in the scene like the rest of the signage
 *  - the strobe point lights are gone, so painting a dozen barriers cannot
 *    blow past the renderer's light budget. The strobe is emissive instead.
 */
export default function BlockedAisle({ position = [0, 0, 0], cell = [4, 7] }) {
  const beaconRef = useRef()
  const ring1Ref = useRef()
  const ring2Ref = useRef()
  const beamRef = useRef()

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const flash = Math.sin(t * 12) > 0.1 ? 1 : 0.2
    if (beaconRef.current) beaconRef.current.material.emissiveIntensity = flash * 2.0
    if (ring1Ref.current) {
      const p1 = (t * 1.2) % 1
      ring1Ref.current.position.y = 0.8 + p1 * 1.9
      ring1Ref.current.scale.setScalar(0.7 + p1 * 0.8)
      ring1Ref.current.material.opacity = (1 - p1) * 0.7
    }
    if (ring2Ref.current) {
      const p2 = (t * 1.2 + 0.5) % 1
      ring2Ref.current.position.y = 0.8 + p2 * 1.9
      ring2Ref.current.scale.setScalar(0.7 + p2 * 0.8)
      ring2Ref.current.material.opacity = (1 - p2) * 0.7
    }
    if (beamRef.current) beamRef.current.material.opacity = 0.3 + Math.sin(t * 6) * 0.12
  })

  return (
    <group position={position}>
      {/* Ground hazard decal and caution ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[0.96, 0.96]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={0.45} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}>
        <ringGeometry args={[0.42, 0.47, 32]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>

      {/* Four corner traffic cones */}
      {[[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]].map(([cx, cz], idx) => (
        <group key={`cone-${idx}`} position={[cx, 0, cz]}>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.16, 0.04, 0.16]} />
            <meshStandardMaterial color="#18181b" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <coneGeometry args={[0.07, 0.32, 16]} />
            <meshStandardMaterial color="#ea580c" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <coneGeometry args={[0.052, 0.1, 16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.1} />
          </mesh>
        </group>
      ))}

      {/* Perimeter caution tape */}
      {[-0.38, 0.38].map((z) => (
        <mesh key={`tape-z-${z}`} position={[0, 0.28, z]}>
          <boxGeometry args={[0.76, 0.03, 0.005]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      ))}
      {[-0.38, 0.38].map((x) => (
        <mesh key={`tape-x-${x}`} position={[x, 0.28, 0]}>
          <boxGeometry args={[0.005, 0.03, 0.76]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      ))}

      {/* A-frame sawhorse barricade across the aisle */}
      <group rotation={[0, Math.PI / 2, 0]}>
        {[-0.36, 0.36].map((legX) => (
          <group key={`leg-${legX}`} position={[legX, 0, 0]}>
            <mesh position={[0, 0.35, -0.18]} rotation={[0.22, 0, 0]}>
              <boxGeometry args={[0.06, 0.74, 0.05]} />
              <meshStandardMaterial color="#f97316" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.35, 0.18]} rotation={[-0.22, 0, 0]}>
              <boxGeometry args={[0.06, 0.74, 0.05]} />
              <meshStandardMaterial color="#f97316" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.38, -0.18]} rotation={[0.22, 0, 0]}>
              <boxGeometry args={[0.065, 0.12, 0.055]} />
              <meshStandardMaterial color="#ffffff" roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.38, 0.18]} rotation={[-0.22, 0, 0]}>
              <boxGeometry args={[0.065, 0.12, 0.055]} />
              <meshStandardMaterial color="#ffffff" roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.25, 0]}>
              <boxGeometry args={[0.05, 0.04, 0.32]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.58, 0]}>
          <boxGeometry args={[0.88, 0.22, 0.06]} />
          <meshStandardMaterial color="#eab308" roughness={0.3} />
        </mesh>
        {[-0.3, -0.15, 0, 0.15, 0.3].map((xOffset, idx) => (
          <group key={`stripe-pair-${idx}`}>
            <mesh position={[xOffset, 0.58, 0.032]} rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[0.07, 0.24]} />
              <meshBasicMaterial color="#111827" />
            </mesh>
            <mesh position={[xOffset, 0.58, -0.032]} rotation={[0, Math.PI, Math.PI / 4]}>
              <planeGeometry args={[0.07, 0.24]} />
              <meshBasicMaterial color="#111827" />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.34, 0]}>
          <boxGeometry args={[0.84, 0.09, 0.05]} />
          <meshStandardMaterial color="#f97316" roughness={0.4} />
        </mesh>
      </group>

      {/* Emissive strobe beacon (no point light: many barriers stay cheap) */}
      <group position={[0, 0.74, 0]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.075, 0.085, 0.04, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} />
        </mesh>
        <mesh ref={beaconRef} position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.11, 16]} />
          <meshStandardMaterial color="#ff5500" emissive="#ff4400" emissiveIntensity={1.5} roughness={0.2} transparent opacity={0.95} />
        </mesh>
      </group>

      {/* Hazard mast, tall enough to read over the low racks */}
      <mesh ref={beamRef} position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 2.6, 12]} />
        <meshBasicMaterial color="#ff4400" transparent opacity={0.35} />
      </mesh>
      <mesh ref={ring1Ref} position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.32, 24]} />
        <meshBasicMaterial color="#ff5500" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} position={[0, 1.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.32, 24]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.82, 0]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshBasicMaterial color="#ff3300" />
      </mesh>

      <Sign at={[0, 2.5, 0]} title="AISLE BLOCKED" subtitle={`(${cell[0]},${cell[1]})`} tone="#dc2626" width={1.15} />
    </group>
  )
}
