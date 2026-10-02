import type { ComponentType, ReactNode } from 'react'

const COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  purple: '#8b5cf6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: '#06b6d4',
  indigo: '#6366f1',
  slate: '#64748b',
}

interface KpiCardProps {
  /** Card caption. `title` is accepted as an alias used by the tabs. */
  label?: string
  title?: string
  value: string | number
  /** Either a rendered element (<Users size={20} />) or a component (Users). */
  icon?: ReactNode | ComponentType<{ className?: string; style?: React.CSSProperties }>
  /** Named color (blue, green, ...) or any CSS color string. */
  color?: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
}

function renderIcon(icon: KpiCardProps['icon'], color: string): ReactNode {
  if (!icon) return null
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in icon && !('props' in icon))) {
    const Icon = icon as ComponentType<{ className?: string; style?: React.CSSProperties }>
    return <Icon className="w-4 h-4" style={{ color }} />
  }
  return <span style={{ color }} className="inline-flex">{icon as ReactNode}</span>
}

function KpiCard({ label, title, value, icon, color = 'blue', sub, trend }: KpiCardProps) {
  const hex = COLOR_MAP[color] ?? color
  const caption = label ?? title ?? ''
  return (
    <div className="card p-4 hover:shadow-lg transition-all group">
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 rounded-lg" style={{ background: `${hex}26` }}>
          {renderIcon(icon, hex)}
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trend === 'up' ? 'text-emerald-400 bg-emerald-400/10' : trend === 'down' ? 'text-rose-400 bg-rose-400/10' : 'text-text-muted bg-surface'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
          </span>
        )}
      </div>
      <p className="text-xl font-bold text-text-primary">{value}</p>
      <p className="text-[11px] text-text-muted mt-0.5">{caption}</p>
      {sub && <p className="text-[10px] text-text-disabled mt-1">{sub}</p>}
    </div>
  )
}

// Named + default export (tabs import { KpiCard }, other files import default)
export { KpiCard }
export default KpiCard
