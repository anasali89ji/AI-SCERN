'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Image as ImageIcon, Video, Music, FileText,
  Globe, Layers, Clock, User, Settings, ChevronLeft, ChevronRight,
  Menu, LogOut, ChevronDown, MessageSquare, Star,
  Coins, Search, Bell, ChevronRight as ChevronRightSmall,
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { AuthGuard } from '@/components/AuthGuard'
import { MobileNav } from '@/components/MobileNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { UpgradeNotificationProvider } from '@/components/UpgradeNotification'
import { CommandPalette } from '@/components/dashboard/CommandPalette'
import dynamic from 'next/dynamic'

const OnboardingWizard = dynamic(
  () => import('@/components/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })),
  { ssr: false },
)

const CHAT_STORAGE_KEY = 'aiscern_chats_v2'
interface ChatPreview { id: string; title: string; updatedAt: string }

function loadChatPreviews(): ChatPreview[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c: any) => c?.id && c?.title)
      .map((c: any) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt || '' }))
      .slice(0, 8)
  } catch { return [] }
}

const NAV_GROUPS = [
  {
    label: 'Detect',
    items: [
      { href: '/dashboard',    icon: LayoutDashboard, label: 'Overview'  },
      { href: '/detect/text',  icon: FileText,        label: 'Text'      },
      { href: '/detect/image', icon: ImageIcon,       label: 'Image'     },
      { href: '/detect/audio', icon: Music,           label: 'Audio'     },
      { href: '/detect/video', icon: Video,           label: 'Video'     },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/chat',     icon: MessageSquare, label: 'AI Assistant' },
      { href: '/batch',    icon: Layers,        label: 'Batch Scan'   },
      { href: '/scraper',  icon: Globe,         label: 'Web Scanner'  },
      { href: '/pipeline', icon: Layers,        label: 'Pipeline'     },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/history',  icon: Clock,    label: 'History'  },
      { href: '/credits',  icon: Coins,    label: 'Credits'  },
      { href: '/profile',  icon: User,     label: 'Profile'  },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

const LABEL_OVERRIDES: Record<string, string> = {
  dashboard: 'Overview', detect: 'Detect', text: 'Text', image: 'Image',
  audio: 'Audio', video: 'Video', chat: 'AI Assistant', batch: 'Batch Scan',
  scraper: 'Web Scanner', pipeline: 'Pipeline', history: 'History',
  credits: 'Credits', profile: 'Profile', settings: 'Settings',
}

function useBreadcrumb(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs = segments.map((seg, i) => ({
    label: LABEL_OVERRIDES[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
    href: '/' + segments.slice(0, i + 1).join('/'),
  }))
  return [{ label: 'Home', href: '/dashboard' }, ...crumbs]
}

function UserAvatar({ user, size = 8 }: { user: any; size?: number }) {
  const initials = (user?.displayName?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2))
    || user?.email?.[0]?.toUpperCase() || 'U'
  const avatarUrl = user?.imageUrl || user?.photoURL
  const cls = { 7: 'w-7 h-7', 8: 'w-8 h-8', 9: 'w-9 h-9', 10: 'w-10 h-10', 11: 'w-11 h-11' }[size] ?? 'w-8 h-8'
  if (avatarUrl) {
    return <img src={avatarUrl} alt={initials}
      className={`${cls} rounded-full object-cover ring-1 ring-accent/30 flex-shrink-0`}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
  }
  return (
    <div className={`${cls} rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0 select-none`}>
      {initials}
    </div>
  )
}

interface SidebarProps {
  user: any; signOut: () => void; collapsed: boolean
  pathname: string; onNavClick: () => void
  chatPreviews: ChatPreview[]; onChatSelect: (id: string) => void
}

function Sidebar({ user, signOut, collapsed, pathname, onNavClick, chatPreviews, onChatSelect }: SidebarProps) {
  const [chatOpen, setChatOpen] = useState(true)
  const name = user?.displayName || user?.email?.split('@')[0] || 'User'

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <Link href="/"
        className={`flex items-center gap-3 px-4 h-16 border-b border-white/5 hover:text-silver-900 transition-colors duration-300 flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <span className={`font-black text-silver-900 tracking-tight ${collapsed ? 'text-lg' : 'text-xl'} hover:text-accent transition-colors duration-300`}>
          {collapsed ? 'A' : 'Aiscern'}
        </span>
      </Link>

      {/* Nav — custom scrollbar via globals.css .scrollbar-thin utility */}
      <nav className="flex-1 px-2 py-3 space-y-5 overflow-y-auto scrollbar-thin">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-silver-600 uppercase tracking-[0.08em] px-3 mb-1.5">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname === item.href ||
                  (item.href !== '/dashboard' && !item.href.includes('#') && pathname.startsWith(item.href))
                return (
                  <div key={item.href} className="relative group/navitem">
                    <Link href={item.href} onClick={onNavClick}
                      prefetch={['/chat', '/scraper', '/batch'].includes(item.href) ? false : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${
                        active
                          ? 'bg-accent/10 text-accent border-r-2 border-accent rounded-r-lg'
                          : 'text-silver-700 hover:text-silver-900 hover:bg-white/5'
                      } ${collapsed ? 'justify-center' : ''}`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                      {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                    </Link>
                    {/* Rail-mode tooltip (Module 6.1) */}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-40
                                       whitespace-nowrap bg-surface-elevated border border-white/5 text-silver-900 text-xs
                                       px-2 py-1 rounded-md opacity-0 group-hover/navitem:opacity-100
                                       transition-opacity duration-300">
                        {item.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Recent chats subsection */}
        {!collapsed && chatPreviews.length > 0 && pathname.startsWith('/chat') && (
          <div className="px-3 pb-2">
            <button onClick={() => setChatOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-silver-600 uppercase tracking-[0.08em]">
              Recent Chats
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${chatOpen ? '' : '-rotate-90'}`} />
            </button>
            {chatOpen && (
              <div className="space-y-0.5 mt-0.5">
                {chatPreviews.map(chat => (
                  <button key={chat.id}
                    onClick={() => { onChatSelect(chat.id); onNavClick() }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-silver-600 hover:bg-white/5 hover:text-silver-900 transition-all duration-300 text-left">
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                    <span className="text-xs truncate flex-1">{chat.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/5 p-2 flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors duration-300">
            <UserAvatar user={user} size={8} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-silver-800 truncate">{name}</p>
              <p className="text-[10px] text-accent font-medium">● Online</p>
            </div>
            <button onClick={signOut} title="Sign out"
              className="text-silver-600 hover:text-rose-400 transition-colors duration-300 p-1 rounded-lg hover:bg-rose-500/10">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={signOut} title="Sign out"
            className="w-full flex justify-center py-2 text-silver-600 hover:text-rose-400 transition-colors duration-300 rounded-lg hover:bg-rose-500/10">
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
  const name  = user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = user?.email || ''

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc   = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    if (open) { document.addEventListener('mousedown', close); document.addEventListener('keydown', esc) }
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const MENU = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'    },
    { href: '/profile',   icon: User,            label: 'My Profile'   },
    { href: '/settings',  icon: Settings,        label: 'Settings'     },
    { href: '/credits',   icon: Coins,           label: 'Credits'      },
    { href: '/history',   icon: Clock,           label: 'Scan History' },
  ]

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors duration-300">
        <UserAvatar user={user} size={8} />
        <div className="hidden sm:block text-left min-w-0">
          <p className="text-sm font-semibold text-silver-900 truncate max-w-[120px]">{name}</p>
          <p className="text-xs text-silver-600 truncate max-w-[120px]">{email}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-silver-600 transition-transform duration-300 hidden sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 z-50
                        bg-surface border border-white/5 rounded-xl
                        shadow-deep overflow-hidden animate-slide-up">
          {/* Profile header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5 bg-surface-deep">
            <UserAvatar user={user} size={11} />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-silver-900 truncate text-sm">{name}</p>
              <p className="text-xs text-silver-600 truncate">{email}</p>
              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Active
              </span>
            </div>
          </div>
          {/* Menu items */}
          <div className="p-1.5">
            {MENU.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors duration-300 text-sm text-silver-700 hover:text-silver-900">
                <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
          <div className="p-1.5 border-t border-white/5">
            <button onClick={() => { setOpen(false); signOut() }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-rose-500/10 transition-colors duration-300 text-sm text-silver-600 hover:text-rose-400 w-full">
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface NotificationItem { id: string; title: string; message: string; created_at: string }

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/notifications').then(r => r.ok ? r.json() : { notifications: [] })
      .then(d => setItems(Array.isArray(d.notifications) ? d.notifications : []))
      .catch(() => setItems([]))
  }, [])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    if (open) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const markAllRead = useCallback(async () => {
    if (items.length === 0) return
    setItems([])
    try { await fetch('/api/notifications', { method: 'PATCH', body: JSON.stringify({ id: 'all' }) }) } catch { /* non-fatal */ }
  }, [items.length])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-label="Notifications"
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-silver-600 hover:text-silver-900 hover:bg-white/5 transition-all duration-300">
        <Bell className="w-4.5 h-4.5" />
        {items.length > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 z-50 bg-surface border border-white/5 rounded-xl shadow-deep overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-silver-900">Notifications</span>
            {items.length > 0 && (
              <button onClick={markAllRead} className="text-xs text-accent hover:text-accent-hover transition-colors duration-300">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto scrollbar-thin">
            {items.length === 0 ? (
              <p className="text-sm text-silver-600 text-center py-8">You&apos;re all caught up.</p>
            ) : items.map(n => (
              <div key={n.id} className="px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors duration-300">
                <p className="text-sm font-medium text-silver-900">{n.title}</p>
                <p className="text-xs text-silver-600 mt-0.5 line-clamp-2">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CreditPill() {
  const [balance, setBalance] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/user/stats').then(r => r.ok ? r.json() : Promise.resolve({} as { credits_remaining?: number }))
      .then(d => setBalance(typeof d.credits_remaining === 'number' ? d.credits_remaining : null))
      .catch(() => setBalance(null))
  }, [])
  if (balance === null) return null
  return (
    <Link href="/credits"
      className="hidden sm:flex items-center gap-1.5 bg-accent/10 text-accent rounded-full px-3 py-1 text-xs font-medium hover:bg-accent/20 transition-colors duration-300">
      <Star className="w-3 h-3" />
      {balance.toLocaleString()}
    </Link>
  )
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const crumbs = useBreadcrumb(pathname)
  return (
    <nav aria-label="Breadcrumb" className="hidden lg:flex items-center gap-1.5 text-sm min-w-0">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={c.href} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRightSmall className="w-3.5 h-3.5 text-silver-600 flex-shrink-0" />}
            {isLast ? (
              <span className="text-silver-900 font-medium truncate">{c.label}</span>
            ) : (
              <Link href={c.href} className="text-silver-600 hover:text-silver-900 transition-colors duration-300 truncate">
                {c.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut }               = useAuth()
  const [collapsed, setCollapsed]       = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [paletteOpen, setPaletteOpen]   = useState(false)
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([])
  const pathname                        = usePathname()
  const router                          = useRouter()

  useEffect(() => {
    setChatPreviews(loadChatPreviews())
    const onStorage = () => setChatPreviews(loadChatPreviews())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [pathname])

  const handleChatSelect = useCallback((chatId: string) => {
    router.push(`/chat#${chatId}`)
    setMobileOpen(false)
  }, [router])

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Lock body scroll when mobile nav is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Cmd+K / Ctrl+K opens the global command palette (Module 6.2)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <AuthGuard>
      <div className="flex h-[100dvh] bg-surface-deep overflow-hidden">

        {/* Desktop sidebar — CSS width transition, no Framer */}
        <aside
          style={{ width: collapsed ? 72 : 260 }}
          className="hidden lg:flex flex-col bg-surface border-r border-white/5 relative flex-shrink-0 transition-[width] duration-300 ease-out"
        >
          <Sidebar
            user={user} signOut={signOut} collapsed={collapsed} pathname={pathname}
            onNavClick={() => {}} chatPreviews={chatPreviews} onChatSelect={handleChatSelect}
          />
          {/* Collapse toggle */}
          <button onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface border border-white/10
                       flex items-center justify-center text-silver-600
                       hover:text-accent hover:border-accent/40 transition-all duration-300 z-10">
            {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-surface-deep/80" onClick={() => setMobileOpen(false)} />
            {/* Drawer */}
            <aside className="relative w-72 bg-surface border-r border-white/5 flex flex-col animate-slide-up">
              <Sidebar
                user={user} signOut={signOut} collapsed={false} pathname={pathname}
                onNavClick={() => setMobileOpen(false)} chatPreviews={chatPreviews} onChatSelect={handleChatSelect}
              />
            </aside>
          </div>
        )}

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top header */}
          <header className="h-14 sm:h-16 border-b border-white/5 flex items-center justify-between gap-3
                             px-3 sm:px-4 lg:px-6 bg-surface flex-shrink-0 sticky top-0 z-30">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg text-silver-700 hover:text-silver-900 hover:bg-white/5 transition-all duration-300"
                aria-label="Open navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
              <Link href="/" className="flex items-center gap-2 lg:hidden hover:text-silver-900 transition-colors duration-300">
                <span className="font-black text-silver-900 text-sm tracking-tight hover:text-accent transition-colors duration-300">Aiscern</span>
              </Link>
              <Breadcrumb pathname={pathname} />
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Global search trigger (Cmd+K) */}
              <button onClick={() => setPaletteOpen(true)}
                className="hidden sm:flex items-center gap-2 bg-surface-deep border border-white/5 rounded-lg px-3 py-1.5 text-silver-600 text-sm hover:border-white/10 hover:text-silver-800 transition-all duration-300">
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
                <kbd className="ml-1 text-[10px] font-semibold text-silver-600 bg-surface border border-white/10 px-1.5 py-0.5 rounded">⌘K</kbd>
              </button>
              <button onClick={() => setPaletteOpen(true)} aria-label="Search"
                className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg text-silver-600 hover:text-silver-900 hover:bg-white/5 transition-all duration-300">
                <Search className="w-4 h-4" />
              </button>

              <CreditPill />
              <NotificationBell />
              <UserDropdown user={user} signOut={signOut} />
            </div>
          </header>

          <ErrorBoundary>
            <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
              <div className="min-h-full pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
                {children}
              </div>
            </main>
          </ErrorBoundary>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <MobileNav />
      <OnboardingWizard />
      <UpgradeNotificationProvider />
    </AuthGuard>
  )
}
