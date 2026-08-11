'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/api-client'
import { ShimmerBlock } from '../components/ShimmerBlock'
import { KpiCard } from '../components/KpiCard'
import { Users, MousePointer, TrendingUp, BarChart3 } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']

export default function MarketingTab() {
  const { data, error, isLoading } = useSWR('/api/marketing', fetcher, { refreshInterval: 60000 })

  if (isLoading) return <ShimmerBlock />
  if (error) return <div className="p-6 text-red-400">Failed to load marketing data</div>
  if (!data) return <div className="p-6 text-slate-400">No marketing data available</div>

  const kpis = data.kpis || {}
  const trafficDaily = data.traffic_daily || []
  const referrers = data.referrers || []
  const utmPerformance = data.utm_performance || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Visits" value={(kpis.total_visits ?? 0).toLocaleString()} icon={<MousePointer size={20} />} color="blue" />
        <KpiCard title="Unique Visitors" value={(kpis.unique_visitors ?? 0).toLocaleString()} icon={<Users size={20} />} color="purple" />
        <KpiCard title="Signups" value={(kpis.signups ?? 0).toLocaleString()} icon={<TrendingUp size={20} />} color="green" />
        <KpiCard title="Conversion Rate" value={`${(kpis.conversion_rate ?? 0).toFixed(2)}%`} icon={<BarChart3 size={20} />} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Traffic (30 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={trafficDaily}>
              <defs>
                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
              <Area type="monotone" dataKey="visits" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTraffic)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Top Referrers</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={referrers} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label>
                {referrers.map((_: any, i: number) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">UTM Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-slate-400">
              <tr><th className="text-left p-3">Source</th><th className="text-left p-3">Medium</th><th className="text-left p-3">Visits</th><th className="text-left p-3">Signups</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {utmPerformance.length === 0 && <tr><td colSpan={4} className="p-4 text-slate-400 text-center">No UTM data</td></tr>}
              {utmPerformance.map((u: any, i: number) => (
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="p-3 text-slate-200">{u.utm_source || 'N/A'}</td>
                  <td className="p-3 text-slate-400">{u.utm_medium || 'N/A'}</td>
                  <td className="p-3 text-slate-400">{u.visits ?? 0}</td>
                  <td className="p-3 text-slate-400">{u.signups ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
