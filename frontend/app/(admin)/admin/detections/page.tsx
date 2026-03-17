'use client'
import { RoleGuard } from '@/components/dashboard/RoleGuard'
import { StatCard }  from '@/components/dashboard/StatCard'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Scan, TrendingUp, AlertTriangle, Activity } from 'lucide-react'

const C = { primary:'#0ea5e9', secondary:'#6366f1', success:'#10b981', warning:'#f59e0b', danger:'#ef4444', muted:'#94a3b8' }
const line30 = Array.from({length:30},(_,i)=>({d:`${i+1}`,text:Math.floor(Math.random()*500+200),image:Math.floor(Math.random()*300+100),audio:Math.floor(Math.random()*150+50),video:Math.floor(Math.random()*80+20)}))
const modPie  = [{name:'Text',v:52},{name:'Image',v:27},{name:'Audio',v:13},{name:'Video',v:8}]
const COLORS  = [C.primary,C.secondary,C.success,C.warning]
const aiSrcs  = [{src:'ChatGPT',count:4820},{src:'Claude',count:3210},{src:'Midjourney',count:2180},{src:'DALL-E',count:1540},{src:'ElevenLabs',count:890},{src:'Stable Diffusion',count:760}]

export default function DetectionAnalytics() {
  return (
    <RoleGuard required="ANALYST">
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-text-primary">Detection Analytics</h1>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Scans Today"     value="14,280" delta="12%" positive icon={Scan}          color={C.primary}   />
          <StatCard title="This Month"      value="312k"   delta="18%" positive icon={TrendingUp}    color={C.secondary} />
          <StatCard title="False Pos. Rate" value="3.2%"   delta="0.4%" positive={false} icon={AlertTriangle} color={C.warning} />
          <StatCard title="Avg Response"    value="1.4s"   delta="0.1s" positive icon={Activity}    color={C.success}   />
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">30-Day Volume by Modality</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={line30}>
                <XAxis dataKey="d" tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:11}} />
                <Legend wrapperStyle={{fontSize:11}} />
                <Line type="monotone" dataKey="text"  stroke={C.primary}   strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="image" stroke={C.secondary} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="audio" stroke={C.success}   strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="video" stroke={C.warning}   strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">Modality Breakdown</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={modPie} dataKey="v" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({name,v})=>`${name} ${v}%`} labelLine={false}>
                  {modPie.map((_,i)=><Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:11}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <h3 className="text-sm font-bold text-text-primary mb-4">Top Detected AI Sources</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={aiSrcs} layout="vertical">
              <XAxis type="number" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="src" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} width={120} />
              <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:11}} />
              <Bar dataKey="count" fill={C.primary} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </RoleGuard>
  )
}
