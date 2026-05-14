import { LucideIcon } from 'lucide-react'

interface Props {
  title:    string
  value:    string | number
  delta?:   string
  positive?: boolean
  icon:     LucideIcon
  color?:   string
  blurred?: boolean
}

export function StatCard({ title, value, delta, positive = true, icon: Icon, color = '#0ea5e9', blurred = false }: Props) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-text-muted font-medium">{title}</p>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className={`text-2xl font-black text-text-primary mb-1 ${blurred ? 'blur-md select-none' : ''}`}>{value}</div>
      {delta && (
        <p className={`text-xs font-medium ${positive ? 'text-emerald-400' : 'text-rose'}`}>
          {positive ? '↑' : '↓'} {delta} vs last period
        </p>
      )}
    </div>
  )
}
