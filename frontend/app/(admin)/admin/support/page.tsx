'use client'
import { RoleGuard } from '@/components/dashboard/RoleGuard'
import { StatCard }  from '@/components/dashboard/StatCard'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { HeadphonesIcon, Clock, CheckCircle2, Star } from 'lucide-react'

const C = { primary:'#0ea5e9', secondary:'#6366f1', success:'#10b981', warning:'#f59e0b', danger:'#ef4444' }
const categories = [{name:'False Positives',v:34},{name:'Billing',v:22},{name:'API Issues',v:18},{name:'Feature Req.',v:16},{name:'Bugs',v:10}]
const COLORS  = [C.warning,C.secondary,C.primary,C.success,C.danger]
const issues  = [{issue:'Audio false positive on music',count:24},{issue:'API 429 rate limit confusion',count:18},{issue:'Text limit on free tier',count:15},{issue:'Video scan timeout',count:12},{issue:'Billing cycle question',count:9}]
const latestReviews = [{name:'Sarah K.',rating:5,text:'Incredible tool for editorial workflow.'},{name:'Marcus T.',rating:5,text:'Accuracy rivals enterprise tools.'},{name:'James R.',rating:5,text:'Caught a voice clone phishing attempt.'}]

export default function Support() {
  return (
    <RoleGuard required="SUPPORT">
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-text-primary">Customer Support</h1>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="CSAT Score"      value="94%"   delta="2%"  positive icon={Star}             color={C.warning}   />
          <StatCard title="NPS Score"       value="62"    delta="4"   positive icon={HeadphonesIcon}   color={C.primary}   />
          <StatCard title="Avg Response"    value="1.8h"  delta="12%"  positive icon={Clock}           color={C.success}   />
          <StatCard title="Resolution Rate" value="96.2%" delta="1.2%" positive icon={CheckCircle2}   color={C.secondary} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">Ticket Categories</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categories} dataKey="v" cx="50%" cy="50%" outerRadius={75} label={({name,v})=>`${name} ${v}%`} labelLine={false}>
                  {categories.map((_,i)=><Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:11}} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">Ticket Status</h3>
            <div className="space-y-3">
              {[{label:'Open',count:12,color:C.danger},{label:'In Progress',count:5,count2:5,color:C.warning},{label:'Resolved',count:148,color:C.success}].map(s=>(
                <div key={s.label} className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/50">
                  <span className="text-sm text-text-secondary">{s.label}</span>
                  <span className="text-lg font-black" style={{color:s.color}}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface/60 p-5 overflow-x-auto">
          <h3 className="text-sm font-bold text-text-primary mb-4">Top 5 Common Issues</h3>
          <table className="w-full text-sm min-w-[320px]">
            <thead><tr className="border-b border-border text-xs text-text-muted">
              <th className="text-left py-2 font-medium">Issue</th>
              <th className="text-right py-2 font-medium">Tickets</th>
            </tr></thead>
            <tbody>
              {issues.map((r,i)=>(
                <tr key={i} className="border-b border-border/40 text-xs">
                  <td className="py-2 text-text-secondary">{r.issue}</td>
                  <td className="py-2 text-right font-bold text-text-primary">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <h3 className="text-sm font-bold text-text-primary mb-4">Latest Reviews</h3>
          <div className="space-y-3">
            {latestReviews.map((r,i)=>(
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-background/50 border border-border/50">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">{r.name[0]}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-text-primary">{r.name}</span>
                    <span className="text-amber-400 text-xs">{'★'.repeat(r.rating)}</span>
                  </div>
                  <p className="text-xs text-text-muted">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}
