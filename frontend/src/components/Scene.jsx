import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Object3D } from 'three'
import Warehouse from './Warehouse'
import Robots from './Robots'
import CameraController from './CameraController'
export default function Scene() {
  const lightTarget = useMemo(() => { const target = new Object3D(); target.position.set(10, 0, 10); return target }, [])
  return <Canvas shadows camera={{ position: [24, 22, 29], fov: 43, near: 0.1, far: 150 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: false }} fallback={<div className="scene-message">WebGL is unavailable. The live dashboard remains usable.</div>}>
    <color attach="background" args={['#e5ebe8']} />
    <Suspense fallback={null}>
      <ambientLight intensity={0.75} />
      <hemisphereLight args={['#ffffff', '#92a298', 0.65]} />
      <primitive object={lightTarget} />
      <directionalLight position={[5, 24, 15]} target={lightTarget} intensity={1.65} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-camera-near={1} shadow-camera-far={60} shadow-bias={-0.0004} shadow-normalBias={0.025} />
      <Warehouse /><Robots /><CameraController />
    </Suspense>
  </Canvas>
}
