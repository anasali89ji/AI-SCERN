'use client'
import useSWR from 'swr'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { DollarSign, RefreshCw, TrendingDown } from 'lucide-react'
import { api } from '@/lib/api-client'
import KpiCard from '../components/KpiCard'
import DataTable from '../components/DataTable'
import { ShimmerCard } from '../components/ShimmerBlock'

interface RevenueData {
  kpis: { mrr: number; arr: number; churn_rate: number; avg_revenue_per_user: number }
  mrr_trend: Array<{ month: string; mrr: number }>
  by_gateway: Array<{ name: string; value: number }>
  by_plan: Array<{ plan: string; revenue: number; users: number }>
  failed_payments: Array<{ id: string; email: string; amount: number; currency: string; error: string; created_at: string; retried: boolean }>
  churn_trend: Array<{ month: string; churn_rate: number }>
}

const GW_COLORS = ['#2563eb', '#06b6d4', '#f59e0b', '#34d399']

export default function RevenueTab() {
  const { data, isLoading, error, mutate } = useSWR<RevenueData>('/revenue', (p: string) => api<RevenueData>(p), { refreshInterval: 120000 })

  const fpColumns = [
    { key: 'email',      header: 'Customer', render: (r: RevenueData['failed_payments'][0]) => <span className="text-xs font-medium text-text-primary">{r.email}</span> },
    { key: 'amount',     header: 'Amount',   render: (r: RevenueData['failed_payments'][0]) => <span className="text-xs tabular-nums">{r.currency} {r.amount.toFixed(2)}</span> },
    { key: 'error',      header: 'Reason',   render: (r: RevenueData['failed_payments'][0]) => <span className="text-xs text-rose-400">{r.error}</span> },
    { key: 'retried',    header: 'Retried',  render: (r: RevenueData['failed_payments'][0]) => <span className={`badge ${r.retried ? 'badge-active' : 'badge-inactive'}`}>{r.retried ? 'Yes' : 'No'}</span> },
    { key: 'created_at', header: 'Date',     render: (r: RevenueData['failed_payments'][0]) => <span className="text-xs text-text-muted">{new Date(r.created_at).toLocaleDateString()}</span> },
  ]

  if (isLoading) return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array(4).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div>
    </div>
  )
  if (error) return <div className="text-center py-16 text-sm text-rose-400">Failed to load revenue data</div>

  const k = data?.kpis ?? { mrr: 0, arr: 0, churn_rate: 0, avg_revenue_per_user: 0 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" /> Revenue
        </h2>
        <button onClick={() => mutate()} aria-label="Refresh" className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="MRR"          value={`$${k.mrr.toLocaleString()}`}                  color="#2563eb" />
        <KpiCard label="ARR"          value={`$${k.arr.toLocaleString()}`}                  color="#06b6d4" />
        <KpiCard label="Churn Rate"   value={`${k.churn_rate.toFixed(1)}%`}                 color="#f87171" />
        <KpiCard label="ARPU"         value={`$${k.avg_revenue_per_user.toFixed(2)}`}       color="#f59e0b" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="text-sm font-bold text-text-primary mb-4">MRR Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data?.mrr_trend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={45} tickFormatter={(v: number) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }}
                formatter={(v: number) => [`$${v.toLocaleString()}`, 'MRR']} />
              <Line type="monotone" dataKey="mrr" stroke="#2563eb" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-bold text-text-primary mb-4">Revenue by Gateway</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data?.by_gateway ?? []} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name"
                label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {(data?.by_gateway ?? []).map((_, i) => <Cell key={i} fill={GW_COLORS[i % GW_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }}
                formatter={(v: number) => [`$${v.toLocaleString()}`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-bold text-text-primary mb-4">Revenue by Plan</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data?.by_plan ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="plan" tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
            <Tooltip contentStyle={{ background: '#0f0f17', border: '1px solid #1c1c2e', borderRadius: 10, fontSize: 11 }} />
            <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} name="Revenue" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-rose-400" /> Failed Payments
        </h3>
        <DataTable columns={fpColumns} data={data?.failed_payments ?? []} keyFn={r => r.id} caption="Failed payments table" emptyMessage="No failed payments" />
      </div>
    </div>
  )
}
