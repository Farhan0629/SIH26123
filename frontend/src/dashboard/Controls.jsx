import { sendCommand } from '../websocket'
import useStore from '../store'

export default function Controls() {
  const setCameraMode = useStore((s) => s.setCameraMode)
  const setFollowRobot = useStore((s) => s.setFollowRobot)
  const setFocusTarget = useStore((s) => s.setFocusTarget)
  const cameraMode = useStore((s) => s.cameraMode)
  const followRobotId = useStore((s) => s.followRobotId)
  const robots = useStore((s) => s.robots)
  const warehouse = useStore((s) => s.warehouse)
  const sim = useStore((s) => s.sim)

  // Check if target aisle (4,7) or (9,4) is currently blocked
  const isAisle47Blocked = warehouse?.blocked?.some(([x, y]) => x === 4 && y === 7)
  const isAisle94Blocked = warehouse?.blocked?.some(([x, y]) => x === 9 && y === 4)
  const totalBlockedCount = warehouse?.blocked?.length || 0

  const handleFocus = (x, y) => {
    setFocusTarget([x + 0.5, 0.5, y + 0.5])
  }

  return (
    <div className="space-y-3">
      {/* ─── Prominent Blocked Aisle Hazard Alert Banner ─── */}
      {isAisle47Blocked && (
        <div className="bg-red-950/95 border-2 border-red-500 rounded-lg p-2.5 text-xs text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <div className="font-black text-red-100 tracking-wide text-[11px]">
                  AISLE AT (4,7) BLOCKED — BARRICADE ACTIVE
                </div>
                <div className="text-[10px] text-red-300">
                  REROUTING FLEET IN REAL-TIME VIA P2P A*
                </div>
              </div>
            </div>
            <button
              onClick={() => sendCommand('unblock_aisle', { x: 4, y: 7 })}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-black rounded text-[10px] shadow cursor-pointer uppercase tracking-wider transition border border-red-300"
            >
              Clear
            </button>
          </div>
          <button
            onClick={() => handleFocus(4, 7)}
            className="w-full py-1 bg-amber-500 hover:bg-amber-400 text-black font-black rounded text-[10px] shadow flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <span>🎯</span>
            <span>Focus 3D Camera on Barricade (4,7)</span>
          </button>
        </div>
      )}

      {/* ─── Primary Simulation Actions ─── */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => sendCommand('start')}
          className={`px-3 py-2 rounded text-xs font-bold transition cursor-pointer shadow flex items-center justify-center gap-1.5 ${
            sim.running && !sim.paused
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
              : 'bg-emerald-700 hover:bg-emerald-600 text-white'
          }`}
        >
          <span>▶</span> Start
        </button>
        <button
          onClick={() => sendCommand('pause')}
          className={`px-3 py-2 rounded text-xs font-bold transition cursor-pointer shadow flex items-center justify-center gap-1.5 ${
            sim.paused
              ? 'bg-yellow-500 text-black ring-2 ring-yellow-300'
              : 'bg-yellow-600 hover:bg-yellow-500 text-white'
          }`}
        >
          <span>⏸</span> {sim.paused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={() => sendCommand('run_baseline')}
          className="px-3 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded text-xs font-bold transition cursor-pointer shadow flex items-center justify-center gap-1.5"
        >
          <span>📊</span> Baseline
        </button>
      </div>

      {/* ─── Speed Multipliers ─── */}
      <div className="flex items-center gap-2 bg-gray-800/80 px-2.5 py-1.5 rounded-lg border border-gray-700/50">
        <span className="text-[11px] text-gray-400 font-medium">Speed:</span>
        <div className="flex-1 flex gap-1">
          {[0.5, 1, 2, 5].map((speed) => {
            const isActive = sim.speed === speed
            return (
              <button
                key={speed}
                onClick={() => sendCommand('speed', { value: speed })}
                className={`flex-1 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-cyan-600 text-white shadow'
                    : 'bg-gray-700/70 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {speed}x
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── Unmissable Obstacle Scenario Injection ─── */}
      <div className="bg-gray-800/80 rounded-lg p-2.5 border border-gray-700/50 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
            <span>🚧</span> Dynamic Obstacle Injection
          </span>
          {totalBlockedCount > 0 && (
            <span className="text-[10px] font-mono text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800">
              {totalBlockedCount} blocked
            </span>
          )}
        </div>

        {/* Primary Aisle (4,7) */}
        <div className="space-y-1.5">
          {isAisle47Blocked ? (
            <div className="flex gap-1.5">
              <button
                onClick={() => sendCommand('unblock_aisle', { x: 4, y: 7 })}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-black shadow-[0_0_15px_rgba(239,68,68,0.8)] border border-red-400 transition cursor-pointer flex items-center justify-center gap-2 animate-pulse"
              >
                <span>⛔</span>
                <span>ACTIVE — CLICK TO UNBLOCK (4,7)</span>
              </button>
              <button
                onClick={() => handleFocus(4, 7)}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow transition cursor-pointer flex items-center gap-1"
                title="Focus Camera on (4,7)"
              >
                <span>🎯 Focus</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                sendCommand('block_aisle', { x: 4, y: 7 })
                handleFocus(4, 7)
              }}
              className="w-full py-2 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white rounded-lg text-xs font-bold shadow transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🚧</span>
              <span>BLOCK AISLE AT (4,7) [TEST REROUTING]</span>
            </button>
          )}

          {/* Secondary Choke Point Aisle (9,4) */}
          {isAisle94Blocked ? (
            <div className="flex gap-1.5">
              <button
                onClick={() => sendCommand('unblock_aisle', { x: 9, y: 4 })}
                className="flex-1 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded text-[11px] font-bold border border-red-400 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>⛔</span>
                <span>ACTIVE — UNBLOCK CHOKE POINT (9,4)</span>
              </button>
              <button
                onClick={() => handleFocus(9, 4)}
                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold transition cursor-pointer"
                title="Focus Camera on (9,4)"
              >
                <span>🎯</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                sendCommand('block_aisle', { x: 9, y: 4 })
                handleFocus(9, 4)
              }}
              className="w-full py-1.5 bg-gray-750 hover:bg-gray-700 text-gray-300 rounded text-[11px] font-medium border border-gray-600/60 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🚧</span>
              <span>Block Secondary Choke Point (9,4)</span>
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-400 leading-tight">
          💡 Click Block to deploy a 3D physical barricade & 4m beacon. AMRs will detect it via P2P mesh and recalculate A* routes live.
        </p>
      </div>

      {/* ─── Camera Perspective Modes ─── */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setCameraMode('orbit')}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition cursor-pointer border ${
            cameraMode === 'orbit'
              ? 'bg-cyan-700 text-white border-cyan-400 font-bold'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
          }`}
        >
          🔄 Orbit
        </button>
        <button
          onClick={() => setCameraMode('topdown')}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition cursor-pointer border ${
            cameraMode === 'topdown'
              ? 'bg-cyan-700 text-white border-cyan-400 font-bold'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
          }`}
        >
          ⬇ Top-Down
        </button>
        {robots.map((r) => {
          const isFollowing = cameraMode === 'follow' && followRobotId === r.id
          return (
            <button
              key={r.id}
              onClick={() => setFollowRobot(r.id)}
              className={`px-2 py-1.5 rounded text-xs font-medium transition cursor-pointer border ${
                isFollowing
                  ? 'bg-cyan-700 text-white border-cyan-400 font-bold'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
              }`}
            >
              R{r.id}
            </button>
          )
        })}
      </div>
    </div>
  )
}
