'use client'
import { useState } from 'react'
import {
  BarChart3, Users, Database, Flag, AlertTriangle, FileText,
  Settings, TrendingUp, DollarSign, Headphones, Key,
  Megaphone, Activity, ChevronLeft, ChevronRight, LogOut,
  Radio, Menu, X
} from 'lucide-react'

export type TabId =
  | 'overview' | 'analytics' | 'marketing' | 'revenue'
  | 'users' | 'support' | 'apikeys' | 'pipeline'
  | 'flags' | 'announcements' | 'health' | 'errors' | 'audit' | 'settings'

interface NavItem { id: TabId; label: string; icon: React.ElementType; group: string }

const NAV: NavItem[] = [
  { id: 'overview',      label: 'Overview',        icon: BarChart3,      group: 'OVERVIEW' },
  { id: 'analytics',     label: 'Analytics',       icon: TrendingUp,     group: 'OVERVIEW' },
  { id: 'marketing',     label: 'Marketing',       icon: Radio,          group: 'OVERVIEW' },
  { id: 'revenue',       label: 'Revenue',         icon: DollarSign,     group: 'OVERVIEW' },
  { id: 'users',         label: 'Users',           icon: Users,          group: 'OPERATIONS' },
  { id: 'support',       label: 'Support Tickets', icon: Headphones,     group: 'OPERATIONS' },
  { id: 'apikeys',       label: 'API Keys',        icon: Key,            group: 'OPERATIONS' },
  { id: 'pipeline',      label: 'Pipeline',        icon: Database,       group: 'OPERATIONS' },
  { id: 'flags',         label: 'Feature Flags',   icon: Flag,           group: 'SYSTEM' },
  { id: 'announcements', label: 'Announcements',   icon: Megaphone,      group: 'SYSTEM' },
  { id: 'health',        label: 'Health Monitor',  icon: Activity,       group: 'SYSTEM' },
  { id: 'errors',        label: 'Error Logs',      icon: AlertTriangle,  group: 'SYSTEM' },
  { id: 'audit',         label: 'Audit Log',       icon: FileText,       group: 'SYSTEM' },
  { id: 'settings',      label: 'Settings',        icon: Settings,       group: 'SYSTEM' },
]

interface Props {
  active: TabId
  onSelect: (id: TabId) => void
  onLogout: () => void
}

export default function Sidebar({ active, onSelect, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const groups = ['OVERVIEW', 'OPERATIONS', 'SYSTEM']

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-border ${collapsed ? 'justify-center' : ''}`}>
        <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="9" fill="url(#sb_lg)" />
          <path d="M20 8L30 28H10L20 8Z" fill="white" fillOpacity="0.92" />
          <circle cx="20" cy="25" r="3.5" fill="white" fillOpacity="0.6" />
          <defs>
            <linearGradient id="sb_lg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1d4ed8" /><stop offset="1" stopColor="#0369a1" />
            </linearGradient>
          </defs>
        </svg>
        {!collapsed && (
          <div>
            <div className="text-sm font-black text-text-primary gradient-text-cool">Aiscern</div>
            <div className="text-[10px] text-text-disabled font-semibold tracking-widest uppercase">Admin</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Admin navigation">
        {groups.map(group => {
          const items = NAV.filter(n => n.group === group)
          return (
            <div key={group}>
              {!collapsed && (
                <p className="text-[10px] font-bold text-text-disabled tracking-widest uppercase px-3 mb-2">{group}</p>
              )}
              <div className="space-y-0.5">
                {items.map(item => {
                  const Icon = item.icon
                  const isActive = active === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onSelect(item.id); setMobileOpen(false) }}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/50
                        ${collapsed ? 'justify-center' : ''}
                        ${isActive
                          ? 'nav-active text-primary'
                          : 'text-text-muted hover:bg-surface-hover hover:text-text-secondary'
                        }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-3 py-3 space-y-1">
        {!collapsed && (
          <div className="px-3 py-2 text-[10px] text-text-disabled">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
              <span>Session active</span>
            </div>
          </div>
        )}
        <button onClick={onLogout} aria-label="Logout"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
            text-text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-all
            focus:outline-none focus:ring-2 focus:ring-rose-500/50
            ${collapsed ? 'justify-center' : ''}`}>
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 bg-surface border-r border-border transition-all duration-300 relative
        ${collapsed ? 'w-[72px]' : 'w-[260px]'}`}>
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface border border-border
            flex items-center justify-center text-text-disabled hover:text-text-secondary hover:border-primary/50 transition-all z-10">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile hamburger */}
      <button onClick={() => setMobileOpen(true)} aria-label="Open navigation"
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 rounded-xl bg-surface border border-border
          flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-[260px] bg-surface border-r border-border flex flex-col">
            <button onClick={() => setMobileOpen(false)} aria-label="Close navigation"
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
