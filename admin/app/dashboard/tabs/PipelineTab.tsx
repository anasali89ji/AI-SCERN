'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/api-client'
import { ShimmerBlock } from '../components/ShimmerBlock'
import { KpiCard } from '../components/KpiCard'
import { Database, GitCommit, Cpu, Layers } from 'lucide-react'

export default function PipelineTab() {
  const { data, error, isLoading } = useSWR('/api/pipeline', fetcher, { refreshInterval: 30000 })

  if (isLoading) return <ShimmerBlock />
  if (error) return <div className="p-6 text-red-400">Failed to load pipeline data</div>
  if (!data) return <div className="p-6 text-slate-400">No pipeline data available</div>

  const pipeline = data.pipeline || {}
  const d1Buffer = data.d1_buffer || {}
  const workerStats = data.worker_stats || []
  const recentPushes = data.recent_pushes || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Total Scraped" value={pipeline.total_scraped ?? 0} icon={<Database size={20} />} color="blue" />
        <KpiCard title="Total Pushed" value={pipeline.total_pushed ?? 0} icon={<Layers size={20} />} color="green" />
        <KpiCard title="D1 Buffer" value={d1Buffer.total ?? 0} icon={<Cpu size={20} />} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Worker Stats</h3>
          <div className="space-y-3">
            {workerStats.length === 0 && <p className="text-slate-400">No worker data</p>}
            {workerStats.map((w: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Cpu size={16} className="text-blue-400" />
                  <span className="text-slate-200 font-medium">{w.worker_id || `Worker ${i + 1}`}</span>
                </div>
                <div className="flex gap-4 text-sm text-slate-400">
                  <span>Items: <span className="text-slate-200">{w.items ?? 0}</span></span>
                  <span>Avg Q: <span className="text-slate-200">{w.avg_q ?? 0}</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Recent Pushes</h3>
          <div className="space-y-3">
            {recentPushes.length === 0 && <p className="text-slate-400">No recent pushes</p>}
            {recentPushes.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <GitCommit size={16} className="text-green-400" />
                  <span className="text-slate-200 font-mono text-sm">{p.commit_id || 'N/A'}</span>
                </div>
                <div className="flex gap-4 text-sm text-slate-400">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'success' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>{p.status || 'unknown'}</span>
                  <span>{p.created_at ? new Date(p.created_at).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
