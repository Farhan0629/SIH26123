import useStore from '../store'
export default function MetricsPanel() {
  const metrics = useStore((s) => s.metrics)
  return <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
    <h2 className="text-sm font-semibold text-slate-900">Live mission metrics</h2>
    <div className="grid grid-cols-2 gap-2 text-sm">
      {[['Episode ticks', metrics.episode_ticks], ['Collisions', metrics.collisions], ['Dispatched packages', metrics.tasks_completed], ['Average dispatch tick', metrics.avg_completion_ticks || '—'], ['Put away in racks', metrics.packages_stored ?? 0], ['Autonomous charge runs', metrics.charge_cycles ?? 0]].map(([label, value]) => <div key={label} className="rounded border border-slate-200 bg-slate-50 p-2"><p className="text-slate-600">{label}</p><p className="font-semibold text-slate-900">{value}</p></div>)}
    </div>
    <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Demo times include handling dwell, the putaway leg into the racks and any autonomous charge run, so they are deliberately slower than the headless benchmark. Use the separate benchmark for algorithm comparisons. A baseline timeout is not a completion measurement.</p>
  </section>
}
