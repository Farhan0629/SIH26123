import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useStore from '../store'
import CargoBox from './CargoBox'
import BlockedAisle from './BlockedAisle'

/**
 * Realistic Smart Warehouse Environment
 * Features:
 * - Industrial steel pallet racks with blue uprights, orange crossbeams, and procedural cargo crates
 * - High-contrast polished concrete floor with painted yellow safety aisle lines & crosswalk hatchings
 * - Detailed Pickup Stations with roller conveyor beds and hazard safety tape
 * - Detailed Dropoff Stations with chevron borders, overhead scanner gantry, and stacked delivered cargo
 * - Detailed Inductive Charging Pads with glowing induction coils and power status totems
 * - Unmissable physical 3D barricades at blocked aisles
 */

// Procedural hash helper for deterministic shelf box variations
function pseudoHash(x, y, seed = 0) {
  const val = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453
  return val - Math.floor(val)
}

const BOX_PALETTE = ['#c8965d', '#d9a76d', '#3b82f6', '#f1f5f9', '#475569', '#eab308']

export default function Warehouse() {
  const warehouse = useStore((s) => s.warehouse)
  const tasks = useStore((s) => s.tasks)
  const robots = useStore((s) => s.robots)

  const { width, height, shelves, walls, pickups, dropoffs, chargers, blocked } = useMemo(() => {
    if (!warehouse || !warehouse.grid) {
      return { width: 20, height: 20, shelves: [], walls: [], pickups: [], dropoffs: [], chargers: [], blocked: [] }
    }

    const res = {
      width: warehouse.width,
      height: warehouse.height,
      shelves: [],
      walls: [],
      pickups: [],
      dropoffs: [],
      chargers: [],
      blocked: [],
    }

    for (let y = 0; y < warehouse.height; y++) {
      for (let x = 0; x < warehouse.width; x++) {
        const cell = warehouse.grid[y][x]
        if (cell === 1) res.shelves.push([x, y])
        else if (cell === 2) res.walls.push([x, y])
        else if (cell === 3) res.pickups.push([x, y])
        else if (cell === 4) res.dropoffs.push([x, y])
        else if (cell === 5) res.chargers.push([x, y])
      }
    }

    if (warehouse.blocked) {
      res.blocked = warehouse.blocked.map(([x, y]) => [x, y])
    }

    return res
  }, [warehouse])

  // Determine which cargo boxes should be rendered at pickup stations
  const pickupCargoList = useMemo(() => {
    if (!tasks) return []
    const list = []
    const pending = tasks.pending || []
    const active = tasks.active || []

    // Pending tasks are always waiting at pickup
    for (const t of pending) {
      list.push({ taskId: t.id, pickup: t.pickup, isAssigned: false })
    }

    // Active tasks: if the assigned robot has NOT picked it up yet, it's still at pickup
    for (const t of active) {
      const assignedRobot = robots.find((r) => r.id === t.assigned_to)
      const hasPickedUp = assignedRobot ? Boolean(assignedRobot.has_cargo || assignedRobot.carrying) : false
      if (!hasPickedUp) {
        list.push({ taskId: t.id, pickup: t.pickup, isAssigned: true, robotId: t.assigned_to })
      }
    }

    return list
  }, [tasks, robots])

  // Determine delivered cargo to display at dropoff staging zones
  const dropoffCargoList = useMemo(() => {
    if (!tasks || !tasks.completed) return []
    // Keep completed tasks list
    return tasks.completed.map((t) => ({
      taskId: t.id,
      dropoff: t.dropoff,
    }))
  }, [tasks])

  if (!warehouse) return null

  return (
    <group>
      {/* ─── 1. Heavy-Duty Concrete Floor & Safety Markings ─── */}
      <group>
        {/* Polished Epoxy Concrete Floor Slab */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.01, height / 2]}>
          <planeGeometry args={[width + 1, height + 1]} />
          <meshStandardMaterial color="#1a1d24" roughness={0.7} metalness={0.2} />
        </mesh>

        {/* Painted Safety Corridor Aisle Lines (Yellow Border Striping) */}
        {[1, 4, 7, 10, 13, 16].map((rowY) => (
          <group key={`aisle-h-${rowY}`}>
            {/* Upper lane line */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0.005, rowY + 0.08]}>
              <planeGeometry args={[width - 2, 0.04]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
            {/* Lower lane line */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0.005, rowY + 0.92]}>
              <planeGeometry args={[width - 2, 0.04]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
          </group>
        ))}

        {/* Vertical Arterial Aisle Lines */}
        {[1, 5, 9, 13, 17].map((colX) => (
          <group key={`aisle-v-${colX}`}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[colX + 0.08, 0.006, height / 2]}>
              <planeGeometry args={[0.04, height - 2]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[colX + 0.92, 0.006, height / 2]}>
              <planeGeometry args={[0.04, height - 2]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
          </group>
        ))}

        {/* Pedestrian Crosswalk Hatchings at Cross-Aisles */}
        {[4, 10, 16].map((y) => (
          <group key={`crosswalk-${y}`} position={[5.5, 0.007, y + 0.5]}>
            {[-0.3, -0.1, 0.1, 0.3].map((offZ, idx) => (
              <mesh key={`hatch-${idx}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, offZ]}>
                <planeGeometry args={[0.8, 0.08]} />
                <meshBasicMaterial color="#ffffff" opacity={0.6} transparent />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* ─── 2. Perimeter Structural Walls ─── */}
      {walls.map(([x, y], i) => (
        <group key={`wall-${i}`} position={[x + 0.5, 0, y + 0.5]}>
          {/* Main Wall Block */}
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[0.98, 1.5, 0.98]} />
            <meshStandardMaterial color="#334155" roughness={0.8} />
          </mesh>
          {/* Concrete Base Skirting */}
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[1.0, 0.2, 1.0]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          {/* High-visibility yellow safety kick-plate */}
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[1.005, 0.04, 1.005]} />
            <meshBasicMaterial color="#eab308" />
          </mesh>
        </group>
      ))}

      {/* ─── 3. Industrial Steel Pallet Racking Systems ─── */}
      {shelves.map(([x, y], i) => {
        const h1 = pseudoHash(x, y, 1)
        const h2 = pseudoHash(x, y, 2)
        const h3 = pseudoHash(x, y, 3)
        const h4 = pseudoHash(x, y, 4)

        const boxCol1 = BOX_PALETTE[Math.floor(h1 * BOX_PALETTE.length)]
        const boxCol2 = BOX_PALETTE[Math.floor(h2 * BOX_PALETTE.length)]
        const boxCol3 = BOX_PALETTE[Math.floor(h3 * BOX_PALETTE.length)]
        const boxCol4 = BOX_PALETTE[Math.floor(h4 * BOX_PALETTE.length)]

        return (
          <group key={`shelf-${i}`} position={[x + 0.5, 0, y + 0.5]}>
            {/* 4 Corner Upright Columns (Signature Industrial Royal Blue) */}
            <mesh position={[-0.4, 0.95, -0.4]}>
              <boxGeometry args={[0.04, 1.9, 0.04]} />
              <meshStandardMaterial color="#1d4ed8" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0.4, 0.95, -0.4]}>
              <boxGeometry args={[0.04, 1.9, 0.04]} />
              <meshStandardMaterial color="#1d4ed8" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[-0.4, 0.95, 0.4]}>
              <boxGeometry args={[0.04, 1.9, 0.04]} />
              <meshStandardMaterial color="#1d4ed8" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0.4, 0.95, 0.4]}>
              <boxGeometry args={[0.04, 1.9, 0.04]} />
              <meshStandardMaterial color="#1d4ed8" metalness={0.7} roughness={0.3} />
            </mesh>

            {/* Diagonal Side Cross-Bracings */}
            <mesh position={[-0.4, 0.95, 0]} rotation={[0.4, 0, 0]}>
              <boxGeometry args={[0.02, 1.8, 0.02]} />
              <meshStandardMaterial color="#2563eb" />
            </mesh>
            <mesh position={[0.4, 0.95, 0]} rotation={[-0.4, 0, 0]}>
              <boxGeometry args={[0.02, 1.8, 0.02]} />
              <meshStandardMaterial color="#2563eb" />
            </mesh>

            {/* ─── Tier 1: Lower Shelf (Safety Orange Beams + Deck) ─── */}
            <mesh position={[0, 0.72, -0.4]}>
              <boxGeometry args={[0.84, 0.06, 0.03]} />
              <meshStandardMaterial color="#ea580c" metalness={0.6} />
            </mesh>
            <mesh position={[0, 0.72, 0.4]}>
              <boxGeometry args={[0.84, 0.06, 0.03]} />
              <meshStandardMaterial color="#ea580c" metalness={0.6} />
            </mesh>
            {/* Shelf Deck Plate */}
            <mesh position={[0, 0.73, 0]}>
              <boxGeometry args={[0.82, 0.02, 0.8]} />
              <meshStandardMaterial color="#475569" roughness={0.6} />
            </mesh>

            {/* Tier 1 Assorted Packages/Boxes */}
            <mesh position={[-0.18, 0.91, -0.15]}>
              <boxGeometry args={[0.32, 0.32, 0.38]} />
              <meshStandardMaterial color={boxCol1} roughness={0.8} />
            </mesh>
            <mesh position={[0.18, 0.88, -0.15]}>
              <boxGeometry args={[0.3, 0.26, 0.34]} />
              <meshStandardMaterial color={boxCol2} roughness={0.8} />
            </mesh>
            <mesh position={[0.02, 0.89, 0.2]}>
              <boxGeometry args={[0.48, 0.28, 0.3]} />
              <meshStandardMaterial color={boxCol3} roughness={0.7} />
            </mesh>

            {/* ─── Tier 2: Upper Shelf (Safety Orange Beams + Deck) ─── */}
            <mesh position={[0, 1.42, -0.4]}>
              <boxGeometry args={[0.84, 0.06, 0.03]} />
              <meshStandardMaterial color="#ea580c" metalness={0.6} />
            </mesh>
            <mesh position={[0, 1.42, 0.4]}>
              <boxGeometry args={[0.84, 0.06, 0.03]} />
              <meshStandardMaterial color="#ea580c" metalness={0.6} />
            </mesh>
            {/* Shelf Deck Plate */}
            <mesh position={[0, 1.43, 0]}>
              <boxGeometry args={[0.82, 0.02, 0.8]} />
              <meshStandardMaterial color="#475569" roughness={0.6} />
            </mesh>

            {/* Tier 2 Assorted Packages/Boxes */}
            <mesh position={[-0.15, 1.6, 0.05]}>
              <boxGeometry args={[0.38, 0.3, 0.42]} />
              <meshStandardMaterial color={boxCol4} roughness={0.8} />
            </mesh>
            <mesh position={[0.2, 1.58, 0.05]}>
              <boxGeometry args={[0.26, 0.26, 0.32]} />
              <meshStandardMaterial color="#c8965d" roughness={0.8} />
            </mesh>
          </group>
        )
      })}

      {/* ─── 4. Dedicated Pickup Stations (AMR Drive-Under Pallet Stand) ─── */}
      {pickups.map(([x, y], idx) => {
        // Find all tasks waiting at this pickup station
        const stationCargo = pickupCargoList.filter(
          (item) => item.pickup[0] === x && item.pickup[1] === y
        )
        const primaryCargo = stationCargo[0]
        const queuedCargo = stationCargo.slice(1, 3)

        return (
          <group key={`pickup-${idx}`} position={[x + 0.5, 0, y + 0.5]}>
            {/* Ground Safety Staging Pad with Green Border */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <planeGeometry args={[0.96, 0.96]} />
              <meshBasicMaterial color="#059669" transparent opacity={0.25} />
            </mesh>

            {/* Ground Docking Guide Entry Rails (Yellow) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.37, 0.015, 0]}>
              <planeGeometry args={[0.04, 0.88]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.37, 0.015, 0]}>
              <planeGeometry args={[0.04, 0.88]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>

            {/* ─── AMR Drive-Under Pallet Stand ─── */}
            {/* 4 Outer Heavy Steel Support Columns (Wide Clearance: 0.74m width, 0.26m height) */}
            {[[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]].map(([lx, lz], li) => (
              <mesh key={`p-leg-${li}`} position={[lx, 0.14, lz]}>
                <boxGeometry args={[0.05, 0.28, 0.05]} />
                <meshStandardMaterial color="#1e293b" metalness={0.7} />
              </mesh>
            ))}

            {/* Left & Right Cantilevered Pallet Rest Rails (Y = 0.27) */}
            <mesh position={[-0.36, 0.27, 0]}>
              <boxGeometry args={[0.08, 0.04, 0.88]} />
              <meshStandardMaterial color="#059669" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0.36, 0.27, 0]}>
              <boxGeometry args={[0.08, 0.04, 0.88]} />
              <meshStandardMaterial color="#059669" metalness={0.6} roughness={0.3} />
            </mesh>

            {/* Infeed Overhead Sensor & Alignment Beam (Rear) */}
            <group position={[0, 0.65, -0.42]}>
              <mesh>
                <boxGeometry args={[0.88, 0.03, 0.03]} />
                <meshStandardMaterial color="#334155" />
              </mesh>
              <mesh position={[0, -0.03, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 0.03, 8]} />
                <meshBasicMaterial color="#10b981" />
              </mesh>
            </group>

            {/* ─── Real Cargo Pallet Resting on Stand (Ready for AMR Pickup) ─── */}
            {primaryCargo && (
              <group position={[0, 0.25, 0]}>
                <CargoBox taskId={primaryCargo.taskId} scale={0.88} />
              </group>
            )}

            {/* ─── Queued Infeed Pallet(s) in Rear Infeed Lane ─── */}
            {queuedCargo.map((qItem, qIdx) => (
              <group
                key={`q-cargo-${qItem.taskId}`}
                position={[0, 0.25, -0.28 * (qIdx + 1)]}
              >
                <CargoBox taskId={qItem.taskId} scale={0.75} />
              </group>
            ))}

            {/* HTML Floating Station Marker */}
            <Html position={[0, 1.1, 0]} center distanceFactor={16}>
              <div className="bg-emerald-950/90 text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-500/60 shadow-lg text-[10px] font-bold whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md">
                <span>📥</span>
                <span>PICKUP P{idx + 1}</span>
                {primaryCargo ? (
                  <span className="bg-emerald-500 text-black px-1.5 py-0.2 rounded text-[9px] font-black animate-pulse">
                    READY #{primaryCargo.taskId}
                  </span>
                ) : (
                  <span className="text-gray-400 text-[9px]">IDLE</span>
                )}
                {stationCargo.length > 1 && (
                  <span className="bg-amber-600 text-white px-1 rounded text-[8px] font-mono font-bold">
                    +{stationCargo.length - 1} QUEUED
                  </span>
                )}
              </div>
            </Html>
          </group>
        )
      })}

      {/* ─── 5. Dedicated Dropoff Stations (Sorting Pad & Outbound Buffer) ─── */}
      {dropoffs.map(([x, y], idx) => {
        // Find delivered cargo for this station
        const stationDelivered = dropoffCargoList.filter(
          (item) => item.dropoff[0] === x && item.dropoff[1] === y
        )
        // Show up to 3 most recently delivered boxes in reverse order (newest first)
        const recentDelivered = stationDelivered.slice(-3).reverse()

        return (
          <group key={`dropoff-${idx}`} position={[x + 0.5, 0, y + 0.5]}>
            {/* Center Heavy-Duty AMR Landing & Unloading Pad */}
            <mesh position={[-0.1, 0.02, 0]}>
              <boxGeometry args={[0.74, 0.04, 0.96]} />
              <meshStandardMaterial color="#1e293b" roughness={0.7} />
            </mesh>

            {/* Yellow / Black Chevron Perimeter Hazard Borders on Landing Pad */}
            <mesh position={[-0.1, 0.042, 0.44]}>
              <planeGeometry args={[0.72, 0.07]} rotation={[-Math.PI / 2, 0, 0]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
            <mesh position={[-0.1, 0.042, -0.44]}>
              <planeGeometry args={[0.72, 0.07]} rotation={[-Math.PI / 2, 0, 0]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
            <mesh position={[-0.44, 0.042, 0]}>
              <planeGeometry args={[0.07, 0.94]} rotation={[-Math.PI / 2, 0, 0]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>

            {/* Tall Optical Scanner Gantry Arch (Height 1.3m — AMR & cargo pass cleanly under!) */}
            <group position={[-0.1, 0, 0]}>
              {/* Left Post */}
              <mesh position={[-0.38, 0.65, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 1.3, 10]} />
                <meshStandardMaterial color="#0284c7" metalness={0.7} />
              </mesh>
              {/* Right Post */}
              <mesh position={[0.38, 0.65, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 1.3, 10]} />
                <meshStandardMaterial color="#0284c7" metalness={0.7} />
              </mesh>
              {/* Overhead Scanner Arch Bar */}
              <mesh position={[0, 1.3, 0]}>
                <boxGeometry args={[0.82, 0.04, 0.06]} />
                <meshStandardMaterial color="#0284c7" metalness={0.7} />
              </mesh>
              {/* Downward Scanning Laser Beam (Red Line) */}
              <mesh position={[0, 1.27, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 0.03, 8]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
            </group>

            {/* ─── Outbound Staging Conveyor Buffer (Side buffer at x = +0.36) ─── */}
            <group position={[0.36, 0, 0]}>
              {/* Conveyor base bed */}
              <mesh position={[0, 0.06, 0]}>
                <boxGeometry args={[0.24, 0.12, 0.96]} />
                <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
              </mesh>
              {/* Galvanized rollers */}
              {[-0.38, -0.22, -0.07, 0.07, 0.22, 0.38].map((rz, ri) => (
                <mesh key={`out-roll-${ri}`} position={[0, 0.125, rz]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.014, 0.014, 0.22, 10]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
                </mesh>
              ))}

              {/* ─── Display Recent Delivered Cargo Pallets Advancing Along Buffer ─── */}
              {recentDelivered.length > 0 ? (
                recentDelivered.map((item, dIdx) => (
                  <group
                    key={`del-cargo-${item.taskId}-${dIdx}`}
                    position={[0, 0.13, 0.28 - dIdx * 0.28]}
                  >
                    <CargoBox taskId={item.taskId} scale={0.44} />
                  </group>
                ))
              ) : (
                <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[0.18, 0.24]} />
                  <meshBasicMaterial color="#f97316" transparent opacity={0.25} />
                </mesh>
              )}
            </group>

            {/* HTML Floating Station Marker */}
            <Html position={[-0.1, 1.45, 0]} center distanceFactor={16}>
              <div className="bg-amber-950/90 text-amber-300 px-2.5 py-1 rounded-md border border-amber-500/60 shadow-lg text-[10px] font-bold whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md">
                <span>📤</span>
                <span>DROPOFF D{idx + 1}</span>
                {stationDelivered.length > 0 ? (
                  <span className="bg-amber-500 text-black px-1.5 py-0.2 rounded text-[9px] font-black">
                    {stationDelivered.length} DELIVERED
                  </span>
                ) : (
                  <span className="text-gray-400 text-[9px]">READY</span>
                )}
                {recentDelivered.length > 0 && (
                  <span className="bg-blue-600 text-white px-1 rounded text-[8px] font-mono">
                    LAST #{recentDelivered[0].taskId}
                  </span>
                )}
              </div>
            </Html>
          </group>
        )
      })}

      {/* ─── 6. Dedicated Inductive AMR Fast-Charging Stations ─── */}
      {chargers.map(([x, y], idx) => (
        <group key={`charger-${idx}`} position={[x + 0.5, 0, y + 0.5]}>
          {/* Base Inductive Charger Floor Tray */}
          <mesh position={[0, 0.015, 0]}>
            <boxGeometry args={[0.92, 0.03, 0.92]} />
            <meshStandardMaterial color="#0f172a" roughness={0.6} />
          </mesh>

          {/* High-Voltage Copper Outer Induction Rim */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.032, 0]}>
            <ringGeometry args={[0.28, 0.34, 32]} />
            <meshStandardMaterial color="#b45309" metalness={0.9} roughness={0.2} />
          </mesh>

          {/* Illuminated Wireless Charging Magnetic Coils */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.033, 0]}>
            <ringGeometry args={[0.16, 0.24, 32]} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.033, 0]}>
            <circleGeometry args={[0.09, 24]} />
            <meshBasicMaterial color="#0284c7" />
          </mesh>

          {/* Vertical Smart Charging Totem (Rear) */}
          <group position={[0, 0.42, -0.38]}>
            {/* Totem Column Body */}
            <mesh>
              <boxGeometry args={[0.18, 0.82, 0.12]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Glowing Blue LED Status Indicator Panel */}
            <mesh position={[0, 0.22, 0.062]}>
              <planeGeometry args={[0.12, 0.22]} />
              <meshBasicMaterial color="#00f0ff" />
            </mesh>
            {/* Lightning bolt symbol */}
            <mesh position={[0, 0.22, 0.063]}>
              <planeGeometry args={[0.06, 0.12]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>

          {/* HTML Station Marker */}
          <Html position={[0, 0.95, 0]} center distanceFactor={16}>
            <div className="bg-sky-950/90 text-sky-300 px-2 py-0.5 rounded border border-sky-500/60 shadow-lg text-[10px] font-bold whitespace-nowrap flex items-center gap-1">
              <span>⚡</span>
              <span>CHARGER C{idx + 1}</span>
            </div>
          </Html>
        </group>
      ))}

      {/* ─── 7. Unmissable 3D Physical Barricades for Blocked Aisles ─── */}
      {blocked.map(([bx, by], i) => (
        <BlockedAisle key={`blocked-${bx}-${by}-${i}`} position={[bx + 0.5, 0, by + 0.5]} cell={[bx, by]} />
      ))}
    </group>
  )
}
