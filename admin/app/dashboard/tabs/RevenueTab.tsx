'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/api-client'
import { KpiCard } from '../components/KpiCard'
import { ShimmerBlock } from '../components/ShimmerBlock'
import { DollarSign, TrendingUp, Users, Repeat } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar
} from 'recharts'

export default function RevenueTab() {
  const { data, error, isLoading } = useSWR('/api/revenue', fetcher, { refreshInterval: 60000 })

  if (isLoading) return <ShimmerBlock />
  if (error) return <div className="p-6 text-red-400">Failed to load revenue data</div>
  if (!data) return <div className="p-6 text-slate-400">No revenue data available</div>

  const kpis = data.kpis || {}
  const mrrTrend = data.mrr_trend || []
  const byPlan = data.by_plan || []
  const forecast = data.forecast || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="MRR" value={`$${(kpis.mrr ?? 0).toLocaleString()}`} icon={<DollarSign size={20} />} color="green" />
        <KpiCard title="ARR" value={`$${(kpis.arr ?? 0).toLocaleString()}`} icon={<TrendingUp size={20} />} color="blue" />
        <KpiCard title="Churn Rate" value={`${kpis.churn_rate ?? 0}%`} icon={<Repeat size={20} />} color="red" />
        <KpiCard title="ARPU" value={`$${(kpis.avg_revenue_per_user ?? 0).toFixed(2)}`} icon={<Users size={20} />} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">MRR Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={mrrTrend}>
              <defs>
                <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
              <Area type="monotone" dataKey="mrr" stroke="#10b981" fillOpacity={1} fill="url(#colorMrr)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Revenue by Plan</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byPlan}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="plan" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Revenue Forecast</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={forecast}>
            <defs>
              <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
            <Area type="monotone" dataKey="mrr" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorForecast)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
