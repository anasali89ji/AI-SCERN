'use client'
import useSWR from 'swr'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Radio, RefreshCw, Download, TrendingDown } from 'lucide-react'
import { api } from '@/lib/api-client'
import KpiCard from '../components/KpiCard'
import DataTable from '../components/DataTable'
import { ShimmerCard } from '../components/ShimmerBlock'

interface MarketingData {
  kpis: { total_visits: number; unique_visitors: number; signups: number; conversion_rate: number }
  traffic_daily: Array<{ date: string; visits: number; signups: number; unique: number }>
  utm_performance: Array<{ source: string; medium: string; campaign: string; visits: number; conversions: number; revenue: number }>
  top_referrers: Array<{ domain: string; visits: number }>
  device_breakdown: Array<{ name: string; value: number }>
  country_breakdown: Array<{ country: string; visits: number }>
  funnel: Array<{ stage: string; count: number; rate: number }>
}

const DEVICE_COLORS = ['#2563eb', '#06b6d4', '#f59e0b']

export default function MarketingTab() {
  const { data, isLoading, error, mutate } = useSWR<MarketingData>('/marketing', (p: string) => api<MarketingData>(p), { refreshInterval: 120000 })

  const exportUTM = () => {
    const rows = (data?.utm_performance ?? []).map(r =>
      `${r.source},${r.medium},${r.campaign},${r.visits},${r.conversions},${r.revenue}`
    )
    const blob = new Blob([['source,medium,campaign,visits,conversions,revenue', ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'utm-performance.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const utmColumns = [
    { key: 'source',      header: 'Source',      render: (r: MarketingData['utm_performance'][0]) => <span className="text-xs font-medium text-text-primary">{r.source}</span> },
    { key: 'medium',      header: 'Medium',      render: (r: MarketingData['utm_performance'][0]) => <span className="text-xs text-text-muted">{r.medium}</span> },
    { key: 'campaign',    header: 'Campaign',    render: (r: MarketingData['utm_performance'][0]) => <span className="text-xs text-text-muted">{r.campaign}</span> },
    { key: 'visits',      header: 'Visits',      render: (r: MarketingData['utm_performance'][0]) => r.visits.toLocaleString() },
    { key: 'conversions', header: 'Conversions', render: (r: MarketingData['utm_performance'][0]) => r.conversions.toLocaleString() },
    { key: 'conv_rate',   header: 'Conv. Rate',  render: (r: MarketingData['utm_performance'][0]) => (
      <span className="text-xs font-semibold text-emerald-400">
        {r.visits > 0 ? ((r.conversions / r.visits) * 100).toFixed(1) : 0}%
      </span>
    )},
    { key: 'revenue', header: 'Revenue', render: (r: MarketingData['utm_performance'][0]) => `$${r.revenue.toLocaleString()}` },
  ]

  if (isLoading) return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array(4).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{Array(2).fill(0).map((_, i) => <ShimmerCard key={i} h="h-52" />)}</div>
    </div>
  )

  if (error) return <div className="text-center py-16 text-sm text-rose-400">Failed to load marketing data</div>

  const k = data?.kpis ?? { total_visits: 0, unique_visitors: 0, signups: 0, conversion_rate: 0 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Radio className="w-5 h-5 text-primary" /> Marketing
        </h2>
        <button onClick={() => mutate()} aria-label="Refresh" className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Visits"      value={k.total_visits.toLocaleString()}    color="#2563eb" />
        <KpiCard label="Unique Visitors"   value={k.unique_visitors.toLocaleString()} color="#06b6d4" />
        <KpiCard label="Signups"           value={k.signups.toLocaleString()}         color="#34d399" />
        <KpiCard label="Conversion Rate"   value={`${k.conversion_rate.toFixed(1)}%`} color="#f59e0b" />
      </div>

      {/* Traffic chart */}
      <div className="card">
        <h3 className="text-sm font-bold text-text-primary mb-4">Traffic Overview (30d)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data?.traffic_daily ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} />
            <Line type="monotone" dataKey="visits"  stroke="#2563eb" strokeWidth={2} dot={false} name="Visits" />
            <Line type="monotone" dataKey="unique"  stroke="#06b6d4" strokeWidth={1.5} dot={false} name="Unique" />
            <Line type="monotone" dataKey="signups" stroke="#34d399" strokeWidth={1.5} dot={false} name="Signups" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Funnel + Device */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" /> Conversion Funnel
          </h3>
          <div className="space-y-2">
            {(data?.funnel ?? []).map((stage, i) => (
              <div key={stage.stage} className="relative">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-text-secondary font-medium">{stage.stage}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-text-primary font-bold tabular-nums">{stage.count.toLocaleString()}</span>
                    {i > 0 && <span className="text-rose-400 text-[10px]">-{stage.rate.toFixed(0)}% drop</span>}
                  </div>
                </div>
                <div className="h-2 rounded-full bg-surface-hover">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${100 - stage.rate}%`, background: 'linear-gradient(90deg, #1d4ed8, #2563eb)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-bold text-text-primary mb-4">Device Breakdown</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={data?.device_breakdown ?? []} cx="50%" cy="50%" outerRadius={65} dataKey="value" nameKey="name" label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {(data?.device_breakdown ?? []).map((_, i) => <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Referrers */}
      <div className="card">
        <h3 className="text-sm font-bold text-text-primary mb-4">Top Referrers</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data?.top_referrers ?? []} layout="vertical">
            <XAxis type="number" tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="domain" width={120} tick={{ fill: '#a0aec0', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} />
            <Bar dataKey="visits" fill="#2563eb" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* UTM Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-text-primary">UTM Performance</h3>
          <button onClick={exportUTM} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary border border-border hover:text-text-primary hover:border-primary/50 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        <DataTable
          columns={utmColumns}
          data={data?.utm_performance ?? []}
          keyFn={r => `${r.source}-${r.campaign}`}
          caption="UTM performance table"
          emptyMessage="No UTM data yet"
        />
      </div>
    </div>
  )
}
