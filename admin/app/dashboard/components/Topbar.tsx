'use client'
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'

const TAB_LABELS: Record<string, string> = {
  overview: 'Overview', analytics: 'Analytics', marketing: 'Marketing', revenue: 'Revenue',
  users: 'Users', support: 'Support Tickets', apikeys: 'API Keys', pipeline: 'Pipeline',
  flags: 'Feature Flags', announcements: 'Announcements', health: 'Health Monitor',
  errors: 'Error Logs', audit: 'Audit Log', settings: 'Settings',
}

interface Props { activeTab: string; healthy?: boolean | null }

export default function Topbar({ activeTab, healthy }: Props) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-surface/80 backdrop-blur-sm flex-shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm pl-10 lg:pl-0">
        <span className="text-text-disabled">Dashboard</span>
        <span className="text-text-disabled">/</span>
        <span className="text-text-primary font-semibold">{TAB_LABELS[activeTab] ?? activeTab}</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* System status */}
        {healthy !== null && healthy !== undefined && (
          <div className={`hidden sm:flex items-center gap-1.5 text-xs font-medium ${healthy ? 'text-emerald-400' : 'text-rose-400'}`}>
            {healthy
              ? <><CheckCircle className="w-3.5 h-3.5" /><span>All systems operational</span></>
              : <><AlertTriangle className="w-3.5 h-3.5" /><span>System issues detected</span></>
            }
          </div>
        )}
        {/* Clock */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-muted font-mono">
          <Clock className="w-3.5 h-3.5" />
          <span>{time}</span>
        </div>
      </div>
    </header>
  )
}
