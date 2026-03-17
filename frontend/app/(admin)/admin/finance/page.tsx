'use client'
import { useState, useEffect } from 'react'
import { RoleGuard } from '@/components/dashboard/RoleGuard'
import { StatCard }  from '@/components/dashboard/StatCard'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Percent } from 'lucide-react'

const C = { primary:'#0ea5e9', secondary:'#6366f1', success:'#10b981', warning:'#f59e0b', danger:'#ef4444' }
const months = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
const plData  = months.map((m,i)=>({m,revenue:3000+i*280,costs:1800+i*80,profit:1200+i*200}))
const costPie = [{name:'Vercel/Infra',v:38},{name:'API Costs',v:32},{name:'Domain/Tools',v:12},{name:'Marketing',v:18}]
const COLORS  = [C.primary,C.secondary,C.success,C.warning]
const metrics = [{label:'ARR',value:'$57,840'},{label:'MRR',value:'$4,820'},{label:'ARPU',value:'$10.40'},{label:'LTV',value:'$124'},{label:'CAC',value:'$18'},{label:'LTV:CAC',value:'6.9x'}]

export default function Finance() {
  const [authed, setAuthed] = useState(false)
  const [pin, setPin]       = useState('')

  useEffect(() => {
    // Re-auth after 30min inactivity
    const last = parseInt(sessionStorage.getItem('finance_auth') ?? '0',10)
    if (Date.now() - last < 30 * 60 * 1000) setAuthed(true)
  }, [])

  const handleAuth = () => {
    if (pin === '0000') { // Demo PIN — replace with real auth
      sessionStorage.setItem('finance_auth', String(Date.now()))
      setAuthed(true)
    }
  }

  if (!authed) return (
    <RoleGuard required="EXECUTIVE">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="rounded-2xl border border-border bg-surface/60 p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber/10 border border-amber/20 flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-text-primary mb-2">Financial Access</h2>
          <p className="text-sm text-text-muted mb-6">Re-authentication required for financial data.</p>
          <input type="password" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAuth()}
            placeholder="Enter PIN (demo: 0000)"
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-text-primary mb-4 focus:outline-none focus:border-primary/50 text-center tracking-widest" />
          <button onClick={handleAuth} className="w-full btn-primary py-3 text-sm">Authenticate</button>
        </div>
      </div>
    </RoleGuard>
  )

  return (
    <RoleGuard required="EXECUTIVE">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-text-primary">Financial Dashboard</h1>
          <span className="text-xs text-amber-400 bg-amber/10 border border-amber/20 px-3 py-1 rounded-full font-medium">🔒 Restricted</span>
        </div>

        {/* Investor metrics */}
        <div className="rounded-xl border border-amber/20 bg-amber/5 p-5">
          <h3 className="text-sm font-bold text-text-primary mb-4">Investor Metrics</h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {metrics.map(({label,value})=>(
              <div key={label} className="text-center">
                <div className="text-lg font-black text-text-primary">{value}</div>
                <div className="text-xs text-text-muted mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Revenue (Mar)"  value="$5,140" delta="12%" positive icon={DollarSign}  color={C.success}   />
          <StatCard title="Costs (Mar)"    value="$2,210" delta="4%"  positive={false} icon={TrendingDown} color={C.danger} />
          <StatCard title="Gross Profit"   value="$2,930" delta="18%" positive icon={TrendingUp}  color={C.primary}   />
          <StatCard title="Gross Margin"   value="57%"    delta="3%"  positive icon={Percent}     color={C.secondary} />
        </div>

        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <h3 className="text-sm font-bold text-text-primary mb-4">P&L — Revenue vs Costs (12 months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={plData}>
              <XAxis dataKey="m" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:11}} formatter={(v:any)=>`$${v}`} />
              <Legend wrapperStyle={{fontSize:11}} />
              <Bar dataKey="revenue" fill={C.success}  radius={[3,3,0,0]} name="Revenue" />
              <Bar dataKey="costs"   fill={C.danger}   radius={[3,3,0,0]} name="Costs"   />
              <Bar dataKey="profit"  fill={C.primary}  radius={[3,3,0,0]} name="Profit"  />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">Cost Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={costPie} dataKey="v" cx="50%" cy="50%" outerRadius={75} label={({name,v})=>`${name} ${v}%`} labelLine={false}>
                  {costPie.map((_,i)=><Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:11}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-border bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">Cash Flow Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={plData}>
                <XAxis dataKey="m" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{background:'#1a1a2e',border:'1px solid #2a2a3e',borderRadius:8,fontSize:11}} formatter={(v:any)=>`$${v}`} />
                <Line type="monotone" dataKey="profit" stroke={C.success} strokeWidth={2} dot={false} name="Net Cash" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}
