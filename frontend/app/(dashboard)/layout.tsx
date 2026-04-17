'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Image as ImageIcon, Video, Music, FileText, Globe,
  Layers, Clock, User, Settings, ChevronLeft,
  ChevronRight, Menu, BarChart2, LogOut, ChevronDown, MessageSquare, Zap, Star
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { AuthGuard } from '@/components/AuthGuard'
import { MobileNav } from '@/components/MobileNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const navGroups = [
  {
    label: 'Detection',
    items: [
      { href: '/dashboard',     icon: 'LayoutDashboard', label: 'Overview'      },
      { href: '/detect/image',  icon: 'ImageIcon',       label: 'Image'         },
      { href: '/detect/video',  icon: 'Video',           label: 'Video'         },
      { href: '/detect/audio',  icon: 'Music',           label: 'Audio'         },
      { href: '/detect/text',   icon: 'FileText',        label: 'Text'          },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/chat',     icon: 'MessageSquare', label: 'AI Assistant'  },
      { href: '/scraper',  icon: 'Globe',         label: 'Web Scanner'   },
      { href: '/batch',    icon: 'Layers',        label: 'Batch Scan'    },
      { href: '/history',  icon: 'Clock',         label: 'History'       },
      { href: '/dashboard#analytics', icon: 'BarChart2', label: 'Analytics' },
    ],
  },
  {
    label: 'Info',
    items: [
      { href: '/reviews', icon: 'Star', label: 'Reviews'     },
      { href: '/pricing', icon: 'Zap',  label: 'Free Access' },
    ],
  },
]

const iconMap: Record<string, any> = {
  LayoutDashboard, ImageIcon, Video, Music, FileText, Globe,
  Layers, Clock, BarChart2, User, Settings, MessageSquare, Zap, Star,
}

const ACCOUNT_ITEMS = [
  { href: '/profile',  icon: 'User',     label: 'Profile'  },
  { href: '/settings', icon: 'Settings', label: 'Settings' },
]

function UserAvatar({ user, size = 9 }: { user: any; size?: number }) {
  const initials = user?.displayName
    ? user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U'
  if (user?.photoURL) {
    return (
      <img src={user.photoURL} alt={initials}
        className={`w-${size} h-${size} rounded-full object-cover ring-2 ring-primary/40 flex-shrink-0`}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
    )
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-primary/40 flex-shrink-0 select-none`}>
      {initials}
    </div>
  )
}

// ── Sidebar — extracted as module-level component (fixes BUG-02) ─────────────
interface SidebarProps {
  user: any
  signOut: () => void
  collapsed: boolean
  pathname: string
  onNavClick: () => void
}

function Sidebar({ user, signOut, collapsed, pathname, onNavClick }: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <Link href="/"
        className={`flex items-center gap-3 px-4 py-5 border-b border-border hover:opacity-80 transition-opacity ${collapsed ? 'justify-center' : ''}`}>
        <Image src="/logo.png" alt="Aiscern" width={36} height={25}
          className="object-contain drop-shadow-[0_0_6px_rgba(245,100,0,0.5)] flex-shrink-0" />
        {!collapsed && <span className="text-lg font-black gradient-text">Aiscern</span>}
      </Link>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-xs font-semibold text-text-disabled uppercase tracking-widest px-3 mb-2">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map(item => {
                const Icon = iconMap[item.icon]
                if (!Icon) return null
                const active = pathname === item.href ||
                  (item.href !== '/dashboard' && !item.href.includes('#') && pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href} onClick={onNavClick}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
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

        {/* Account section — always visible, icon-only when collapsed (fixes BUG-16) */}
        <div>
          {!collapsed && (
            <p className="text-xs font-semibold text-text-disabled uppercase tracking-widest px-3 mb-2">
              Account
            </p>
          )}
          <div className="space-y-1">
            {ACCOUNT_ITEMS.map(item => {
              const Icon = iconMap[item.icon]
              if (!Icon) return null
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} onClick={onNavClick}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                    ${active ? 'bg-primary/15 text-primary border-l-2 border-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'}
                    ${collapsed ? 'justify-center' : ''}`}>
                  <Icon className={`w-5 h-5 ${active ? 'text-primary' : ''}`} />
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-surface-hover transition-colors">
            <UserAvatar user={user} size={8} />
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
          <button onClick={signOut} title="Sign out"
            className="w-full flex justify-center py-2 text-text-muted hover:text-rose transition-colors rounded-xl hover:bg-rose/10">
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}

function UserDropdown({ user, signOut }: { user: any; signOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const name  = user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = user?.email || ''

  const menuContent = (
    <>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-surface-active">
        <UserAvatar user={user} size={11} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-text-primary truncate">{name}</p>
          <p className="text-xs text-text-muted truncate">{email}</p>
          <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-emerald bg-emerald/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
            Active
          </span>
        </div>
      </div>
      <div className="p-2 space-y-0.5">
        {[
          { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'    },
          { href: '/profile',   icon: User,            label: 'My Profile'   },
          { href: '/settings',  icon: Settings,        label: 'Settings'     },
          { href: '/history',   icon: Clock,           label: 'Scan History' },
        ].map(item => (
          <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-surface-hover transition-colors text-sm text-text-secondary hover:text-text-primary">
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
      <div className="p-2 border-t border-border">
        <button onClick={() => { setOpen(false); signOut() }}
          className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-rose/10 transition-colors text-sm text-text-muted hover:text-rose w-full">
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-surface-hover transition-colors">
        <UserAvatar user={user} size={9} />
        <div className="hidden sm:block text-left min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate max-w-[120px]">{name}</p>
          <p className="text-xs text-text-muted truncate max-w-[120px]">{email}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Desktop dropdown */}
          <div className="hidden sm:block absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 z-[200] overflow-hidden">
            {menuContent}
          </div>
          {/* Mobile full-screen bottom sheet */}
          <div className="sm:hidden fixed inset-0 z-[200]" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-3xl border-t border-border overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              {menuContent}
              <div style={{ height: 'max(1rem, env(safe-area-inset-bottom))' }} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Desktop sidebar */}
        <motion.aside animate={{ width: collapsed ? 72 : 260 }} transition={{ duration: 0.3 }}
          className="hidden lg:flex flex-col bg-surface border-r border-border relative flex-shrink-0">
          <Sidebar
            user={user} signOut={signOut}
            collapsed={collapsed} pathname={pathname}
            onNavClick={() => setMobileOpen(false)}
          />
          <button onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-primary hover:border-primary transition-all text-text-muted hover:text-white z-10">
            {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        </motion.aside>

        {/* Mobile sidebar drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMobileOpen(false)} />
              <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-surface border-r border-border z-50 flex flex-col">
                <Sidebar
                  user={user} signOut={signOut}
                  collapsed={false} pathname={pathname}
                  onNavClick={() => setMobileOpen(false)}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 sm:h-16 border-b border-border flex items-center justify-between px-3 sm:px-4 lg:px-6 bg-surface/50 flex-shrink-0 backdrop-blur-sm sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden text-text-muted hover:text-text-primary">
                <Menu className="w-6 h-6" />
              </button>
              <Link href="/" className="flex items-center gap-2 lg:hidden hover:opacity-80 transition-opacity">
                <Image src="/logo.png" alt="Aiscern" width={28} height={19} className="object-contain drop-shadow-[0_0_6px_rgba(245,100,0,0.5)]" />
                <span className="font-bold gradient-text text-sm">Aiscern</span>
              </Link>
              <div className="hidden lg:flex items-center gap-2 text-sm text-text-muted">
                <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
                All systems operational
              </div>
            </div>
            <UserDropdown user={user} signOut={signOut} />
          </header>

          <ErrorBoundary>
            {/* BUG-05 fixed: pb-safe → env(safe-area-inset-bottom) */}
            <main className="flex-1 overflow-y-auto min-h-0"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              <div className="min-h-full pb-16 lg:pb-0">{children}</div>
            </main>
          </ErrorBoundary>
        </div>
      </div>
      <MobileNav />
    </AuthGuard>
  )
}
