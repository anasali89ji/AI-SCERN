import { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string; value: string; icon: LucideIcon; color: string
  sub?: string; trend?: 'up' | 'down' | 'neutral'
}

export default function KpiCard({ label, value, icon: Icon, color, sub, trend }: KpiCardProps) {
  return (
    <div className="card p-4 hover:shadow-lg transition-all group">
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 rounded-lg" style={{ background: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trend === 'up' ? 'text-emerald-400 bg-emerald-400/10' : trend === 'down' ? 'text-rose-400 bg-rose-400/10' : 'text-text-muted bg-surface'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
          </span>
        )}
      </div>
      <p className="text-xl font-bold text-text-primary">{value}</p>
      <p className="text-[11px] text-text-muted mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-text-disabled mt-1">{sub}</p>}
    </div>
  )
}
