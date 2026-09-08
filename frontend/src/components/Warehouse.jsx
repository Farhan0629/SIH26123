import { useLayoutEffect, useMemo, useRef } from 'react'
import { Html } from '@react-three/drei'
import { Object3D } from 'three'
import useStore from '../store'
import CargoBox from './CargoBox'
import BlockedAisle from './BlockedAisle'
import { mapCargoLifecycle } from '../utils/simulationState.js'
function Batch({ items, color, opacity = 1 }) {
  const ref = useRef()
  useLayoutEffect(() => {
    if (!ref.current) return
    const dummy = new Object3D()
    items.forEach(({ at, size }, index) => { dummy.position.set(...at); dummy.scale.set(...size); dummy.updateMatrix(); ref.current.setMatrixAt(index, dummy.matrix) })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items])
  if (!items.length) return null
  return <instancedMesh key={items.length} ref={ref} args={[null, null, items.length]} castShadow={opacity === 1} receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={color} roughness={0.7} metalness={0.15} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} /></instancedMesh>
}
function Label({ children, at, tone = '#254f82' }) {
  return <Html position={at} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}><div style={{ background: '#fffffff0', borderLeft: `4px solid ${tone}`, borderRadius: 6, padding: '6px 10px', fontSize: 14, color: '#243141', whiteSpace: 'nowrap', boxShadow: '0 2px 8px #15243812' }}>{children}</div></Html>
}
function Station({ cell, index, kind, items, handling }) {
  const [x, z] = cell
  const tone = kind === 'pickup' ? '#a56b1e' : '#297359'
  const busy = handling.some((h) => h.kind === kind && h.station[0] === x && h.station[1] === z)
  const item = kind === 'pickup' ? items[0] : items[items.length - 1]
  return <group position={[x + 0.5, 0, z + 0.5]}>
    <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.96, 0.96]} /><meshBasicMaterial color={tone} transparent opacity={0.16} depthWrite={false} /></mesh>
    <mesh position={[0.40, 0.745, 0]} receiveShadow><boxGeometry args={[0.32, 0.05, 0.7]} /><meshStandardMaterial color="#61758a" metalness={0.5} roughness={0.4} /></mesh>
    {[-0.27, 0.27].map((s) => <mesh key={s} position={[0.47, 0.36, s]}><boxGeometry args={[0.035, 0.72, 0.035]} /><meshStandardMaterial color="#8d9da9" /></mesh>)}
    <mesh position={[0.4, 0.78, -0.34]}><boxGeometry args={[0.32, 0.025, 0.025]} /><meshBasicMaterial color={tone} /></mesh>
    {!busy && item && <CargoBox taskId={item.taskId} position={[0.40, 0.91, 0]} rotation={[0, Math.PI / 2, 0]} />}
    <Label at={[0.2, 2.12, 0]} tone={tone}><strong>{kind === 'pickup' ? 'RECEIVING' : 'DISPATCH'} {index + 1}</strong><br />{busy ? 'Transfer in progress' : `${items.length} ${kind === 'pickup' ? 'waiting' : 'delivered'}`} · ({x},{z})</Label>
  </group>
}
export default function Warehouse() {
  const warehouse = useStore((s) => s.warehouse)
  const tasks = useStore((s) => s.tasks)
  const robots = useStore((s) => s.robots)
  const shelfView = useStore((s) => s.shelfView)
  const batches = useMemo(() => {
    const result = { posts: [], rails: [], decks: [], boxes: [], tape: [], walls: [], lanes: [] }
    if (!warehouse?.grid) return result
    const { grid, width, height } = warehouse
    const add = (list, at, size) => result[list].push({ at, size })
    const low = shelfView === 'lowRack'
    for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
      const cell = grid[z][x]
      if (cell === 1 && grid[z - 1]?.[x] !== 1 && grid[z]?.[x - 1] !== 1) {
        const cx = x + 1, cz = z + 1, h = low ? 0.76 : 2.15
        for (const dx of [-0.85, 0.85]) for (const dz of [-0.85, 0.85]) add('posts', [cx + dx, h / 2, cz + dz], [0.075, h, 0.075])
        for (const level of (low ? [0.24] : [0.24, 1.0, 1.76])) {
          add('decks', [cx, level, cz], [1.76, 0.035, 1.76])
          for (const dz of [-0.85, 0.85]) add('rails', [cx, level, cz + dz], [1.8, 0.09, 0.065])
          for (const dx of [-0.43, 0.43]) for (const dz of [-0.42, 0.42]) {
            add('boxes', [cx + dx, level + 0.23, cz + dz], [0.58, 0.43, 0.60])
            add('tape', [cx + dx, level + 0.448, cz + dz], [0.07, 0.008, 0.61])
          }
        }
      }
      if (cell === 2 && (x === 0 || z === 0)) add('walls', [x + 0.5, 1.35, z + 0.5], [0.98, 2.7, 0.98])
      if (cell !== 1 && cell !== 2 && x > 0 && z > 0) {
        if (grid[z - 1]?.[x] === 1) add('lanes', [x + 0.5, 0.013, z + 0.08], [0.95, 0.006, 0.035])
        if (grid[z + 1]?.[x] === 1) add('lanes', [x + 0.5, 0.013, z + 0.92], [0.95, 0.006, 0.035])
      }
    }
    return result
  }, [warehouse, shelfView])
  const cargo = useMemo(() => mapCargoLifecycle(tasks, robots), [tasks, robots])
  if (!warehouse) return null
  const { width, height } = warehouse
  const opacity = shelfView === 'xray' ? 0.18 : 1
  const handling = robots.map((r) => r.handling).filter(Boolean)
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.005, height / 2]} receiveShadow><planeGeometry args={[width + 0.8, height + 0.8]} /><meshStandardMaterial color="#d5dbd8" roughness={0.86} /></mesh>
    <gridHelper args={[20, 20, '#aebbb9', '#c0cbc7']} position={[width / 2, 0.002, height / 2]} />
    <Batch items={batches.walls} color="#ced6dc" /><Batch items={batches.posts} color="#355b83" opacity={opacity} /><Batch items={batches.rails} color="#ce8c36" opacity={opacity} /><Batch items={batches.decks} color="#8393a1" opacity={opacity} /><Batch items={batches.boxes} color="#bc956e" opacity={opacity} /><Batch items={batches.tape} color="#e0c7a5" opacity={opacity} /><Batch items={batches.lanes} color="#c69234" />
    {[5, 11, 17].map((x) => <group key={x} position={[x, 0, 0.98]}>
      <mesh position={[0, 1.27, 0.04]}><boxGeometry args={[2.5, 2.38, 0.045]} /><meshStandardMaterial color="#8696a5" roughness={0.65} /></mesh>
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[0, 0.2 + i * 0.26, 0.075]}><boxGeometry args={[2.43, 0.02, 0.02]} /><meshStandardMaterial color="#627486" /></mesh>)}
      <Label at={[0, 2.78, 0.1]}>WAREHOUSE · BAY {Math.round((x + 1) / 6)}</Label>
    </group>)}
    {(warehouse.pickups || []).map((cell, i) => <Station key={`p${i}`} cell={cell} index={i} kind="pickup" handling={handling} items={cargo.pickupCargo.filter((t) => t.pickup[0] === cell[0] && t.pickup[1] === cell[1])} />)}
    {(warehouse.dropoffs || []).map((cell, i) => <Station key={`d${i}`} cell={cell} index={i} kind="dropoff" handling={handling} items={cargo.deliveredCargo.filter((t) => t.dropoff[0] === cell[0] && t.dropoff[1] === cell[1])} />)}
    {(warehouse.chargers || []).map(([x, z], i) => <group key={`c${i}`} position={[x + 0.5, 0, z + 0.5]}><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}><ringGeometry args={[0.29, 0.41, 32]} /><meshBasicMaterial color="#338969" /></mesh><Label at={[0, 2.1, 0]} tone="#297359">CHARGING {i + 1}</Label></group>)}
    {(warehouse.blocked || []).map(([x, z]) => <BlockedAisle key={`${x}:${z}`} position={[x + 0.5, 0, z + 0.5]} cell={[x, z]} />)}
  </group>
}
