import useStore from '../store'
export default function MetricsPanel() {
  const metrics = useStore((s) => s.metrics)
  return <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
    <h2 className="text-sm font-semibold text-slate-900">Live mission metrics</h2>
    <div className="grid grid-cols-2 gap-2 text-sm">
      {[['Episode ticks', metrics.episode_ticks], ['Collisions', metrics.collisions], ['Packages put away', metrics.packages_stored ?? 0], ['Average putaway tick', metrics.avg_completion_ticks || '—'], ['Slots now filled', metrics.tasks_completed], ['Charge runs', metrics.charge_cycles ?? 0]].map(([label, value]) => <div key={label} className="rounded border border-slate-200 bg-slate-50 p-2"><p className="text-slate-600">{label}</p><p className="font-semibold text-slate-900">{value}</p></div>)}
    </div>
    <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Demo times include the handling dwell at both ends of every putaway leg and any charge run taken mid-round, so they are deliberately slower than the headless benchmark. Use the separate benchmark for algorithm comparisons. A baseline timeout is not a completion measurement.</p>
  </section>
}
