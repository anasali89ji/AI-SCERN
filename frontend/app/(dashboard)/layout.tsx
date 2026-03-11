'use client'
export const dynamic = 'force-dynamic'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Image, Video, Music, FileText, Globe,
  Layers, Clock, User, Settings, Shield, ChevronLeft,
  ChevronRight, Menu, BarChart2, LogOut, ChevronDown, MessageSquare, Zap
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

const navGroups = [
  {
    label: 'Detection',
    items: [
      { href: '/dashboard',     icon: 'LayoutDashboard', label: 'Overview'   },
      { href: '/detect/image',  icon: 'Image',           label: 'Image'      },
      { href: '/detect/video',  icon: 'Video',           label: 'Video'      },
      { href: '/detect/audio',  icon: 'Music',           label: 'Audio'      },
      { href: '/detect/text',   icon: 'FileText',        label: 'Text'       },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/chat',     icon: 'MessageSquare', label: 'AI Assistant' },
      { href: '/scraper',  icon: 'Globe',         label: 'Web Scanner'  },
      { href: '/batch',    icon: 'Layers',        label: 'Batch Scan'   },
      { href: '/history',  icon: 'Clock',         label: 'History'      },
      { href: '/dashboard#analytics', icon: 'BarChart2', label: 'Analytics' },
    ],
  },
]

const iconMap: Record<string, any> = {
  LayoutDashboard, Image, Video, Music, FileText, Globe, Layers, Clock, BarChart2, User, Settings, MessageSquare, Zap
}

function Avatar({ user, size = 8 }: { user: any; size?: number }) {
  const initials = user?.displayName
    ? user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U'

  if (user?.photoURL) {
    return (
      <img src={user.photoURL} alt="avatar"
        className={`w-${size} h-${size} rounded-full object-cover ring-2 ring-primary/30`}
        onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
    )
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white ring-2 ring-primary/20 flex-shrink-0`}>
      {initials}
    </div>
  )
}

function UserDropdown({ user, signOut }: { user: any; signOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = user?.email || ''
  const shortEmail = email.length > 22 ? email.slice(0, 19) + '\u2026' : email

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-surface-hover transition-all">
        <Avatar user={user} size={8} />
        <div className="hidden md:block text-left">
          <p className="text-xs font-semibold text-text-primary truncate max-w-[110px]">{displayName}</p>
          <p className="text-[10px] text-text-muted truncate max-w-[110px]">{shortEmail}</p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Avatar user={user} size={10} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{displayName}</p>
                  <p className="text-xs text-text-muted truncate">{email}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
                    <span className="text-[10px] text-emerald font-medium">Active &middot; Pro Plan</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-2">
              <Link href="/profile" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-hover transition-colors group">
                <User className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
                <span className="text-sm text-text-secondary group-hover:text-text-primary">My Profile</span>
              </Link>
              <Link href="/settings" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-hover transition-colors group">
                <Settings className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
                <span className="text-sm text-text-secondary group-hover:text-text-primary">Settings</span>
              </Link>
              <Link href="/history" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-hover transition-colors group">
                <Clock className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
                <span className="text-sm text-text-secondary group-hover:text-text-primary">Scan History</span>
              </Link>
            </div>
            <div className="p-2 border-t border-border">
              <button onClick={() => { setOpen(false); signOut() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-rose/10 transition-colors group">
                <LogOut className="w-4 h-4 text-text-muted group-hover:text-rose transition-colors" />
                <span className="text-sm text-text-secondary group-hover:text-rose">Sign out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-border ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!collapsed && <span className="text-xl font-black gradient-text">DETECTAI</span>}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-xs font-semibold text-text-disabled uppercase tracking-widest px-3 mb-2">{group.label}</p>
            )}
            <div className="space-y-1">
              {group.items.map(item => {
                const Icon = iconMap[item.icon]
                const active = pathname === item.href
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group
                      ${active ? 'bg-primary/15 text-primary border-l-2 border-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'}
                      ${collapsed ? 'justify-center' : ''}`}>
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary' : ''}`} />
                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {!collapsed && (
          <div>
            <p className="text-xs font-semibold text-text-disabled uppercase tracking-widest px-3 mb-2">Account</p>
            <div className="space-y-1">
              {[{href:'/profile',icon:'User',label:'Profile'},{href:'/settings',icon:'Settings',label:'Settings'}].map(item => {
                const Icon = iconMap[item.icon]
                const active = pathname === item.href
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                      ${active ? 'bg-primary/15 text-primary border-l-2 border-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'}`}>
                    <Icon className={`w-5 h-5 ${active ? 'text-primary' : ''}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-border p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-surface-hover transition-colors">
            <Avatar user={user} size={8} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-secondary truncate">
                {user?.displayName || user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-[10px] text-emerald font-medium">&#x25CF; Online</p>
            </div>
            <button onClick={signOut} title="Sign out"
              className="text-text-muted hover:text-rose transition-colors p-1 rounded-lg hover:bg-rose/10">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={signOut} className="w-full flex justify-center py-2 text-text-muted hover:text-rose">
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <motion.aside animate={{ width: collapsed ? 72 : 260 }} transition={{ duration: 0.3 }}
        className="hidden lg:flex flex-col bg-surface border-r border-border relative flex-shrink-0">
        <SidebarContent />
        <button onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-primary hover:border-primary transition-all text-text-muted hover:text-white z-10">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-surface border-r border-border z-50 flex flex-col">
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-surface/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-text-muted hover:text-text-primary">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <Shield className="w-5 h-5 text-primary" />
              <span className="font-bold gradient-text text-sm">DETECTAI</span>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-sm text-text-muted">
              <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
              All systems operational
            </div>
          </div>
          <UserDropdown user={user} signOut={signOut} />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
