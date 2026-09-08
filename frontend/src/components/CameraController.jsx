import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import useStore from '../store'

export default function CameraController() {
  const controlsRef = useRef()
  const { camera } = useThree()
  const cameraMode = useStore((s) => s.cameraMode)
  const followRobotId = useStore((s) => s.followRobotId)
  const focusTarget = useStore((s) => s.focusTarget)
  const robots = useStore((s) => s.robots)
  
  useFrame(() => {
    if (cameraMode === 'topdown') {
      camera.position.lerp(new THREE.Vector3(10, 25, 10.05), 0.05)
      camera.lookAt(10, 0, 10)
    } else if (cameraMode === 'follow' && followRobotId) {
      const robot = robots.find((r) => r.id === followRobotId)
      if (robot) {
        const tx = robot.x + 0.5
        const tz = robot.y + 0.5
        camera.position.lerp(new THREE.Vector3(tx + 4, 6, tz + 4), 0.05)
        camera.lookAt(tx, 0.3, tz)
      }
    } else if (cameraMode === 'focus' && focusTarget) {
      const [fx, fy, fz] = focusTarget
      camera.position.lerp(new THREE.Vector3(fx, 4.5, fz + 4.2), 0.06)
      camera.lookAt(fx, fy + 0.4, fz)
    }
  })
  
  return (
    <>
      {(cameraMode === 'orbit' || cameraMode === 'focus') && (
        <OrbitControls
          ref={controlsRef}
          target={cameraMode === 'focus' && focusTarget ? focusTarget : [10, 0, 10]}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={3}
          maxDistance={45}
        />
      )}
    </>
  )
}
