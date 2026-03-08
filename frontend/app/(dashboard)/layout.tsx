'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Image, Video, Music, FileText, Globe,
  Layers, Clock, User, Settings, Shield, ChevronLeft,
  ChevronRight, Menu, X, LogOut, Brain, Zap
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

const navGroups = [
  {
    label: 'Detection',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/detect/image', icon: Image, label: 'Image' },
      { href: '/detect/video', icon: Video, label: 'Video' },
      { href: '/detect/audio', icon: Music, label: 'Audio' },
      { href: '/detect/text', icon: FileText, label: 'Text' },
    ]
  },
  {
    label: 'Tools',
    items: [
      { href: '/scraper', icon: Globe, label: 'Web Scraper' },
      { href: '/batch', icon: Layers, label: 'Batch' },
      { href: '/history', icon: Clock, label: 'History' },
      { href: '/pipeline', icon: Brain, label: 'HF Pipeline' },
    ]
  },
  {
    label: 'Account',
    items: [
      { href: '/profile', icon: User, label: 'Profile' },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ]
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user: firebaseUser } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, loading: isLoading, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = signOut

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-border ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 animate-glow-pulse">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!collapsed && <span className="text-xl font-black gradient-text">DETECTAI</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto no-scrollbar">
        {navGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-xs font-semibold text-text-disabled uppercase tracking-widest px-3 mb-2">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map(item => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                      ${active
                        ? 'bg-primary/15 text-primary border-l-2 border-primary'
                        : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
                      } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 ${active ? 'text-primary' : ''}`} />
                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-border p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {user?.email || user?.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-secondary truncate">{user?.email || user?.displayName}</p>
              <p className="text-xs text-primary font-medium">Free Plan</p>
            </div>
            <button onClick={handleLogout} className="text-text-muted hover:text-rose transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={handleLogout} className="w-full flex justify-center py-2 text-text-muted hover:text-rose transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="hidden lg:flex flex-col bg-surface border-r border-border relative flex-shrink-0"
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-primary hover:border-primary transition-all text-text-muted hover:text-white z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 z-40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-surface border-r border-border z-50 flex flex-col"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-surface/50 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden text-text-muted hover:text-text-primary transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <Brain className="w-6 h-6 text-primary" />
            <span className="font-bold gradient-text">DETECTAI</span>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-sm text-text-muted">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            All systems operational
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white">
              {user?.email || user?.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
