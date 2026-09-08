import { useState, useMemo } from 'react'
import useStore from '../store'

const TYPE_CONFIG = {
  pickup: { icon: '📦', badge: 'PICKUP', color: 'text-emerald-400 bg-emerald-950/80 border-emerald-500/40' },
  delivery: { icon: '✅', badge: 'DELIVERED', color: 'text-cyan-400 bg-cyan-950/80 border-cyan-500/40' },
  yield: { icon: '⚠️', badge: 'YIELD', color: 'text-amber-400 bg-amber-950/80 border-amber-500/40' },
  reroute: { icon: '🔄', badge: 'REROUTE', color: 'text-purple-400 bg-purple-950/80 border-purple-500/40' },
  hazard: { icon: '🚧', badge: 'HAZARD', color: 'text-rose-400 bg-rose-950/80 border-rose-500/40' },
  charging: { icon: '⚡', badge: 'CHARGE', color: 'text-yellow-400 bg-yellow-950/80 border-yellow-500/40' },
  auction: { icon: '🏷️', badge: 'AUCTION', color: 'text-indigo-400 bg-indigo-950/80 border-indigo-500/40' },
  system: { icon: 'ℹ️', badge: 'SYSTEM', color: 'text-blue-400 bg-blue-950/80 border-blue-500/40' },
}

export default function EventLog() {
  const events = useStore((s) => s.events) || []
  const [filter, setFilter] = useState('all')

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events
    if (filter === 'cargo') return events.filter((e) => e.type === 'pickup' || e.type === 'delivery')
    if (filter === 'decisions') return events.filter((e) => e.type === 'yield' || e.type === 'reroute' || e.type === 'auction')
    if (filter === 'hazards') return events.filter((e) => e.type === 'hazard')
    return events
  }, [events, filter])

  // Display latest events first
  const displayEvents = useMemo(() => {
    return [...filteredEvents].reverse().slice(0, 35)
  }, [filteredEvents])

  return (
    <div className="bg-gray-800/90 rounded-lg p-3 border border-gray-700/50 shadow-md space-y-2">
      {/* Header with Event Count & Filter Tabs */}
      <div className="flex items-center justify-between border-b border-gray-700/50 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-cyan-400 text-sm">📡</span>
          <h2 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
            Live Fleet Action & Decision Log
          </h2>
        </div>
        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
          {events.length} events
        </span>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-1 text-[10px]">
        {[
          { id: 'all', label: 'All' },
          { id: 'decisions', label: '🧠 Decisions' },
          { id: 'cargo', label: '📦 Cargo' },
          { id: 'hazards', label: '⚠️ Hazards' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
              filter === tab.id
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'bg-gray-900/60 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Event Scroll Container */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600">
        {displayEvents.length > 0 ? (
          displayEvents.map((evt) => {
            const conf = TYPE_CONFIG[evt.type] || TYPE_CONFIG.system
            return (
              <div
                key={evt.id}
                className="text-[11px] p-1.5 rounded bg-gray-900/80 border border-gray-800 hover:border-gray-700 transition flex items-start gap-2 leading-tight"
              >
                {/* Timestamp */}
                <span className="font-mono text-[10px] text-gray-400 whitespace-nowrap pt-0.5">
                  [{evt.time}]
                </span>

                {/* Event Type Badge */}
                <span
                  className={`text-[9px] font-bold px-1 py-0.2 rounded border uppercase tracking-wider whitespace-nowrap ${conf.color}`}
                >
                  {conf.icon} {conf.badge}
                </span>

                {/* Event Message */}
                <span className="text-gray-200 flex-1 font-sans text-[11px]">
                  {evt.text}
                </span>
              </div>
            )
          })
        ) : (
          <div className="text-center py-4 text-gray-500 text-xs italic">
            Waiting for fleet activity... (Press ▶ Start)
          </div>
        )}
      </div>
    </div>
  )
}
