'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Image as ImageIcon, Video, Music, FileText,
  Globe, Layers, Clock, User, Settings, ChevronLeft, ChevronRight,
  Menu, BarChart3, LogOut, ChevronDown, MessageSquare, Zap, Star,
  X, Coins,
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { AuthGuard } from '@/components/AuthGuard'
import { MobileNav } from '@/components/MobileNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { UpgradeNotificationProvider } from '@/components/UpgradeNotification'
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
      { href: '/chat',    icon: MessageSquare, label: 'AI Assistant' },
      { href: '/batch',   icon: Layers,        label: 'Batch Scan'  },
      { href: '/scraper', icon: Globe,         label: 'Web Scanner' },
      { href: '/history', icon: Clock,         label: 'History'     },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/profile',  icon: User,     label: 'Profile'  },
      { href: '/credits',  icon: Coins,    label: 'Credits'  },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

function UserAvatar({ user, size = 8 }: { user: any; size?: number }) {
  const initials = (user?.displayName?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2))
    || user?.email?.[0]?.toUpperCase() || 'U'
  const avatarUrl = user?.imageUrl || user?.photoURL
  const cls = { 7: 'w-7 h-7', 8: 'w-8 h-8', 9: 'w-9 h-9', 10: 'w-10 h-10', 11: 'w-11 h-11' }[size] ?? 'w-8 h-8'
  if (avatarUrl) {
    return <img src={avatarUrl} alt={initials}
      className={`${cls} rounded-full object-cover ring-1 ring-[#2BEE34]/30 flex-shrink-0`}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
  }
  return (
    <div className={`${cls} rounded-full bg-[#2BEE34]/10 border border-[#2BEE34]/20 flex items-center justify-center text-[#2BEE34] font-bold text-sm flex-shrink-0 select-none`}>
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
        className={`flex items-center gap-3 px-4 h-16 border-b border-[#1E1E1E] hover:text-white transition-colors flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <span className={`font-black text-white tracking-tight ${collapsed ? 'text-lg' : 'text-xl'} hover:text-[#2BEE34] transition-colors`}>
          {collapsed ? 'A' : 'Aiscern'}
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-[#6B6B6B] uppercase tracking-[0.08em] px-3 mb-1.5">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname === item.href ||
                  (item.href !== '/dashboard' && !item.href.includes('#') && pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href} onClick={onNavClick}
                    prefetch={['/chat', '/scraper', '/batch'].includes(item.href) ? false : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                      active
                        ? 'bg-[#2BEE34]/10 text-[#2BEE34] border-l-2 border-[#2BEE34]'
                        : 'text-[#A3A3A3] hover:text-white hover:bg-[#1A1A1A]'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {/* Recent chats subsection */}
        {!collapsed && chatPreviews.length > 0 && pathname.startsWith('/chat') && (
          <div>
            <button onClick={() => setChatOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-[#6B6B6B] uppercase tracking-[0.08em]">
              Recent Chats
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${chatOpen ? '' : '-rotate-90'}`} />
            </button>
            {chatOpen && (
              <div className="space-y-0.5 mt-0.5">
                {chatPreviews.map(chat => (
                  <button key={chat.id}
                    onClick={() => { onChatSelect(chat.id); onNavClick() }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#6B6B6B] hover:bg-[#1A1A1A] hover:text-white transition-all text-left">
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
      <div className="border-t border-[#1E1E1E] p-2 flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[#1A1A1A] transition-colors">
            <UserAvatar user={user} size={8} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#E5E5E5] truncate">{name}</p>
              <p className="text-[10px] text-[#2BEE34] font-medium">● Online</p>
            </div>
            <button onClick={signOut} title="Sign out"
              className="text-[#6B6B6B] hover:text-[#FF4444] transition-colors p-1 rounded-lg hover:bg-[#FF4444]/10">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={signOut} title="Sign out"
            className="w-full flex justify-center py-2 text-[#6B6B6B] hover:text-[#FF4444] transition-colors rounded-lg hover:bg-[#FF4444]/10">
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
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#1A1A1A] transition-colors">
        <UserAvatar user={user} size={8} />
        <div className="hidden sm:block text-left min-w-0">
          <p className="text-sm font-semibold text-white truncate max-w-[120px]">{name}</p>
          <p className="text-xs text-[#6B6B6B] truncate max-w-[120px]">{email}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#6B6B6B] transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 z-50
                        bg-[#141414] border border-[#1E1E1E] rounded-xl
                        shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden animate-slide-up">
          {/* Profile header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1E1E1E] bg-[#0A0A0A]">
            <UserAvatar user={user} size={11} />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white truncate text-sm">{name}</p>
              <p className="text-xs text-[#6B6B6B] truncate">{email}</p>
              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-[#2BEE34] bg-[#2BEE34]/10 px-2 py-0.5 rounded-full border border-[#2BEE34]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2BEE34]" /> Active
              </span>
            </div>
          </div>
          {/* Menu items */}
          <div className="p-1.5">
            {MENU.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1A1A1A] transition-colors text-sm text-[#A3A3A3] hover:text-white">
                <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
          <div className="p-1.5 border-t border-[#1E1E1E]">
            <button onClick={() => { setOpen(false); signOut() }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#FF4444]/10 transition-colors text-sm text-[#6B6B6B] hover:text-[#FF4444] w-full">
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut }               = useAuth()
  const [collapsed, setCollapsed]       = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
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

  return (
    <AuthGuard>
      <div className="flex h-[100dvh] bg-[#0A0A0A] overflow-hidden">

        {/* Desktop sidebar — CSS width transition, no Framer */}
        <aside
          style={{ width: collapsed ? 72 : 260 }}
          className="hidden lg:flex flex-col bg-[#141414] border-r border-[#1E1E1E] relative flex-shrink-0 transition-[width] duration-200 ease-out"
        >
          <Sidebar
            user={user} signOut={signOut} collapsed={collapsed} pathname={pathname}
            onNavClick={() => {}} chatPreviews={chatPreviews} onChatSelect={handleChatSelect}
          />
          {/* Collapse toggle */}
          <button onClick={() => setCollapsed(c => !c)}
            className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-[#141414] border border-[#2A2A2A]
                       flex items-center justify-center text-[#6B6B6B]
                       hover:text-[#2BEE34] hover:border-[#2BEE34]/40 transition-all z-10">
            {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-[#0A0A0A]/80" onClick={() => setMobileOpen(false)} />
            {/* Drawer */}
            <aside className="relative w-72 bg-[#141414] border-r border-[#1E1E1E] flex flex-col animate-slide-up">
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
          <header className="h-14 sm:h-16 border-b border-[#1E1E1E] flex items-center justify-between
                             px-3 sm:px-4 lg:px-6 bg-[#141414] flex-shrink-0 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg text-[#A3A3A3] hover:text-white hover:bg-[#1A1A1A] transition-all"
                aria-label="Open navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
              <Link href="/" className="flex items-center gap-2 lg:hidden hover:text-white transition-colors">
                <span className="font-black text-white text-sm tracking-tight hover:text-[#2BEE34] transition-colors">Aiscern</span>
              </Link>
              {/* Status pill — desktop */}
              <div className="hidden lg:flex items-center gap-2 text-xs text-[#6B6B6B]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2BEE34]" />
                All systems operational
              </div>
            </div>
            <UserDropdown user={user} signOut={signOut} />
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

      <MobileNav />
      <OnboardingWizard />
      <UpgradeNotificationProvider />
    </AuthGuard>
  )
}
