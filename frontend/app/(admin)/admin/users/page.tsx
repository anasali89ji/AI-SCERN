'use client'
import { RoleGuard } from '@/components/dashboard/RoleGuard'
import { StatCard }  from '@/components/dashboard/StatCard'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, UserPlus, TrendingUp, Activity } from 'lucide-react'

const C = { primary:'#0ea5e9', secondary:'#6366f1', success:'#10b981', warning:'#f59e0b' }
const dauMau = Array.from({length:30},(_,i)=>({d:`${i+1}`,dau:Math.floor(Math.random()*400+200),mau:Math.floor(Math.random()*200+3500)}))
const planPie= [{name:'Free',v:82},{name:'Pro',v:16},{name:'Enterprise',v:2}]
const COLORS  = [C.primary,C.secondary,C.success]
const cohort  = ['Jan','Feb','Mar'].map(m=>({m,w1:100,w2:Math.floor(Math.random()*30+55),w4:Math.floor(Math.random()*20+35),w8:Math.floor(Math.random()*15+20)}))

export default function UserGrowth() {
  return (
    <RoleGuard required="MANAGER">
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-text-primary">User Growth</h1>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="New Today"     value="148"    delta="22%" positive icon={UserPlus}   color={C.primary}   />
          <StatCard title="Total Users"   value="12,841" delta="8%"  positive icon={Users}      color={C.secondary} />
          <StatCard title="DAU"           value="3,941"  delta="5%"  positive icon={Activity}   color={C.success}   />
          <StatCard title="DAU/MAU Ratio" value="31.2%"  delta="2%"  positive icon={TrendingUp} color={C.warning}   />
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">DAU vs MAU (30 days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dauMau}>
                <XAxis dataKey="d" tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:11}} />
                <Line type="monotone" dataKey="dau" stroke={C.primary}   strokeWidth={2} dot={false} name="DAU" />
                <Line type="monotone" dataKey="mau" stroke={C.secondary} strokeWidth={2} dot={false} name="MAU" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">Free vs Pro</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={planPie} dataKey="v" cx="50%" cy="50%" outerRadius={65} label={({name,v})=>`${name} ${v}%`} labelLine={false}>
                  {planPie.map((_,i)=><Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:11}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface/60 p-5 overflow-x-auto">
          <h3 className="text-sm font-bold text-text-primary mb-4">Retention Cohorts</h3>
          <table className="w-full min-w-[400px] text-sm">
            <thead><tr className="border-b border-border text-text-muted text-xs">
              <th className="text-left py-2 px-3 font-medium">Cohort</th>
              <th className="text-center py-2 px-3">Week 1</th>
              <th className="text-center py-2 px-3">Week 2</th>
              <th className="text-center py-2 px-3">Week 4</th>
              <th className="text-center py-2 px-3">Week 8</th>
            </tr></thead>
            <tbody>
              {cohort.map(r=>(
                <tr key={r.m} className="border-b border-border/40">
                  <td className="py-2 px-3 font-medium text-text-primary">{r.m} 2026</td>
                  {[r.w1,r.w2,r.w4,r.w8].map((v,i)=>(
                    <td key={i} className="py-2 px-3 text-center">
                      <span className="px-2 py-1 rounded text-xs font-semibold" style={{background:`rgba(16,185,129,${v/120})`,color:'#10b981'}}>{v}%</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </RoleGuard>
  )
}
