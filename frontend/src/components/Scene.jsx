import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import Warehouse from './Warehouse'
import Robots from './Robots'
import CameraController from './CameraController'

function SceneFallback({ message }) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-100 px-6 text-center text-sm text-slate-700">
      {message}
    </div>
  )
}

export default function Scene() {
  return (
    <Canvas
      shadows
      camera={{ position: [11, 14, 21], fov: 46, near: 0.1, far: 240 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#eef2f5')
      }}
      fallback={<SceneFallback message="WebGL unavailable on this device. Use the activity panels while the simulation keeps running." />}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.58} />
        <hemisphereLight skyColor="#f9fafb" groundColor="#cbd5e1" intensity={0.45} />
        <directionalLight
          castShadow
          position={[14, 20, 8]}
          intensity={1.1}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={60}
        />
        <directionalLight position={[2, 8, 16]} intensity={0.35} />

        <Warehouse />
        <Robots />
        <CameraController />
      </Suspense>
    </Canvas>
  )
}
