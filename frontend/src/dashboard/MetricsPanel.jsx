import useStore from '../store'

export default function MetricsPanel() {
  const metrics = useStore((s) => s.metrics)
  const baselineRan = metrics.baseline_avg_ticks > 0

  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="text-sm font-semibold text-slate-900">Live mission metrics</h2>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          <p className="text-xs text-slate-500">Episode ticks</p>
          <p className="font-semibold text-slate-900">{metrics.episode_ticks}</p>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          <p className="text-xs text-slate-500">Collisions</p>
          <p className={`font-semibold ${metrics.collisions === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{metrics.collisions}</p>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          <p className="text-xs text-slate-500">Completed tasks</p>
          <p className="font-semibold text-slate-900">{metrics.tasks_completed}</p>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          <p className="text-xs text-slate-500">Average completion ticks</p>
          <p className="font-semibold text-slate-900">{metrics.avg_completion_ticks || '—'}</p>
        </div>
      </div>

      <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-2 text-xs text-slate-600">
        <p className="font-semibold text-slate-800">Baseline comparison</p>
        {baselineRan
          ? `Baseline avg: ${metrics.baseline_avg_ticks} ticks. Improvement shown only for this run: ${metrics.improvement_pct}%.`
          : 'Unrun. Trigger baseline only when you need a benchmark for this session.'}
      </div>
    </section>
  )
}
