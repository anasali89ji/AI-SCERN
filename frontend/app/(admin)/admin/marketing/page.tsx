'use client'
import { RoleGuard } from '@/components/dashboard/RoleGuard'
import { StatCard }  from '@/components/dashboard/StatCard'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Globe, TrendingUp, MousePointer, Search } from 'lucide-react'

const C = { primary:'#0ea5e9', secondary:'#6366f1', success:'#10b981', warning:'#f59e0b', danger:'#ef4444' }
const sources = [{name:'Organic',v:48},{name:'Direct',v:26},{name:'Social',v:16},{name:'Referral',v:10}]
const COLORS  = [C.success,C.primary,C.secondary,C.warning]
const keywords= [{kw:'ai detector free',pos:4,ctr:'8.2%',clicks:1240},{kw:'deepfake detector',pos:7,ctr:'5.1%',clicks:890},{kw:'chatgpt detector',pos:5,ctr:'7.3%',clicks:760},{kw:'ai text detector',pos:3,ctr:'11.2%',clicks:2140},{kw:'ai image detector',pos:6,ctr:'6.8%',clicks:540}]
const pages   = [{page:'/',sessions:8240,bounce:'38%'},{page:'/detect/text',sessions:3120,bounce:'24%'},{page:'/detect/image',sessions:2480,bounce:'28%'},{page:'/pricing',sessions:1840,bounce:'42%'}]

export default function Marketing() {
  return (
    <RoleGuard required="MARKETING">
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-text-primary">Marketing Analytics</h1>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Monthly Visitors"  value="48,320" delta="22%"  positive icon={Globe}       color={C.primary}   />
          <StatCard title="Bounce Rate"       value="36.4%"  delta="2.1%" positive icon={MousePointer} color={C.warning}   />
          <StatCard title="Organic Traffic"   value="23,180" delta="34%"  positive icon={Search}      color={C.success}   />
          <StatCard title="Signup Conv. Rate" value="3.8%"   delta="0.4%" positive icon={TrendingUp}  color={C.secondary} />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">Traffic Sources</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sources} dataKey="v" cx="50%" cy="50%" outerRadius={75} label={({name,v})=>`${name} ${v}%`} labelLine={false}>
                  {sources.map((_,i)=><Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:11}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-border bg-surface/60 p-5 overflow-x-auto">
            <h3 className="text-sm font-bold text-text-primary mb-4">Top SEO Keywords</h3>
            <table className="w-full text-sm min-w-[320px]">
              <thead><tr className="border-b border-border text-xs text-text-muted">
                <th className="text-left py-2 font-medium">Keyword</th>
                <th className="text-center py-2 font-medium">Pos.</th>
                <th className="text-center py-2 font-medium">CTR</th>
                <th className="text-right py-2 font-medium">Clicks</th>
              </tr></thead>
              <tbody>
                {keywords.map(k=>(
                  <tr key={k.kw} className="border-b border-border/40 text-xs">
                    <td className="py-2 text-text-secondary">{k.kw}</td>
                    <td className="py-2 text-center font-bold" style={{color:k.pos<=5?C.success:C.warning}}>#{k.pos}</td>
                    <td className="py-2 text-center text-text-muted">{k.ctr}</td>
                    <td className="py-2 text-right text-text-primary font-semibold">{k.clicks.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface/60 p-5 overflow-x-auto">
          <h3 className="text-sm font-bold text-text-primary mb-4">Top Landing Pages</h3>
          <table className="w-full text-sm min-w-[320px]">
            <thead><tr className="border-b border-border text-xs text-text-muted">
              <th className="text-left py-2 font-medium">Page</th>
              <th className="text-right py-2 font-medium">Sessions</th>
              <th className="text-right py-2 font-medium">Bounce</th>
            </tr></thead>
            <tbody>
              {pages.map(p=>(
                <tr key={p.page} className="border-b border-border/40 text-xs">
                  <td className="py-2 text-primary font-medium">{p.page}</td>
                  <td className="py-2 text-right text-text-primary">{p.sessions.toLocaleString()}</td>
                  <td className="py-2 text-right text-text-muted">{p.bounce}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </RoleGuard>
  )
}
