import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Unmissable 3D Physical Barricade for Blocked Aisles
 * Engineered for maximum visibility across the entire warehouse:
 * - Spans across the aisle corridor with dual-directional hazard rails & chevron striping
 * - 4 heavy-duty industrial traffic cones at corners with reflective collars & caution tape
 * - Tall 4-meter vertical holographic warning beacon beam visible ABOVE 1.9m steel pallet racks
 * - High-altitude floating alert billboard (at y = 3.6) with animated pulse
 * - Flashing orange strobe hazard beacon and point light
 */
export default function BlockedAisle({ position = [0, 0, 0], cell = [4, 7] }) {
  const beaconRef = useRef()
  const lightRef = useRef()
  const ring1Ref = useRef()
  const ring2Ref = useRef()
  const beamRef = useRef()

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Rapid industrial strobe flash (approx 3.5Hz pulse)
    const flash = Math.sin(t * 12) > 0.1 ? 1 : 0.2
    if (beaconRef.current) {
      beaconRef.current.material.emissiveIntensity = flash * 2.0
    }
    if (lightRef.current) {
      lightRef.current.intensity = flash * 3.5
    }

    // Expanding beacon rings floating upward
    if (ring1Ref.current) {
      const p1 = (t * 1.2) % 1
      ring1Ref.current.position.y = 0.8 + p1 * 2.8
      ring1Ref.current.scale.setScalar(0.7 + p1 * 0.8)
      ring1Ref.current.material.opacity = (1 - p1) * 0.8
    }
    if (ring2Ref.current) {
      const p2 = (t * 1.2 + 0.5) % 1
      ring2Ref.current.position.y = 0.8 + p2 * 2.8
      ring2Ref.current.scale.setScalar(0.7 + p2 * 0.8)
      ring2Ref.current.material.opacity = (1 - p2) * 0.8
    }

    // Gentle pulsing beam
    if (beamRef.current) {
      beamRef.current.material.opacity = 0.35 + Math.sin(t * 6) * 0.15
    }
  })

  return (
    <group position={position}>
      {/* ─── Ground Hazard Hatching Floor Decal ─── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[0.96, 0.96]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={0.45} />
      </mesh>
      {/* Ground yellow caution border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}>
        <ringGeometry args={[0.42, 0.47, 32]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>

      {/* ─── 4 Corner Industrial Safety Traffic Cones ─── */}
      {[
        [-0.38, -0.38],
        [0.38, -0.38],
        [-0.38, 0.38],
        [0.38, 0.38],
      ].map(([cx, cz], idx) => (
        <group key={`cone-${idx}`} position={[cx, 0, cz]}>
          {/* Square rubber base */}
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.16, 0.04, 0.16]} />
            <meshStandardMaterial color="#18181b" roughness={0.8} />
          </mesh>
          {/* Orange Cone Body */}
          <mesh position={[0, 0.18, 0]}>
            <coneGeometry args={[0.07, 0.32, 16]} />
            <meshStandardMaterial color="#ea580c" roughness={0.3} />
          </mesh>
          {/* Reflective White Collar */}
          <mesh position={[0, 0.18, 0]}>
            <coneGeometry args={[0.052, 0.1, 16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.1} />
          </mesh>
        </group>
      ))}

      {/* ─── Perimeter Caution Tape Strands ─── */}
      {/* North & South hazard tape */}
      <mesh position={[0, 0.28, -0.38]}>
        <boxGeometry args={[0.76, 0.03, 0.005]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>
      <mesh position={[0, 0.28, 0.38]}>
        <boxGeometry args={[0.76, 0.03, 0.005]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>
      {/* East & West hazard tape */}
      <mesh position={[-0.38, 0.28, 0]}>
        <boxGeometry args={[0.005, 0.03, 0.76]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>
      <mesh position={[0.38, 0.28, 0]}>
        <boxGeometry args={[0.005, 0.03, 0.76]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>

      {/* ─── Heavy Industrial A-Frame Sawhorse Barricade (Oriented Across East-West Aisle) ─── */}
      <group rotation={[0, Math.PI / 2, 0]}>
        {/* Left A-Frame Leg */}
        <group position={[-0.36, 0, 0]}>
          <mesh position={[0, 0.35, -0.18]} rotation={[0.22, 0, 0]}>
            <boxGeometry args={[0.06, 0.74, 0.05]} />
            <meshStandardMaterial color="#f97316" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.35, 0.18]} rotation={[-0.22, 0, 0]}>
            <boxGeometry args={[0.06, 0.74, 0.05]} />
            <meshStandardMaterial color="#f97316" roughness={0.4} />
          </mesh>
          {/* Reflective Band */}
          <mesh position={[0, 0.38, -0.18]} rotation={[0.22, 0, 0]}>
            <boxGeometry args={[0.065, 0.12, 0.055]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.38, 0.18]} rotation={[-0.22, 0, 0]}>
            <boxGeometry args={[0.065, 0.12, 0.055]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
          {/* Cross bracket */}
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[0.05, 0.04, 0.32]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>

        {/* Right A-Frame Leg */}
        <group position={[0.36, 0, 0]}>
          <mesh position={[0, 0.35, -0.18]} rotation={[0.22, 0, 0]}>
            <boxGeometry args={[0.06, 0.74, 0.05]} />
            <meshStandardMaterial color="#f97316" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.35, 0.18]} rotation={[-0.22, 0, 0]}>
            <boxGeometry args={[0.06, 0.74, 0.05]} />
            <meshStandardMaterial color="#f97316" roughness={0.4} />
          </mesh>
          {/* Reflective Band */}
          <mesh position={[0, 0.38, -0.18]} rotation={[0.22, 0, 0]}>
            <boxGeometry args={[0.065, 0.12, 0.055]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.38, 0.18]} rotation={[-0.22, 0, 0]}>
            <boxGeometry args={[0.065, 0.12, 0.055]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
          {/* Cross bracket */}
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[0.05, 0.04, 0.32]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>

        {/* Main Barricade Rail Board (High-Visibility Yellow) */}
        <mesh position={[0, 0.58, 0]}>
          <boxGeometry args={[0.88, 0.22, 0.06]} />
          <meshStandardMaterial color="#eab308" roughness={0.3} />
        </mesh>
        {/* Alternating Black Diagonal Stripes on Rail (Both Sides) */}
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

        {/* Lower Hazard Rail */}
        <mesh position={[0, 0.34, 0]}>
          <boxGeometry args={[0.84, 0.09, 0.05]} />
          <meshStandardMaterial color="#f97316" roughness={0.4} />
        </mesh>
      </group>

      {/* ─── Flashing Orange Hazard Beacon Light ─── */}
      <group position={[0, 0.74, 0]}>
        {/* Beacon Base Mount */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.075, 0.085, 0.04, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} />
        </mesh>
        {/* Translucent Orange Strobe Dome */}
        <mesh ref={beaconRef} position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.11, 16]} />
          <meshStandardMaterial
            color="#ff5500"
            emissive="#ff4400"
            emissiveIntensity={1.5}
            roughness={0.2}
            transparent
            opacity={0.95}
          />
        </mesh>
        {/* Strobe Point Light (illuminates barricade & floor) */}
        <pointLight ref={lightRef} color="#ff7700" intensity={3.0} distance={5.0} decay={2} />
      </group>

      {/* ─── 4-Meter Tall Vertical Holographic Hazard Pillar (Visible Above All Shelves) ─── */}
      <group position={[0, 0, 0]}>
        {/* Vertical Holographic Light Beam Cylinder */}
        <mesh ref={beamRef} position={[0, 2.0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 3.8, 16]} />
          <meshBasicMaterial color="#ff4400" transparent opacity={0.4} />
        </mesh>

        {/* Pulsing Hazard Rings Ascending Beam */}
        <mesh ref={ring1Ref} position={[0, 1.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.32, 24]} />
          <meshBasicMaterial color="#ff5500" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={ring2Ref} position={[0, 2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.32, 24]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>

        {/* Top Warning Strobe Tip at Height 3.8m */}
        <mesh position={[0, 3.85, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshBasicMaterial color="#ff3300" />
        </mesh>
        <pointLight position={[0, 3.85, 0]} color="#ff4400" intensity={2.0} distance={6} decay={2} />
      </group>

      {/* ─── High-Altitude Floating 3D Warning Banner (Above 1.9m Racks) ─── */}
      <Html position={[0, 3.6, 0]} center distanceFactor={14}>
        <div className="flex flex-col items-center pointer-events-none select-none">
          <div className="bg-red-600/95 text-white font-black text-[12px] px-3 py-1.5 rounded-lg border-2 border-yellow-300 shadow-[0_0_25px_rgba(239,68,68,0.9)] whitespace-nowrap flex items-center gap-2 animate-bounce tracking-wide">
            <span className="text-yellow-300 text-sm">⛔</span>
            <span>AISLE BLOCKED ({cell[0]},{cell[1]})</span>
            <span className="bg-yellow-400 text-black text-[9px] px-1.5 py-0.5 rounded font-black uppercase">
              CLOSED
            </span>
          </div>
          {/* Vertical beacon anchor indicator */}
          <div className="w-0.5 h-6 bg-yellow-300 shadow-[0_0_8px_#facc15]"></div>
        </div>
      </Html>
    </group>
  )
}
