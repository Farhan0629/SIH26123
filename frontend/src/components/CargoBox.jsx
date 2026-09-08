import React from 'react'
import { Html } from '@react-three/drei'

/**
 * Realistic Industrial Cargo Model
 * Consists of a timber Euro-pallet base, corrugated kraft cardboard crate,
 * reinforced seam tape, dual black poly tension straps, and shipping barcode label.
 */
export default function CargoBox({ taskId, position = [0, 0, 0], scale = 1, rotation = [0, 0, 0] }) {
  const packageCode = `PKG-${String(taskId || 0).padStart(3, '0')}`
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* ─── Wooden Pallet Base ─── */}
      {/* 3 Bottom Skids / Stringers (Z-axis) */}
      <mesh position={[-0.2, 0.025, 0]}>
        <boxGeometry args={[0.06, 0.05, 0.52]} />
        <meshStandardMaterial color="#ab7a4e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.025, 0]}>
        <boxGeometry args={[0.06, 0.05, 0.52]} />
        <meshStandardMaterial color="#a07246" roughness={0.9} />
      </mesh>
      <mesh position={[0.2, 0.025, 0]}>
        <boxGeometry args={[0.06, 0.05, 0.52]} />
        <meshStandardMaterial color="#ab7a4e" roughness={0.9} />
      </mesh>

      {/* Top Deck Slats (X-axis) */}
      {[-0.21, -0.105, 0, 0.105, 0.21].map((zPos, idx) => (
        <mesh key={`deck-slat-${idx}`} position={[0, 0.055, zPos]}>
          <boxGeometry args={[0.52, 0.015, 0.08]} />
          <meshStandardMaterial color={idx % 2 === 0 ? "#b88756" : "#ad7c4a"} roughness={0.85} />
        </mesh>
      ))}

      {/* ─── Heavy-Duty Corrugated Cardboard Box ─── */}
      <mesh position={[0, 0.245, 0]}>
        <boxGeometry args={[0.44, 0.36, 0.44]} />
        <meshStandardMaterial color="#cb9861" roughness={0.8} />
      </mesh>

      {/* Center Seam Packing Tape (Top) */}
      <mesh position={[0, 0.428, 0]}>
        <boxGeometry args={[0.1, 0.006, 0.442]} />
        <meshStandardMaterial color="#916738" roughness={0.5} />
      </mesh>

      {/* Tension Poly Strapping Band 1 */}
      <mesh position={[-0.12, 0.245, 0]}>
        <boxGeometry args={[0.016, 0.368, 0.446]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
      </mesh>

      {/* Tension Poly Strapping Band 2 */}
      <mesh position={[0.12, 0.245, 0]}>
        <boxGeometry args={[0.016, 0.368, 0.446]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
      </mesh>

      {/* ─── Front Shipping Barcode Label ─── */}
      <group position={[0, 0.25, 0.222]}>
        {/* White Label Background */}
        <mesh>
          <planeGeometry args={[0.14, 0.1]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        {/* Barcode lines */}
        <mesh position={[-0.01, 0.015, 0.001]}>
          <planeGeometry args={[0.09, 0.035]} />
          <meshBasicMaterial color="#111827" />
        </mesh>
        {/* Red Fragile / Priority Tag Indicator */}
        <mesh position={[0.045, 0.03, 0.001]}>
          <planeGeometry args={[0.025, 0.015]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        <Html position={[0, -0.03, 0.002]} transform>
          <div className="bg-white/90 px-1 py-[1px] text-[9px] font-semibold text-slate-900">
            {packageCode}
          </div>
        </Html>
      </group>

      {/* ─── Side Handling Symbol ─── */}
      <mesh position={[0.222, 0.28, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.08, 0.08]} />
        <meshBasicMaterial color="#334155" />
      </mesh>
    </group>
  )
}
