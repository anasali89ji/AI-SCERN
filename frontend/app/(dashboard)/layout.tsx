'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useUser } from '@clerk/nextjs'
import {
  LayoutDashboard, Image as ImageIcon, Video, Music, FileText, Globe, Globe2,
  Layers, Clock, User, Settings, ChevronLeft, GitBranch,
  ChevronRight, Menu, BarChart2, LogOut, ChevronDown, MessageSquare, Zap, Star
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { AuthGuard } from '@/components/AuthGuard'
import { MobileNav } from '@/components/MobileNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { UpgradeNotificationProvider } from '@/components/UpgradeNotification'
import { WelcomeHeader } from '@/components/dashboard/WelcomeHeader'
import { isFirstTimeUser } from '@/lib/onboarding/detect-first-run'
import { getOnboardingState } from '@/lib/onboarding/store'

// ── Lazy-loaded modals — not needed until after first render ──────────────────
const OnboardingWizard = dynamic(
  () => import('@/components/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })),
  { ssr: false }
)

const navGroups = [
  {
    label: 'Detection',
    items: [
      { href: '/dashboard',     icon: 'LayoutDashboard', label: 'Overview',      tour: 'overview' },
      { href: '/detect/image',  icon: 'ImageIcon',       label: 'Image',         tour: 'image' },
      { href: '/detect/video',  icon: 'Video',           label: 'Video'         },
      { href: '/detect/audio',  icon: 'Music',           label: 'Audio'         },
      { href: '/detect/text',   icon: 'FileText',        label: 'Text'          },
    ],
  },
  {
    label: 'Verify',
    items: [
      { href: '/verify/web', icon: 'Globe2', label: 'Website Trust' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/chat',     icon: 'MessageSquare', label: 'AI Assistant'  },
      { href: '/scraper',  icon: 'Globe',         label: 'Web Scanner'   },
      { href: '/batch',    icon: 'Layers',        label: 'Batch Scan'    },
      { href: '/workflows', icon: 'GitBranch',    label: 'Workflows'     },
      { href: '/history',  icon: 'Clock',         label: 'History',       tour: 'history' },
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
  LayoutDashboard, ImageIcon, Video, Music, FileText, Globe, Globe2,
  Layers, Clock, BarChart2, User, Settings, MessageSquare, Zap, Star, GitBranch,
}

const ACCOUNT_ITEMS = [
  { href: '/profile',  icon: 'User',     label: 'Profile'  },
  { href: '/settings', icon: 'Settings', label: 'Settings', tour: 'settings' },
]

function UserAvatar({ user, size = 9 }: { user: any; size?: number }) {
  const initials = user?.displayName
    ? user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U'
  const sizeClass = size === 11 ? 'w-11 h-11' : size === 9 ? 'w-9 h-9' : size === 8 ? 'w-8 h-8' : 'w-7 h-7'
  const avatarUrl = user?.imageUrl || user?.photoURL
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={initials}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-primary/40 flex-shrink-0`}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
    )
  }
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm ring-2 ring-primary/40 flex-shrink-0 select-none`}>
      {initials}
    </div>
  )
}

// ── Chat history helpers ─────────────────────────────────────────────────────
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
      .slice(0, 8)
  } catch { return [] }
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
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
        className={`flex items-center gap-3 px-4 py-5 border-b border-border hover:opacity-80 transition-opacity ${collapsed ? 'justify-center' : ''}`}>
        <Image src="/logo.png" alt="Aiscern" width={36} height={36}
          className="object-contain flex-shrink-0" />
        {!collapsed && <span className="text-lg font-black gradient-text">Aiscern</span>}
      </Link>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider px-3 mb-2">
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
                    data-tour={item.tour || undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                      ${active
                        ? 'bg-primary/10 text-primary border-r-[3px] border-primary'
                        : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-100'
                      }
                      ${collapsed ? 'justify-center' : ''}`}>
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary' : ''}`} />
                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {/* Chat History */}
        {!collapsed && chatPreviews.length > 0 && pathname.startsWith('/chat') && (
          <div>
            <button
              onClick={() => setHistoryOpen(h => !h)}
              className="w-full flex items-center justify-between px-3 py-1.5 group"
            >
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Recent Chats</span>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 ${historyOpen ? 'rotate-0' : '-rotate-90'}`} />
            </button>
            {historyOpen && (
              <div className="space-y-0.5 mt-0.5">
                {chatPreviews.map(chat => (
                  <button key={chat.id}
                    onClick={() => { onChatSelect(chat.id); onNavClick() }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-100 transition-all text-left"
                  >
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                    <span className="text-xs truncate flex-1">{chat.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Account section */}
        <div>
          {!collapsed && (
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider px-3 mb-2">
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
                  data-tour={item.tour || undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                    ${active
                      ? 'bg-primary/10 text-primary border-r-[3px] border-primary'
                      : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-100'
                    }
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
      <div className="border-t border-neutral-800 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-neutral-800/50 transition-colors">
            <UserAvatar user={user} size={8} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-neutral-300 truncate">
                {user?.displayName || user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-[10px] text-neutral-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="p-1.5 rounded-lg hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={signOut}
              className="p-2 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Dashboard Layout ────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user: authUser, signOut } = useAuth()
  const { user: clerkUser } = useUser()

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([])
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isFirstTime, setIsFirstTime] = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)

  // Load chat previews
  useEffect(() => {
    setChatPreviews(loadChatPreviews())
  }, [pathname])

  // Onboarding detection
  useEffect(() => {
    if (!clerkUser || onboardingChecked) return

    const checkOnboarding = async () => {
      const firstTime = isFirstTimeUser(clerkUser)
      setIsFirstTime(firstTime)

      if (firstTime) {
        const state = await getOnboardingState(clerkUser.id)
        const needsOnboarding =
          !state?.has_completed_onboarding &&
          !state?.onboarding_skipped_at
        setShowOnboarding(needsOnboarding)
      }
      setOnboardingChecked(true)
    }

    checkOnboarding()
  }, [clerkUser, onboardingChecked])

  const handleChatSelect = useCallback((id: string) => {
    router.push(`/chat?conversation=${id}`)
  }, [router])

  const handleNavClick = useCallback(() => {
    setMobileOpen(false)
  }, [])

  return (
    <AuthGuard>
      <UpgradeNotificationProvider>
        <ErrorBoundary>
          <div className="flex h-screen bg-neutral-950 text-white overflow-hidden">
            {/* Desktop Sidebar */}
            <aside
              className={`hidden md:flex flex-col border-r border-neutral-800 bg-neutral-900/50 backdrop-blur-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                ${collapsed ? 'w-20' : 'w-72'}`}
            >
              <div className="flex items-center justify-end p-2">
                <button
                  onClick={() => setCollapsed(c => !c)}
                  className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                >
                  {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              </div>
              <Sidebar
                user={authUser}
                signOut={signOut}
                collapsed={collapsed}
                pathname={pathname}
                onNavClick={handleNavClick}
                chatPreviews={chatPreviews}
                onChatSelect={handleChatSelect}
              />
            </aside>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
              {mobileOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 z-40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                  />
                  <motion.aside
                    initial={{ x: -280 }}
                    animate={{ x: 0 }}
                    exit={{ x: -280 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed left-0 top-0 bottom-0 w-72 bg-neutral-900 border-r border-neutral-800 z-50 md:hidden"
                  >
                    <Sidebar
                      user={authUser}
                      signOut={signOut}
                      collapsed={false}
                      pathname={pathname}
                      onNavClick={handleNavClick}
                      chatPreviews={chatPreviews}
                      onChatSelect={handleChatSelect}
                    />
                  </motion.aside>
                </>
              )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Mobile Header */}
              <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/50">
                <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-neutral-800">
                  <Menu className="w-5 h-5" />
                </button>
                <Image src="/logo.png" alt="Aiscern" width={28} height={28} />
                <div className="w-9" />
              </header>

              {/* Page Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8 max-w-7xl mx-auto">
                  {pathname === '/dashboard' && (
                    <WelcomeHeader isFirstTime={isFirstTime} />
                  )}
                  {children}
                </div>
              </div>
            </main>
          </div>

          {/* Onboarding Wizard */}
          {showOnboarding && (
            <OnboardingWizard
              onComplete={() => setShowOnboarding(false)}
              onSkip={() => setShowOnboarding(false)}
            />
          )}
        </ErrorBoundary>
      </UpgradeNotificationProvider>
    </AuthGuard>
  )
}
