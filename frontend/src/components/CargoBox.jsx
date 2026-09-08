import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
// Centered carton: every lifecycle stage uses the same physical dimensions.
export default function CargoBox({ taskId, position = [0, 0, 0], scale = 1, rotation = [0, 0, 0] }) {
  const label = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 160
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#faf8ee'; ctx.fillRect(0, 0, 256, 160)
    ctx.fillStyle = '#152438'; ctx.font = 'bold 32px Arial'
    ctx.fillText(`PKG-${String(taskId ?? 0).padStart(3, '0')}`, 12, 44)
    ctx.font = '18px Arial'; ctx.fillText('WAREHOUSE / HANDLE WITH CARE', 12, 70)
    for (let i = 0; i < 42; i++) ctx.fillRect(12 + i * 5.4, 85, i % 3 === 0 ? 3 : 1.5, 49)
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace
    return texture
  }, [taskId])
  useEffect(() => () => label.dispose(), [label])
  return <group position={position} rotation={rotation} scale={scale}>
    <mesh castShadow><boxGeometry args={[0.36, 0.28, 0.30]} /><meshStandardMaterial color="#c9965f" roughness={0.85} /></mesh>
    <mesh position={[0, 0.141, 0]}><boxGeometry args={[0.07, 0.004, 0.302]} /><meshStandardMaterial color="#a7743f" roughness={0.65} /></mesh>
    <mesh position={[0, 0, 0.151]}><planeGeometry args={[0.27, 0.17]} /><meshBasicMaterial map={label} /></mesh>
    <mesh position={[0.181, 0, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[0.24, 0.15]} /><meshBasicMaterial map={label} /></mesh>
  </group>
}
