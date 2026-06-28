'use client'
import { RoleGuard } from '@/components/dashboard/RoleGuard'
import { StatCard }  from '@/components/dashboard/StatCard'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Code2, Users, AlertTriangle } from 'lucide-react'

const C = { primary:'#0ea5e9', secondary:'#6366f1', success:'#10b981', warning:'#f59e0b', danger:'#ef4444' }
const daily = Array.from({length:30},(_,i)=>({d:`${i+1}`,calls:Math.floor(Math.random()*5000+2000),errors:Math.floor(Math.random()*80+20)}))
const endpoints = [{ep:'/api/detect/text',calls:18420,p50:'380ms',errors:'1.2%'},{ep:'/api/detect/image',calls:9840,p50:'1.1s',errors:'2.1%'},{ep:'/api/detect/audio',calls:4210,p50:'2.2s',errors:'3.4%'},{ep:'/api/detect/video',calls:1840,p50:'4.8s',errors:'4.1%'}]
const topUsers = [{key:'sk-••••3f2a',calls:8420,plan:'Enterprise'},{key:'sk-••••8b1c',calls:5240,plan:'Pro'},{key:'sk-••••2d4e',calls:3180,plan:'Pro'},{key:'sk-••••9a7f',calls:1920,plan:'Pro'}]
const errors   = [{code:'400',label:'Bad Request',count:342},{code:'401',label:'Unauthorized',count:128},{code:'429',label:'Rate Limited',count:84},{code:'500',label:'Server Error',count:12}]

export default function ApiUsage() {
  return (
    <RoleGuard required="ANALYST">
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-slate-100">API Usage</h1>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="API Calls Today"    value="34,240" delta="8%"   positive icon={Code2}         color={C.primary}   />
          <StatCard title="This Month"         value="842k"   delta="21%"  positive icon={Code2}         color={C.secondary} />
          <StatCard title="Unique API Users"   value="284"    delta="14%"  positive icon={Users}         color={C.success}   />
          <StatCard title="Error Rate"         value="2.3%"   delta="0.2%" positive={false} icon={AlertTriangle} color={C.danger} />
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-surface/60 p-5">
          <h3 className="text-sm font-bold text-slate-100 mb-4">Daily API Calls (30 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={daily}>
              <XAxis dataKey="d" tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:11}} />
              <Line type="monotone" dataKey="calls"  stroke={C.primary} strokeWidth={2} dot={false} name="Calls" />
              <Line type="monotone" dataKey="errors" stroke={C.danger}  strokeWidth={1.5} dot={false} name="Errors" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/[0.08] bg-surface/60 p-5 overflow-x-auto">
            <h3 className="text-sm font-bold text-slate-100 mb-4">Usage by Endpoint</h3>
            <table className="w-full text-sm min-w-[320px]">
              <thead><tr className="border-b border-white/[0.08] text-xs text-slate-500">
                <th className="text-left py-2 font-medium">Endpoint</th>
                <th className="text-right py-2 font-medium">Calls</th>
                <th className="text-right py-2 font-medium">P50</th>
                <th className="text-right py-2 font-medium">Errors</th>
              </tr></thead>
              <tbody>
                {endpoints.map(e=>(
                  <tr key={e.ep} className="border-b border-white/[0.06] text-xs">
                    <td className="py-2 text-blue-400 font-medium">{e.ep}</td>
                    <td className="py-2 text-right text-slate-100">{e.calls.toLocaleString()}</td>
                    <td className="py-2 text-right text-slate-500">{e.p50}</td>
                    <td className="py-2 text-right" style={{color:parseFloat(e.errors)>3?C.danger:C.warning}}>{e.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-slate-100 mb-4">Error Analysis</h3>
            <div className="space-y-3">
              {errors.map(e=>(
                <div key={e.code} className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-white/[0.08]">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-rose-400-500 mr-2">{e.code}</span>
                    <span className="text-xs text-slate-500">{e.label}</span>
                  </div>
                  <span className="text-sm font-black text-slate-100">{e.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}
