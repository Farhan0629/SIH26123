import { useMemo } from 'react'
import * as THREE from 'three'

export default function PathTrail({ path, color }) {
  const points = useMemo(() => {
    if (!path || path.length < 2) return []
    return path.map(([x, y]) => new THREE.Vector3(x + 0.5, 0.05, y + 0.5))
  }, [path])
  
  const geometry = useMemo(() => {
    if (points.length < 2) return null
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [points])
  
  if (!geometry) return null
  
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.6} linewidth={1} />
    </line>
  )
}
