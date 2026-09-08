import { useEffect, useState } from 'react'
import { connectWebSocket } from './websocket'
import useStore from './store'
import Scene from './components/Scene'
import Dashboard from './dashboard/Dashboard'

export default function App() {
  const connected = useStore((s) => s.connected)
  const connectionState = useStore((s) => s.connectionState)
  const connectionError = useStore((s) => s.connectionError)
  const setReducedMotion = useStore((s) => s.setReducedMotion)
  const [showHowToWatch, setShowHowToWatch] = useState(true)

  useEffect(() => {
    const disconnect = connectWebSocket()
    return disconnect
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReducedMotion(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [setReducedMotion])

  const connectionLabel = connected
    ? 'Connected'
    : connectionState === 'connecting'
      ? 'Connecting…'
      : connectionState === 'error'
        ? 'Connection issue'
        : 'Disconnected'

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full flex-col">
        <header className="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Simulation / digital twin</p>
              <h1 className="text-xl font-semibold text-slate-900">Warehouse Fleet Demonstrator</h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{connectionLabel}</span>
            </div>
          </div>
        </header>

        <main className="grid flex-1 grid-rows-[minmax(260px,1fr)_auto] overflow-hidden lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-1">
          <section className="relative min-h-[260px] border-b border-slate-200 lg:border-b-0 lg:border-r">
            <Scene />

            {showHowToWatch && (
              <div className="absolute left-3 top-3 z-30 max-w-[320px] rounded-lg border border-slate-300 bg-white/95 p-3 text-sm shadow">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">How to watch</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-slate-700">
                      <li>Start demonstration, then choose a robot card.</li>
                      <li>Use camera presets and shelf view toggles for visibility.</li>
                      <li>Enable routes/P2P only when needed to avoid clutter.</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss help"
                    className="min-h-11 min-w-11 rounded border border-slate-300 px-3 text-slate-600"
                    onClick={() => setShowHowToWatch(false)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {!connected && (
              <div className="absolute bottom-3 left-3 z-30 rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-sm text-amber-900 shadow">
                {connectionError || 'Live data unavailable. Waiting for backend at port 8000.'}
              </div>
            )}
          </section>

          <aside className="min-h-0 overflow-y-auto bg-[#f8fafc]">
            <Dashboard />
          </aside>
        </main>
      </div>
    </div>
  )
}
