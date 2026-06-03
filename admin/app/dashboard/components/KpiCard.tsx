import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  sub?: string
  icon?: React.ElementType
  color?: string
  delta?: number
  className?: string
}

export default function KpiCard({ label, value, sub, icon: Icon, color = '#3b82f6', delta, className = '' }: Props) {
  return (
    <div className={`card flex items-start justify-between ${className}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled mb-1">{label}</p>
        <p className="text-2xl font-black text-text-primary tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
        {delta !== undefined && (
          <div className={`flex items-center gap-0.5 text-[11px] mt-1 ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta)}% vs last period
          </div>
        )}
      </div>
      {Icon && (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center ml-3 flex-shrink-0"
          style={{ background: color + '18' }}>
          <Icon className="w-[18px] h-[18px]" style={{ color }} />
        </div>
      )}
    </div>
  )
}
