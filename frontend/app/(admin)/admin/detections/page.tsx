'use client'
import { useEffect, useState } from 'react'
import { RoleGuard } from '@/components/dashboard/RoleGuard'
import { StatCard }  from '@/components/dashboard/StatCard'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Scan, TrendingUp, Percent, Activity, AlertCircle } from 'lucide-react'

const C = { primary:'#0ea5e9', secondary:'#6366f1', success:'#10b981', warning:'#f59e0b', danger:'#ef4444', muted:'#94a3b8' }
const COLORS = [C.primary, C.secondary, C.success, C.warning, C.danger]

interface Kpis {
  total_scans_today: number
  total_scans_month: number
  total_scans_all_time: number
  active_users_today: number
  active_users_month: number
  avg_confidence: number | null
  ai_detection_rate: number | null
  avg_processing_time_ms: number | null
}

interface DetectionIntel {
  topModels: { model_used: string; count: number }[]
  confidenceDistribution: { bucket: string; count: number }[]
  mediaTypeBreakdown: { media_type: string; scans: number; avg_confidence: number | null }[]
}

export default function DetectionAnalytics() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [intel, setIntel] = useState<DetectionIntel | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const [kpiRes, intelRes] = await Promise.all([
          fetch('/api/analytics/kpis'),
          fetch('/api/analytics/detection-intelligence?days=30'),
        ])
        if (kpiRes.status === 503 || intelRes.status === 503) { setUnavailable(true); return }
        if (kpiRes.ok) setKpis(await kpiRes.json())
        if (intelRes.ok) setIntel(await intelRes.json())
      } catch {
        setUnavailable(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <RoleGuard required="ANALYST">
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-text-primary">Detection Analytics</h1>

        {unavailable && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-warning shrink-0" />
            <p className="text-sm text-text-secondary">
              MotherDuck archive isn't reachable right now — this page needs <code className="text-xs bg-black/20 px-1 rounded">MOTHERDUCK_TOKEN</code> configured
              and at least a few scans archived (scans are archived a short time after completion via the archiveScanToMotherDuck background job).
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Scans Today"  value={loading ? '—' : (kpis?.total_scans_today ?? 0).toLocaleString()}
            icon={Scan} color={C.primary} />
          <StatCard title="This Month"   value={loading ? '—' : (kpis?.total_scans_month ?? 0).toLocaleString()}
            icon={TrendingUp} color={C.secondary} />
          <StatCard title="AI Detection Rate"
            value={loading ? '—' : kpis?.ai_detection_rate != null ? `${kpis.ai_detection_rate.toFixed(1)}%` : 'N/A'}
            icon={Percent} color={C.warning} />
          <StatCard title="Avg Processing Time"
            value={loading ? '—' : kpis?.avg_processing_time_ms != null ? `${Math.round(kpis.avg_processing_time_ms)}ms` : 'N/A'}
            icon={Activity} color={C.success} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">Confidence Distribution (Last 30 Days)</h3>
            {intel?.confidenceDistribution?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={intel.confidenceDistribution}>
                  <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="count" fill={C.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-text-muted py-16 text-center">No archived scans yet in this window.</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">Media Type Breakdown</h3>
            {intel?.mediaTypeBreakdown?.length ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={intel.mediaTypeBreakdown} dataKey="scans" nameKey="media_type" cx="50%" cy="50%" outerRadius={65}
                    label={({ media_type, scans }: any) => `${media_type} ${scans}`} labelLine={false}>
                    {intel.mediaTypeBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-text-muted py-16 text-center">No data yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <h3 className="text-sm font-bold text-text-primary mb-4">Model Usage (Last 30 Days)</h3>
          {intel?.topModels?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={intel.topModels} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="model_used" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={140} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="count" fill={C.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-muted py-8 text-center">No model usage data yet.</p>
          )}
        </div>

        <p className="text-xs text-text-muted">
          Sourced from the MotherDuck long-term scan archive — active users today/month and all-time totals:{' '}
          {kpis ? `${kpis.active_users_today} today, ${kpis.active_users_month} this month, ${kpis.total_scans_all_time.toLocaleString()} scans all-time.` : 'loading…'}
        </p>
      </div>
    </RoleGuard>
  )
}
