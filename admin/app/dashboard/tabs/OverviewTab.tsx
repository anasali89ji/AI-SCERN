'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/api-client'
import { KpiCard } from '../components/KpiCard'
import { ShimmerBlock } from '../components/ShimmerBlock'
import { ErrorBoundary } from '../components/ErrorBoundary'
import {
  Users, ScanLine, CreditCard, Ban, Activity, TrendingUp,
  PieChart, BarChart3, Calendar
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1']

export default function OverviewTab() {
  const { data, error, isLoading } = useSWR('/api/analytics?period=7d', fetcher, { refreshInterval: 30000 })

  if (isLoading) return <ShimmerBlock />
  if (error) return <div className="p-6 text-red-400">Failed to load analytics</div>
  if (!data) return <div className="p-6 text-slate-400">No data available</div>

  const kpis = data.kpis || {}
  const dailyScans = data.dailyScans || []
  const planDistribution = data.planDistribution || []
  const verdictDistribution = data.verdictDistribution || []
  const toolUsage = data.toolUsage || []
  const dailyUsers = data.dailyUsers || []

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Users" value={kpis.totalUsers ?? 0} icon={<Users size={20} />} color="blue" />
          <KpiCard title="Total Scans" value={kpis.totalScans ?? 0} icon={<ScanLine size={20} />} color="purple" />
          <KpiCard title="Active Users (7d)" value={kpis.activeUsers ?? 0} icon={<Activity size={20} />} color="green" />
          <KpiCard title="Paid Users" value={kpis.paidUsers ?? 0} icon={<CreditCard size={20} />} color="amber" />
          <KpiCard title="Banned Users" value={kpis.bannedUsers ?? 0} icon={<Ban size={20} />} color="red" />
          <KpiCard title="New Today" value={kpis.newToday ?? 0} icon={<Calendar size={20} />} color="indigo" />
          <KpiCard title="Inactive Users" value={kpis.inactiveUsers ?? 0} icon={<TrendingUp size={20} />} color="slate" />
          <KpiCard title="Admin Granted" value={kpis.adminGranted ?? 0} icon={<Users size={20} />} color="cyan" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <BarChart3 size={18} /> Daily Scans
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={dailyScans}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <PieChart size={18} /> Plan Distribution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <RePieChart>
                <Pie data={planDistribution} cx="50%" cy="50%" outerRadius={80} dataKey="count" nameKey="plan" label>
                  {planDistribution.map((_: any, i: number) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <BarChart3 size={18} /> Verdict Distribution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={verdictDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="verdict" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <BarChart3 size={18} /> Tool Usage
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={toolUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="tool" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily New Users */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <TrendingUp size={18} /> Daily New Users
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyUsers}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
              <Area type="monotone" dataKey="new_users" stroke="#10b981" fillOpacity={1} fill="url(#colorUsers)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ErrorBoundary>
  )
}
