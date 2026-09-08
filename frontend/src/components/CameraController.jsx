import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import useStore from '../store'

const PRESETS = {
  overview: { position: [11, 14, 21], target: [10, 0.8, 10] },
  orbit: { position: [11, 14, 21], target: [10, 0.8, 10] },
  topdown: { position: [10, 24, 10.05], target: [10, 0, 10] },
  receiving: { position: [16.2, 6.2, 6.3], target: [17.5, 0.4, 7] },
  dispatch: { position: [16.2, 6.2, 16.7], target: [17.5, 0.4, 16] },
}

export default function CameraController() {
  const controlsRef = useRef()
  const { camera } = useThree()

  const cameraMode = useStore((s) => s.cameraMode)
  const followRobotId = useStore((s) => s.followRobotId)
  const focusTarget = useStore((s) => s.focusTarget)
  const selectedRobotId = useStore((s) => s.selectedRobotId)
  const robots = useStore((s) => s.robots)

  const vPos = useMemo(() => new THREE.Vector3(), [])
  const vTarget = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (cameraMode === 'follow') {
      const targetId = followRobotId || selectedRobotId
      const robot = robots.find((r) => r.id === targetId)
      if (robot) {
        vPos.set(robot.x + 3.4, 4.2, robot.y + 3.8)
        vTarget.set(robot.x + 0.5, 0.9, robot.y + 0.5)
      }
    } else if (cameraMode === 'focus' && focusTarget) {
      vPos.set(focusTarget[0] + 4, 4.2, focusTarget[2] + 3.5)
      vTarget.set(focusTarget[0], focusTarget[1], focusTarget[2])
    } else {
      const preset = PRESETS[cameraMode] || PRESETS.overview
      vPos.set(...preset.position)
      vTarget.set(...preset.target)
    }

    camera.position.lerp(vPos, 0.08)
    camera.lookAt(vTarget)
    if (controlsRef.current) {
      controlsRef.current.target.lerp(vTarget, 0.18)
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      target={[10, 0.8, 10]}
      minDistance={4}
      maxDistance={42}
      maxPolarAngle={Math.PI / 2.04}
      enablePan
      enableZoom
      enableRotate
    />
  )
}
