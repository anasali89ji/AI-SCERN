'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import {
  LayoutDashboard, Image as ImageIcon, Video, Music, FileText, Globe,
  Layers, Clock, User, Settings, ChevronLeft,
  ChevronRight, Menu, BarChart2, LogOut, ChevronDown, MessageSquare, Zap, Star
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { AuthGuard } from '@/components/AuthGuard'
import { MobileNav } from '@/components/MobileNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { UpgradeNotificationProvider } from '@/components/UpgradeNotification'

// ── Lazy-loaded modals — not needed until after first render ──────────────────
const OnboardingWizard = dynamic(
  () => import('@/components/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })),
  { ssr: false }
)

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
  // BUG-08 FIX: Static class strings — Tailwind JIT cannot analyze template literals
  const sizeClass = size === 11 ? 'w-11 h-11' : size === 9 ? 'w-9 h-9' : size === 8 ? 'w-8 h-8' : 'w-7 h-7'
  // BUG-13 FIX: Standardize on Clerk's imageUrl field (photoURL was Firebase naming)
  const avatarUrl = user?.imageUrl || user?.photoURL
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={initials}
        className={`${sizeClass} rounded-full object-cover ring-1 ring-blue-500/30 flex-shrink-0`}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
    )
  }
  return (
    <div className={`${sizeClass} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm ring-1 ring-blue-500/30 flex-shrink-0 select-none`}>
      {initials}
    </div>
  )
}

// ── Chat history helpers (reads same localStorage key as chat page) ─────────────
const CHAT_STORAGE_KEY = 'aiscern_chats_v2'

interface ChatPreview { id: string; title: string; updatedAt: string }

function loadChatPreviews(): ChatPreview[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((c: any) => c?.id && c?.title)
      .map((c: any) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt || '' }))
      .slice(0, 8) // show max 8 recent chats
  } catch { return [] }
}

// ── Sidebar — extracted as module-level component (fixes BUG-02) ─────────────
interface SidebarProps {
  user: any
  signOut: () => void
  collapsed: boolean
  pathname: string
  onNavClick: () => void
  chatPreviews: ChatPreview[]
  onChatSelect: (id: string) => void
}

function Sidebar({ user, signOut, collapsed, pathname, onNavClick, chatPreviews, onChatSelect }: SidebarProps) {
  const [historyOpen, setHistoryOpen] = useState(true)
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <Link href="/"
        className={`flex items-center gap-3 px-4 py-5 border-b border-white/[0.08] hover:text-white transition-colors ${collapsed ? 'justify-center' : ''}`}>
        <Image src="/logo.png" alt="Aiscern" width={36} height={36}
          className="object-contain flex-shrink-0" />
        {!collapsed && <span className="text-lg font-black gradient-text">Aiscern</span>}
      </Link>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">
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
                    prefetch={['/chat','/scraper','/batch'].includes(item.href) ? false : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                      ${active ? 'bg-blue-600/15 text-blue-400 border-l-2 border-blue-500' : 'text-slate-500 hover:bg-[#141420] hover:text-slate-100'}
                      ${collapsed ? 'justify-center' : ''}`}>
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-400' : ''}`} />
                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {/* ARIA Chat History — collapsible subsection */}
        {!collapsed && chatPreviews.length > 0 && pathname.startsWith('/chat') && (
          <div>
            <button
              onClick={() => setHistoryOpen(h => !h)}
              className="w-full flex items-center justify-between px-3 py-1.5 group"
            >
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Recent Chats</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform duration-200 ${historyOpen ? 'rotate-0' : '-rotate-90'}`} />
            </button>
            {historyOpen && (
              <div className="space-y-0.5 mt-0.5">
                {chatPreviews.map(chat => (
                  <button key={chat.id}
                    onClick={() => { onChatSelect(chat.id); onNavClick() }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:bg-[#141420] hover:text-slate-100 transition-all text-left"
                  >
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                    <span className="text-xs truncate flex-1">{chat.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Account section — always visible, icon-only when collapsed (fixes BUG-16) */}
        <div>
          {!collapsed && (
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">
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
                  prefetch={['/chat','/scraper','/batch'].includes(item.href) ? false : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                    ${active ? 'bg-blue-600/15 text-blue-400 border-l-2 border-blue-500' : 'text-slate-500 hover:bg-[#141420] hover:text-slate-100'}
                    ${collapsed ? 'justify-center' : ''}`}>
                  <Icon className={`w-5 h-5 ${active ? 'text-blue-400' : ''}`} />
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-white/[0.08] p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[#141420] transition-colors">
            <UserAvatar user={user} size={8} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-400 truncate">
                {user?.displayName || user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-[10px] text-emerald-400-400 font-medium">&#x25CF; Online</p>
            </div>
            <button onClick={signOut} title="Sign out"
              className="text-slate-500 hover:text-rose-400 transition-colors p-1 rounded-lg hover:bg-rose-500-500/10">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={signOut} title="Sign out"
            className="w-full flex justify-center py-2 text-slate-500 hover:text-rose-400 transition-colors rounded-xl hover:bg-rose-500-500/10">
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
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.08] bg-[#141420]">
        <UserAvatar user={user} size={11} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-100 truncate">{name}</p>
          <p className="text-xs text-slate-500 truncate">{email}</p>
          <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-emerald-400-400 bg-emerald-500-500/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500-500" />
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
            className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#141420] transition-colors text-sm text-slate-400 hover:text-slate-100">
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
      <div className="p-2 border-t border-white/[0.08]">
        <button onClick={() => { setOpen(false); signOut() }}
          className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-rose-500-500/10 transition-colors text-sm text-slate-500 hover:text-rose-400 w-full">
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[#141420] transition-colors">
        <UserAvatar user={user} size={9} />
        <div className="hidden sm:block text-left min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate max-w-[120px]">{name}</p>
          <p className="text-xs text-slate-500 truncate max-w-[120px]">{email}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Desktop dropdown */}
      
        {open && (
          <div>
            {menuContent}
          </div>
        )}
      

      {/* Mobile full-screen bottom sheet */}
      
        {open && (
          <div className="sm:hidden fixed inset-0 z-[200]" onClick={() => setOpen(false)}>
            <div>
            <div> e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              {/* Scrollable content — prevents overflow on short phones */}
              <div
                className="overflow-y-auto"
                style={{ maxHeight: 'calc(85dvh - 4rem)' }}
              >
                {menuContent}
              </div>
              {/* Space above MobileNav: 4rem (nav) + safe area */}
              <div style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }} />
            </div>
          </div>
        )}
      
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([])
  const pathname = usePathname()
  const router = useRouter()

  // Load chat previews from localStorage, refresh when on chat page
  useEffect(() => {
    setChatPreviews(loadChatPreviews())
    // Also refresh on storage changes (when chat page saves)
    const onStorage = () => setChatPreviews(loadChatPreviews())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [pathname])

  const handleChatSelect = useCallback((chatId: string) => {
    // Navigate to chat and pass selected chat id via URL hash
    router.push(`/chat#${chatId}`)
    setMobileOpen(false)
  }, [router])

  return (
    <AuthGuard>
      <div className="flex h-[100dvh] bg-[#08080d] overflow-hidden">
        {/* Desktop sidebar */}
        <motion.aside animate={{ width: collapsed ? 72 : 260 }}
          transition={{ type: 'tween', duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="hidden lg:flex flex-col bg-[#0f0f17] border-r border-white/[0.08] relative flex-shrink-0 2xl:!w-[280px]" style={collapsed ? { width: 72 } : undefined}>
          <Sidebar
            user={user} signOut={signOut}
            collapsed={collapsed} pathname={pathname}
            onNavClick={() => setMobileOpen(false)}
            chatPreviews={chatPreviews}
            onChatSelect={handleChatSelect}
          />
          <button onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-[#0f0f17] border border-white/[0.08] flex items-center justify-center hover:bg-blue-700 hover:border-blue-500/50 transition-all text-slate-500 hover:text-white z-10">
            {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        </motion.aside>

        {/* Mobile sidebar drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <div onClick={() => setMobileOpen(false)} />
              <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'tween', duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-[#0f0f17] border-r border-white/[0.08] z-50 flex flex-col">
                <Sidebar
                  user={user} signOut={signOut}
                  collapsed={false} pathname={pathname}
                  onNavClick={() => setMobileOpen(false)}
                  chatPreviews={chatPreviews}
                  onChatSelect={handleChatSelect}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 sm:h-16 2xl:h-18 border-b border-white/[0.06] flex items-center justify-between px-3 sm:px-4 lg:px-6 2xl:px-8 bg-[#0f0f17] flex-shrink-0 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-100">
                <Menu className="w-6 h-6" />
              </button>
              <Link href="/" className="flex items-center gap-2 lg:hidden hover:text-white transition-colors">
                <Image src="/logo.png" alt="Aiscern" width={28} height={28} className="object-contain" />
                <span className="font-bold gradient-text text-sm">Aiscern</span>
              </Link>
              <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                All systems operational
              </div>
            </div>
            <UserDropdown user={user} signOut={signOut} />
          </header>

          <ErrorBoundary>
            <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
              {/* pb clears the MobileNav (4rem) + safe area on mobile; desktop has no nav */}
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
