import useStore from '../store'

const EVENT_LABELS = {
  pickup: 'Picked up',
  delivery: 'Delivered',
  yield: 'Yielded',
  reroute: 'Rerouted',
  hazard: 'Hazard',
  charging: 'Charging',
  auction: 'Auction',
  system: 'System',
}

export default function EventLog() {
  const events = useStore((s) => s.events) || []
  const rows = [...events].reverse().slice(0, 20)

  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Activity feed</h2>
        <p className="text-xs text-slate-500">{events.length} events</p>
      </div>

      <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
        {rows.length ? rows.map((event) => (
          <div key={event.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{EVENT_LABELS[event.type] || 'Update'}</span>
              <span className="font-mono text-[11px] text-slate-500">{event.time}</span>
            </div>
            <p className="mt-1 text-slate-700">{event.text}</p>
          </div>
        )) : (
          <p className="py-6 text-center text-xs text-slate-500">No events yet. Start demonstration to stream live activity.</p>
        )}
      </div>
    </section>
  )
}
