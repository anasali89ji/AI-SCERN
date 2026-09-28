'use client'
import { useState } from 'react'
import {
  LayoutDashboard, BarChart3, Megaphone, Users, Settings, Shield,
  Activity, KeyRound, Flag, AlertTriangle, FileText, Zap, LogOut,
  ChevronLeft, ChevronRight, Bell, ScanLine, Webhook, Gauge,
  Database, UserCog, Palette, Wrench, Crown, HelpCircle, Receipt,
  TrendingUp, HeartPulse, GitBranch
} from 'lucide-react'

export type TabId =
  | 'overview' | 'analytics' | 'marketing' | 'revenue'
  | 'users' | 'support' | 'apikeys' | 'pipeline'
  | 'flags' | 'announcements' | 'notifications' | 'health'
  | 'costsummary' | 'errors' | 'audit' | 'settings'
  | 'scans' | 'content-moderation' | 'webhooks' | 'rate-limits'
  | 'backup' | 'admin-users' | 'branding' | 'maintenance'

interface SidebarProps { active: TabId; onSelect: (t: TabId) => void; onLogout: () => void }

const SECTIONS: { label: string; items: { id: TabId; label: string; icon: any }[] }[] = [
  {
    label: 'Dashboard',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'scans', label: 'Live Scans', icon: ScanLine },
      { id: 'health', label: 'Health', icon: HeartPulse },
    ],
  },
  {
    label: 'Users & Content',
    items: [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'support', label: 'Support', icon: HelpCircle },
      { id: 'content-moderation', label: 'Moderation', icon: Shield },
    ],
  },
  {
    label: 'Communication',
    items: [
      { id: 'announcements', label: 'Announcements', icon: Megaphone },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Revenue & Growth',
    items: [
      { id: 'revenue', label: 'Revenue', icon: Receipt },
      { id: 'marketing', label: 'Marketing', icon: TrendingUp },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'pipeline', label: 'Pipeline', icon: GitBranch },
      { id: 'costsummary', label: 'Cost Summary', icon: Zap },
      { id: 'apikeys', label: 'API Keys', icon: KeyRound },
      { id: 'flags', label: 'Feature Flags', icon: Flag },
      { id: 'webhooks', label: 'Webhooks', icon: Webhook },
      { id: 'rate-limits', label: 'Rate Limits', icon: Gauge },
    ],
  },
  {
    label: 'Security & Logs',
    items: [
      { id: 'errors', label: 'Errors', icon: AlertTriangle },
      { id: 'audit', label: 'Audit Log', icon: FileText },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'branding', label: 'Branding', icon: Palette },
      { id: 'maintenance', label: 'Maintenance', icon: Wrench },
      { id: 'admin-users', label: 'Admin Users', icon: UserCog },
      { id: 'backup', label: 'Backup', icon: Database },
    ],
  },
]

export default function Sidebar({ active, onSelect, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`flex flex-col h-screen bg-[#0a0a12] border-r border-[#1c1c2e] transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="flex items-center justify-between p-4 border-b border-[#1c1c2e]">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center">
              <Crown className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">Aiscern Admin</span>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg text-text-muted hover:text-white transition-colors">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {SECTIONS.map(section => (
          <div key={section.label} className="mb-2">
            {!collapsed && <p className="px-4 py-1 text-[10px] font-bold uppercase text-text-disabled tracking-wider">{section.label}</p>}
            {section.items.map(item => {
              const Icon = item.icon
              const isActive = active === item.id
              return (
                <button key={item.id} onClick={() => onSelect(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-all ${isActive ? 'text-white bg-primary/10 border-r-2 border-r-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface/50'}`}>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-[#1c1c2e]">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all">
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
