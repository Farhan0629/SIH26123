import { sendCommand } from '../websocket'
import useStore from '../store'

const BUTTON = 'min-h-11 rounded-md border px-3 text-sm font-medium transition'

export default function Controls() {
  const connected = useStore((s) => s.connected)
  const sim = useStore((s) => s.sim)
  const cameraMode = useStore((s) => s.cameraMode)
  const setCameraMode = useStore((s) => s.setCameraMode)
  const showRoutes = useStore((s) => s.showRoutes)
  const showP2P = useStore((s) => s.showP2P)
  const setShowRoutes = useStore((s) => s.setShowRoutes)
  const setShowP2P = useStore((s) => s.setShowP2P)
  const shelfView = useStore((s) => s.shelfView)
  const setShelfView = useStore((s) => s.setShelfView)

  const sendSafe = (action, params) => {
    if (!connected) return
    sendCommand(action, params)
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="text-sm font-semibold text-slate-900">Demonstration controls</h2>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!connected}
          onClick={() => sendSafe('start')}
          className={`${BUTTON} ${sim.running && !sim.paused ? 'border-emerald-400 bg-emerald-600 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Start demonstration
        </button>
        <button
          type="button"
          disabled={!connected || !sim.running}
          onClick={() => sendSafe('pause')}
          className={`${BUTTON} border-slate-300 bg-slate-50 text-slate-900 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {sim.paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Playback speed</p>
        <div className="grid grid-cols-4 gap-2">
          {[0.25, 0.5, 1, 2].map((speed) => (
            <button
              key={speed}
              type="button"
              disabled={!connected}
              onClick={() => sendSafe('speed', { value: speed })}
              className={`${BUTTON} ${sim.speed === speed ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-300 bg-slate-50 text-slate-800'} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Camera presets</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['overview', 'Overview'],
            ['topdown', 'Top-down'],
            ['follow', 'Follow selected'],
            ['receiving', 'Receiving'],
            ['dispatch', 'Dispatch'],
            ['orbit', 'Manual orbit'],
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setCameraMode(mode)}
              className={`${BUTTON} ${cameraMode === mode ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-slate-50 text-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visibility</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['solid', 'Full racks'],
            ['xray', 'X-ray racks'],
            ['lowRack', 'Low-rack'],
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setShelfView(mode)}
              className={`${BUTTON} ${shelfView === mode ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-slate-50 text-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setShowRoutes(!showRoutes)}
          className={`${BUTTON} ${showRoutes ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-slate-50 text-slate-800'}`}
        >
          {showRoutes ? 'Hide routes' : 'Show routes'}
        </button>
        <button
          type="button"
          onClick={() => setShowP2P(!showP2P)}
          className={`${BUTTON} ${showP2P ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-slate-50 text-slate-800'}`}
        >
          {showP2P ? 'Hide P2P' : 'Show P2P'}
        </button>
      </div>
    </section>
  )
}
