'use client'
import { RoleGuard } from '@/components/dashboard/RoleGuard'
import { StatCard }  from '@/components/dashboard/StatCard'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { DollarSign, TrendingUp, UserMinus, ArrowUpRight } from 'lucide-react'

const C = { primary:'#0ea5e9', secondary:'#6366f1', success:'#10b981', warning:'#f59e0b', danger:'#ef4444' }
const months = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
const revenue = months.map((m,i)=>({m,mrr:2000+i*280+Math.floor(Math.random()*200),churn:Math.floor(Math.random()*300+100)}))
const funnel  = [{stage:'Visitor',v:100},{stage:'Signup',v:18},{stage:'First Scan',v:14},{stage:'Pro',v:3}]

export default function SalesRevenue() {
  return (
    <RoleGuard required="MANAGER">
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-text-primary">Sales & Revenue</h1>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="MRR"             value="$4,820"  delta="8.2%" positive icon={DollarSign}  color={C.success}   />
          <StatCard title="ARR"             value="$57,840" delta="8.2%" positive icon={TrendingUp}  color={C.primary}   />
          <StatCard title="Net New MRR"     value="+$320"   delta="12%"  positive icon={ArrowUpRight} color={C.secondary} />
          <StatCard title="Churn Rate"      value="2.1%"    delta="0.3%" positive={false} icon={UserMinus} color={C.danger} />
        </div>
        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <h3 className="text-sm font-bold text-text-primary mb-4">Monthly Revenue (12 months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenue}>
              <XAxis dataKey="m" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:11}} formatter={(v:any)=>`$${v}`} />
              <Legend wrapperStyle={{fontSize:11}} />
              <Bar dataKey="mrr"   fill={C.success}  radius={[3,3,0,0]} name="MRR" />
              <Bar dataKey="churn" fill={C.danger}   radius={[3,3,0,0]} name="Churn" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <h3 className="text-sm font-bold text-text-primary mb-4">Sales Funnel Conversion</h3>
          <div className="flex items-end gap-2 h-32">
            {funnel.map((f,i)=>(
              <div key={f.stage} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-text-primary">{f.v}%</span>
                <div className="w-full rounded-t-lg" style={{height:`${f.v*1.2}%`,background:C.primary,opacity:0.2+i*0.25}} />
                <span className="text-xs text-text-muted text-center leading-tight">{f.stage}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}
