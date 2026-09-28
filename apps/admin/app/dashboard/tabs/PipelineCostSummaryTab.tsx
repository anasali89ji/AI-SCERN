'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/api-client'
import { ShimmerBlock } from '../components/ShimmerBlock'
import { KpiCard } from '../components/KpiCard'
import { DollarSign, BarChart3, AlertTriangle } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

export default function PipelineCostSummaryTab() {
  const { data, error, isLoading } = useSWR('/api/pipeline-cost-summary?days=7', fetcher, { refreshInterval: 60000 })

  if (isLoading) return <ShimmerBlock />
  if (error) return <div className="p-6 text-red-400">Failed to load cost data</div>
  if (!data) return <div className="p-6 text-slate-400">No cost data available</div>

  const daily = data.daily || []
  const fallbackFlags = data.fallback_flags || []

  const totalCalls = daily.reduce((sum: number, d: any) => sum + (d.gemini || 0) + (d.nvidia_nim || 0) + (d.huggingface || 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Total API Calls (7d)" value={totalCalls.toLocaleString()} icon={<BarChart3 size={20} />} color="blue" />
        <KpiCard title="Fallback Flags" value={fallbackFlags.length} icon={<AlertTriangle size={20} />} color="amber" />
        <KpiCard title="Daily Avg" value={daily.length > 0 ? Math.round(totalCalls / daily.length).toLocaleString() : '0'} icon={<DollarSign size={20} />} color="green" />
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Daily API Calls by Vendor</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
            <Legend />
            <Bar dataKey="gemini" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="nvidia_nim" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="huggingface" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Fallback Flags</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-slate-400">
              <tr><th className="text-left p-3">Modality</th><th className="text-left p-3">Paid Calls</th><th className="text-left p-3">Detections</th><th className="text-left p-3">Rate</th><th className="text-left p-3">Flagged</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {fallbackFlags.length === 0 && <tr><td colSpan={5} className="p-4 text-slate-400 text-center">No fallback flags</td></tr>}
              {fallbackFlags.map((f: any, i: number) => (
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="p-3 text-slate-200">{f.modality}</td>
                  <td className="p-3 text-slate-400">{f.paid_calls ?? 0}</td>
                  <td className="p-3 text-slate-400">{f.detections ?? 0}</td>
                  <td className="p-3 text-slate-400">{f.paid_call_rate ?? 0}%</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${f.flagged ? 'bg-red-400/10 text-red-400' : 'bg-green-400/10 text-green-400'}`}>{f.flagged ? 'Yes' : 'No'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
