'use client'
import { Bell, Search, Activity } from 'lucide-react'
import { useEffect, useState } from 'react'

interface TopbarProps { activeTab: string }

const TAB_LABELS: Record<string, string> = {
  overview: 'Overview', analytics: 'Analytics', marketing: 'Marketing', revenue: 'Revenue',
  users: 'Users', support: 'Support Tickets', apikeys: 'API Keys', pipeline: 'Pipeline',
  flags: 'Feature Flags', announcements: 'Announcements', notifications: 'Notifications',
  health: 'Health Monitor', costsummary: 'Pipeline Cost Summary',
  errors: 'Error Logs', audit: 'Audit Log', settings: 'Settings',
  scans: 'Live Scan Monitor', 'content-moderation': 'Content Moderation',
  webhooks: 'Webhooks', 'rate-limits': 'Rate Limit Monitor',
  backup: 'Backup & Restore', 'admin-users': 'Admin Users',
  branding: 'Branding', maintenance: 'Maintenance Mode',
}

export default function Topbar({ activeTab }: TopbarProps) {
  const [liveUsers, setLiveUsers] = useState(0)
  const [notifications, setNotifications] = useState(0)

  useEffect(() => {
    const eventSource = new EventSource('/api/realtime')
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'user_signup') setLiveUsers(prev => prev + 1)
    }
    return () => eventSource.close()
  }, [])

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-[#0a0a12] border-b border-[#1c1c2e]">
      <div>
        <h1 className="text-lg font-bold text-white">{TAB_LABELS[activeTab] || activeTab}</h1>
        <p className="text-[10px] text-text-muted">Aiscern Admin Console v2.0</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-text-secondary">{liveUsers} new today</span>
        </div>
        <div className="relative">
          <Bell className="w-5 h-5 text-text-muted" />
          {notifications > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] text-white flex items-center justify-center">{notifications}</span>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-xs font-bold">
          A
        </div>
      </div>
    </header>
  )
}
