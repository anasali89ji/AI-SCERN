'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Zap, RefreshCw, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

export default function PipelineCostSummaryTab() {
  const [days, setDays] = useState(7)
  const { data, isLoading, error, mutate } = useSWR(`/pipeline-cost-summary?days=${days}`, (p: string) => api(p))
  const d = data as any

  if (error) return <div className="text-center py-10 text-sm text-rose-400">Failed to load cost data</div>
  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><Zap className="w-5 h-5 text-primary" /> Pipeline Cost Summary</h2>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${days === d ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:text-text-primary'}`}>{d}d</button>)}
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(d?.totals ?? {}).map(([vendor, counts]: [string, any]) => {
          const total = (Object.values(counts) as number[]).reduce((a: number, b: number) => a + b, 0)
          return <div key={vendor} className="card p-4"><p className="text-xl font-bold text-text-primary">{total.toLocaleString()}</p><p className="text-[11px] text-text-muted capitalize">{vendor} Calls</p></div>
        })}
      </div>
      <div className="card p-4">
        <h3 className="text-sm font-bold text-text-primary mb-4">Daily Vendor Calls</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={d?.daily ?? []}><XAxis dataKey="day" tickFormatter={v => v.slice(5)} tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={40} /><Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} /><Bar dataKey="gemini" fill="#3b82f6" radius={[4,4,0,0]} /><Bar dataKey="nvidia_nim" fill="#10b981" radius={[4,4,0,0]} /><Bar dataKey="huggingface" fill="#f59e0b" radius={[4,4,0,0]} /></BarChart>
        </ResponsiveContainer>
      </div>
      <div className="card p-4">
        <h3 className="text-sm font-bold text-text-primary mb-4">Fallback Flags</h3>
        <div className="space-y-2">{(d?.fallback_flags ?? []).map((f: any) => (
          <div key={f.modality} className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border">
            <span className="text-xs text-text-primary capitalize">{f.modality}</span>
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span>{f.paid_calls} paid calls</span>
              <span>{f.detections} detections</span>
              <span className={f.flagged ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{f.paid_call_rate ? `${f.paid_call_rate.toFixed(2)}x` : 'N/A'}</span>
              {f.flagged && <AlertTriangle className="w-4 h-4 text-rose-400" />}
            </div>
          </div>
        ))}</div>
      </div>
    </div>
  )
}
