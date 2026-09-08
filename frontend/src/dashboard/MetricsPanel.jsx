import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import useStore from '../store'

export default function MetricsPanel() {
  const metrics = useStore((s) => s.metrics)
  
  const chartData = [
    {
      name: 'Baseline',
      ticks: metrics.baseline_avg_ticks,
      color: '#ef4444',
    },
    {
      name: 'Edge-AI',
      ticks: metrics.avg_completion_ticks,
      color: '#22c55e',
    },
  ]
  
  return (
    <div className="bg-gray-800/90 rounded p-3 space-y-3 border border-gray-700/50 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
        <span>📊</span> Performance Metrics
      </h2>
      
      {/* Collision counter */}
      <div className="flex items-center justify-between bg-gray-900/80 px-3 py-2 rounded border border-gray-700/40">
        <div>
          <span className="text-gray-400 text-xs block font-medium">Total Collisions</span>
          <span className="text-[10px] text-gray-500">Zero collision guarantee</span>
        </div>
        <span
          className={`text-2xl font-bold font-mono ${
            metrics.collisions === 0 ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {metrics.collisions}
        </span>
      </div>
      
      {/* Tasks completed */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-gray-400">Tasks Completed</span>
        <span className="text-cyan-400 font-bold font-mono text-sm">{metrics.tasks_completed}</span>
      </div>
      
      {/* Comparison section with Recharts */}
      {metrics.baseline_avg_ticks > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-700/50">
          <p className="text-[10px] text-gray-400 font-medium">Workload Completion Time (ticks)</p>
          
          <div className="h-32 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '6px', fontSize: '11px' }}
                  itemStyle={{ color: '#f3f4f6' }}
                  formatter={(value) => [`${value} ticks`, 'Completion']}
                />
                <Bar dataKey="ticks" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Improvement badge */}
          <div
            className={`p-2 rounded text-center text-xs font-bold ${
              metrics.improvement_pct >= 20
                ? 'bg-green-950/70 text-green-400 border border-green-700/50'
                : 'bg-yellow-950/70 text-yellow-400 border border-yellow-700/50'
            }`}
          >
            {metrics.improvement_pct >= 0 ? '⚡ ' : '⚠️ '}
            {metrics.improvement_pct}% Improvement {metrics.improvement_pct >= 20 ? '✅ Target Met (>20%)' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
