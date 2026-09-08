import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import useStore from '../store'
import CargoBox from './CargoBox'
import BlockedAisle from './BlockedAisle'
import { getRobotNextDestination, mapCargoLifecycle } from '../utils/simulationState.js'

function stationLabel(text, tone) {
  if (tone === 'amber') return 'bg-amber-100/90 text-amber-900 border-amber-300'
  if (tone === 'green') return 'bg-emerald-100/90 text-emerald-900 border-emerald-300'
  return 'bg-slate-100/90 text-slate-900 border-slate-300'
}

function LayoutMarker({ text, subtitle, tone = 'slate' }) {
  return (
    <div className={`rounded border px-2 py-1 text-[11px] shadow-sm ${stationLabel(text, tone)}`}>
      <div className="font-semibold tracking-wide">{text}</div>
      {subtitle && <div className="text-[10px] opacity-80">{subtitle}</div>}
    </div>
  )
}

export default function Warehouse() {
  const warehouse = useStore((s) => s.warehouse)
  const tasks = useStore((s) => s.tasks)
  const robots = useStore((s) => s.robots)
  const selectedRobotId = useStore((s) => s.selectedRobotId)
  const shelfView = useStore((s) => s.shelfView)

  const { width, height, shelves, walls, pickups, dropoffs, chargers, blocked } = useMemo(() => {
    if (!warehouse?.grid) {
      return { width: 20, height: 20, shelves: [], walls: [], pickups: [], dropoffs: [], chargers: [], blocked: [] }
    }

    const parsed = {
      width: warehouse.width,
      height: warehouse.height,
      shelves: [],
      walls: [],
      pickups: [],
      dropoffs: [],
      chargers: [],
      blocked: warehouse.blocked || [],
    }

    for (let y = 0; y < warehouse.height; y += 1) {
      for (let x = 0; x < warehouse.width; x += 1) {
        const cell = warehouse.grid[y][x]
        if (cell === 1) parsed.shelves.push([x, y])
        if (cell === 2) parsed.walls.push([x, y])
        if (cell === 3) parsed.pickups.push([x, y])
        if (cell === 4) parsed.dropoffs.push([x, y])
        if (cell === 5) parsed.chargers.push([x, y])
      }
    }
    return parsed
  }, [warehouse])

  const { pickupCargo, deliveredCargo } = useMemo(() => mapCargoLifecycle(tasks, robots), [tasks, robots])
  const selectedRobot = robots.find((r) => r.id === selectedRobotId)
  const destination = selectedRobot ? getRobotNextDestination(selectedRobot) : null

  if (!warehouse) return null

  const shelfOpacity = shelfView === 'xray' ? 0.32 : 1
  const shelfHeight = shelfView === 'lowRack' ? 0.92 : 1.74
  const showUpperShelf = shelfView !== 'lowRack'

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.01, height / 2]} receiveShadow>
        <planeGeometry args={[width + 1.2, height + 1.2]} />
        <meshStandardMaterial color="#d9ddd9" roughness={0.92} />
      </mesh>

      {[2, 5, 8, 11, 14, 17].map((row) => (
        <mesh key={`lane-${row}`} rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0.005, row + 0.5]}>
          <planeGeometry args={[width - 1.4, 0.04]} />
          <meshBasicMaterial color="#f2b443" transparent opacity={0.9} />
        </mesh>
      ))}

      {[2, 6, 10, 14, 18].map((col) => (
        <mesh key={`lane-v-${col}`} rotation={[-Math.PI / 2, 0, 0]} position={[col + 0.5, 0.005, height / 2]}>
          <planeGeometry args={[0.04, height - 1.4]} />
          <meshBasicMaterial color="#f2b443" transparent opacity={0.7} />
        </mesh>
      ))}

      {[3, 9, 15].map((z, idx) => (
        <group key={`column-${idx}`} position={[0.8 + idx * 6.2, 0, z + 0.4]}>
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[0.28, 2.2, 0.28]} />
            <meshStandardMaterial color="#c5ccd3" roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.42, 0.2, 0.42]} />
            <meshStandardMaterial color="#9aa3ad" roughness={0.85} />
          </mesh>
        </group>
      ))}

      {walls
        .filter(([x, y]) => y !== height - 1)
        .map(([x, y], i) => (
          <mesh key={`wall-${i}`} position={[x + 0.5, 1.05, y + 0.5]}>
            <boxGeometry args={[0.98, 2.1, 0.98]} />
            <meshStandardMaterial color="#cfd6de" roughness={0.85} />
          </mesh>
        ))}

      {shelves.map(([x, y], i) => (
        <group key={`shelf-${i}`} position={[x + 0.5, 0, y + 0.5]}>
          {[-0.38, 0.38].map((sx) =>
            [-0.38, 0.38].map((sz) => (
              <mesh key={`${sx}-${sz}`} position={[sx, shelfHeight / 2, sz]}>
                <boxGeometry args={[0.05, shelfHeight, 0.05]} />
                <meshStandardMaterial color="#4f678a" transparent opacity={shelfOpacity} />
              </mesh>
            ))
          )}

          <mesh position={[0, 0.48, 0]}>
            <boxGeometry args={[0.82, 0.03, 0.82]} />
            <meshStandardMaterial color="#7f8fa1" transparent opacity={shelfOpacity} />
          </mesh>

          {showUpperShelf && (
            <mesh position={[0, 1.14, 0]}>
              <boxGeometry args={[0.82, 0.03, 0.82]} />
              <meshStandardMaterial color="#7f8fa1" transparent opacity={shelfOpacity} />
            </mesh>
          )}

          {[[-0.2, 0.65, -0.15], [0.16, 0.64, 0.08], [0.05, showUpperShelf ? 1.3 : 0.7, -0.1]].map(([bx, by, bz], idx) => (
            <mesh key={idx} position={[bx, by, bz]}>
              <boxGeometry args={[0.24, 0.22, 0.25]} />
              <meshStandardMaterial color={idx === 1 ? '#bb9166' : '#caa17a'} roughness={0.8} transparent opacity={shelfOpacity} />
            </mesh>
          ))}
        </group>
      ))}

      {pickups.map(([x, y], idx) => {
        const cargo = pickupCargo.filter((item) => item.pickup[0] === x && item.pickup[1] === y).slice(0, 3)
        return (
          <group key={`pickup-${idx}`} position={[x + 0.5, 0, y + 0.5]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <planeGeometry args={[0.94, 0.94]} />
              <meshBasicMaterial color="#f9cf7a" opacity={0.35} transparent />
            </mesh>
            <mesh position={[0, 0.16, 0]}>
              <boxGeometry args={[0.9, 0.08, 0.9]} />
              <meshStandardMaterial color="#8a949e" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.26, -0.34]}>
              <boxGeometry args={[0.9, 0.04, 0.06]} />
              <meshStandardMaterial color="#f2b443" roughness={0.5} />
            </mesh>

            {cargo.map((item, itemIdx) => (
              <group key={item.taskId} position={[-0.22 + itemIdx * 0.22, 0.2, 0.16 - itemIdx * 0.16]}>
                <CargoBox taskId={item.taskId} scale={0.32} />
              </group>
            ))}

            <Html position={[0, 0.95, 0]} center distanceFactor={18}>
              <LayoutMarker text="RECEIVING" subtitle={`R-${idx + 1} (${x},${y})`} tone="amber" />
            </Html>
          </group>
        )
      })}

      {dropoffs.map(([x, y], idx) => {
        const delivered = deliveredCargo.filter((item) => item.dropoff[0] === x && item.dropoff[1] === y).slice(-4)
        return (
          <group key={`dropoff-${idx}`} position={[x + 0.5, 0, y + 0.5]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <planeGeometry args={[0.94, 0.94]} />
              <meshBasicMaterial color="#b8d8bc" opacity={0.34} transparent />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[0.92, 0.16, 0.92]} />
              <meshStandardMaterial color="#8092a4" roughness={0.7} />
            </mesh>

            {delivered.map((item, itemIdx) => {
              const row = Math.floor(itemIdx / 2)
              const col = itemIdx % 2
              return (
                <group key={item.taskId} position={[-0.16 + col * 0.28, 0.28 + row * 0.16, -0.12 + col * 0.16]}>
                  <CargoBox taskId={item.taskId} scale={0.26} />
                </group>
              )
            })}

            <Html position={[0, 0.95, 0]} center distanceFactor={18}>
              <LayoutMarker text="DISPATCH" subtitle={`D-${idx + 1} (${x},${y})`} tone="green" />
            </Html>
          </group>
        )
      })}

      {chargers.map(([x, y], idx) => (
        <group key={`charger-${idx}`} position={[x + 0.5, 0, y + 0.5]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <ringGeometry args={[0.24, 0.42, 28]} />
            <meshBasicMaterial color="#63bf87" />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.35, 0.4, 0.18, 24]} />
            <meshStandardMaterial color="#3f4f61" roughness={0.6} />
          </mesh>
          <Html position={[0, 0.74, 0]} center distanceFactor={18}>
            <LayoutMarker text="CHARGING" subtitle={`C-${idx + 1} (${x},${y})`} tone="green" />
          </Html>
        </group>
      ))}

      {blocked.map(([bx, by], i) => (
        <BlockedAisle key={`blocked-${i}-${bx}-${by}`} position={[bx + 0.5, 0, by + 0.5]} cell={[bx, by]} />
      ))}

      {selectedRobot && destination && (
        <group>
          <mesh position={[selectedRobot.x + 0.5, 0.04, selectedRobot.y + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.24, 0.28, 28]} />
            <meshBasicMaterial color="#335f9a" transparent opacity={0.8} />
          </mesh>
          <mesh position={[destination.coordinate[0] + 0.5, 0.05, destination.coordinate[1] + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.26, 0.31, 24]} />
            <meshBasicMaterial color="#d88c29" transparent opacity={0.85} />
          </mesh>
        </group>
      )}
    </group>
  )
}
