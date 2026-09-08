import { useEffect } from 'react'
import { connectWebSocket } from './websocket'
import useStore from './store'
import Scene from './components/Scene'
import Dashboard from './dashboard/Dashboard'

export default function App() {
  const connected = useStore((s) => s.connected)

  useEffect(() => {
    connectWebSocket()
  }, [])

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-white overflow-hidden font-sans">
      {/* 3D Viewport */}
      <div className="flex-1 relative h-full">
        <Scene />
        {!connected && (
          <div className="absolute top-4 left-4 bg-red-600 text-white font-medium px-3 py-1.5 rounded-md text-xs shadow-lg z-50 animate-pulse flex items-center gap-2">
            <span>⚠</span> Disconnected from Backend — Reconnecting...
          </div>
        )}
      </div>
      
      {/* Dashboard Panel */}
      <div className="w-[420px] h-full bg-gray-900 border-l border-gray-800 overflow-y-auto">
        <Dashboard />
      </div>
    </div>
  )
}
