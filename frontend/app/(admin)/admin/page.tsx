'use client'
import { StatCard } from '@/components/dashboard/StatCard'
import { RoleGuard } from '@/components/dashboard/RoleGuard'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'
import { Scan, Users, DollarSign, Ticket } from 'lucide-react'

const COLORS = { primary:'#0ea5e9', secondary:'#6366f1', success:'#10b981', warning:'#f59e0b', danger:'#ef4444', muted:'#94a3b8' }

const scanTrend   = [{ d:'Mon',v:1240},{ d:'Tue',v:1890},{ d:'Wed',v:2100},{ d:'Thu',v:1760},{ d:'Fri',v:2340},{ d:'Sat',v:980},{ d:'Sun',v:1120}]
const signupBars  = Array.from({length:30},(_,i)=>({ d:`${i+1}`,v:Math.floor(Math.random()*80+20)}))
const radarData   = [{m:'Text',acc:94},{m:'Image',acc:97},{m:'Audio',acc:91},{m:'Video',acc:88}]

export default function AdminOverview() {
  return (
    <RoleGuard required="MANAGER">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-text-primary">Dashboard Overview</h1>
          <p className="text-text-muted text-sm mt-1">Live metrics across Aiscern platform</p>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Total Scans Today"     value="14,280"  delta="12% " positive icon={Scan}       color={COLORS.primary}   />
          <StatCard title="Active Users"          value="3,941"   delta="8%"   positive icon={Users}      color={COLORS.secondary} />
          <StatCard title="MRR"                   value="$4,820"  delta="5%"   positive icon={DollarSign} color={COLORS.success} blurred={false} />
          <StatCard title="Open Support Tickets"  value="17"      delta="3"    positive={false} icon={Ticket} color={COLORS.warning} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">7-Day Scan Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={scanTrend}>
                <XAxis dataKey="d" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:12}} />
                <Line type="monotone" dataKey="v" stroke={COLORS.primary} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">Accuracy by Modality</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#2a2a3e" />
                <PolarAngleAxis dataKey="m" tick={{fontSize:11,fill:'#94a3b8'}} />
                <Radar dataKey="acc" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <h3 className="text-sm font-bold text-text-primary mb-4">30-Day Signups</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={signupBars}>
              <XAxis dataKey="d" tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:12}} />
              <Bar dataKey="v" fill={COLORS.secondary} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </RoleGuard>
  )
}
