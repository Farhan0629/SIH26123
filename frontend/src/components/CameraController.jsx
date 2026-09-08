import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import useStore from '../store'
import { chooseFollowRobot } from '../utils/presentation.js'
const PRESETS = {
  overview: [[24, 22, 29], [10, 0.7, 10]],
  topdown: [[10, 30, 10.01], [10, 0, 10]],
  receiving: [[21, 4.7, 10], [17.5, 0.9, 7.5]],
  dispatch: [[21, 4.7, 19], [17.5, 0.9, 16]],
}
export default function CameraController() {
  const controls = useRef(), settled = useRef(false)
  const { camera } = useThree()
  const mode = useStore((s) => s.cameraMode)
  const revision = useStore((s) => s.cameraRevision)
  const reduced = useStore((s) => s.reducedMotion)
  const setMode = useStore((s) => s.setCameraMode)
  const position = useMemo(() => new Vector3(), [])
  const target = useMemo(() => new Vector3(), [])
  useEffect(() => { settled.current = false }, [mode, revision])
  useFrame((_, delta) => {
    if (!controls.current || mode === 'orbit') return
    const state = useStore.getState()
    if (mode === 'follow') {
      const robot = chooseFollowRobot(state.robots, state.selectedRobotId, state.followRobotId)
      if (!robot) return
      position.set(robot.x + 3.4, 3.0, robot.y + 4.2)
      target.set(robot.x + 0.5, 1.0, robot.y + 0.5)
    } else if (mode === 'focus' && state.focusTarget) {
      target.set(...state.focusTarget)
      position.copy(target).add(new Vector3(3, 2.5, 4))
    } else {
      if (settled.current) return
      const preset = PRESETS[mode] || PRESETS.overview
      position.set(...preset[0]); target.set(...preset[1])
    }
    const alpha = reduced ? 1 : 1 - Math.exp(-7 * Math.min(delta, 0.1))
    camera.position.lerp(position, alpha)
    controls.current.target.lerp(target, alpha)
    controls.current.update()
    if (mode !== 'follow' && camera.position.distanceTo(position) < 0.015 && controls.current.target.distanceTo(target) < 0.015) settled.current = true
  })
  return <OrbitControls ref={controls} makeDefault target={[10, 0.7, 10]} minDistance={2.5} maxDistance={52} maxPolarAngle={Math.PI / 2.03} enableDamping={!reduced} dampingFactor={0.12} onStart={() => setMode('orbit')} />
}
