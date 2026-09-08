import { Canvas } from '@react-three/fiber'
import Warehouse from './Warehouse'
import Robots from './Robots'
import CameraController from './CameraController'

export default function Scene() {
  return (
    <Canvas
      camera={{ position: [10, 16, 22], fov: 50, near: 0.1, far: 200 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: 'default' }}
      frameloop="always"
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={0.9} />
      <color attach="background" args={['#1a1a2e']} />
      <gridHelper args={[20, 20, '#444455', '#2a2a35']} position={[10, 0.01, 10]} />
      <Warehouse />
      <Robots />
      <CameraController />
    </Canvas>
  )
}
