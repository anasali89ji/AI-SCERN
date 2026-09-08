'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, FileType2, Image as ImageIcon, Clock,
  MoreHorizontal, Video, Music, Layers, MessageSquare,
  User, Settings, X, Globe, Coins,
} from 'lucide-react'

const PRIMARY_NAV = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Home'    },
  { href: '/detect/text',  icon: FileType2,        label: 'Text'    },
  { href: '/detect/image', icon: ImageIcon,       label: 'Image'   },
  { href: '/history',      icon: Clock,           label: 'History' },
]

const MORE_NAV = [
  { href: '/detect/audio', icon: Music,         label: 'Audio'   },
  { href: '/detect/video', icon: Video,         label: 'Video'   },
  { href: '/batch',        icon: Layers,        label: 'Batch'   },
  { href: '/chat',         icon: MessageSquare, label: 'AI Chat' },
  { href: '/scraper',      icon: Globe,         label: 'Examiner' },
  { href: '/credits',      icon: Coins,         label: 'Credits' },
  { href: '/profile',      icon: User,          label: 'Profile' },
  { href: '/settings',     icon: Settings,      label: 'Settings'},
]

export function MobileNav() {
  const pathname   = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = MORE_NAV.some(
    item => pathname === item.href || pathname.startsWith(item.href),
  )

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = moreOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [moreOpen])

  // Close on route change
  useEffect(() => { setMoreOpen(false) }, [pathname])

  return (
    <>
      {/* More drawer */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-silver-50/80"
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 bg-surface border-t border-silver-300 rounded-t-xl animate-enter"
            style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-silver-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-[10px] font-bold text-silver-600 uppercase tracking-[0.1em]">
                More tools
              </p>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg hover:bg-silver-200 text-silver-600 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-4 gap-1.5 px-3 pb-3">
              {MORE_NAV.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || pathname.startsWith(href)
                return (
                  <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all active:scale-95 ${
                      active
                        ? 'bg-accent/10 text-accent'
                        : 'text-silver-700 hover:bg-silver-200 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
                    <span className="text-[9px] font-bold uppercase tracking-wider leading-none text-center">
                      {label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom tab bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-silver-300"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around px-1 h-16">
          {PRIMARY_NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href ||
              (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 rounded-xl
                            transition-all duration-150 min-w-0 active:scale-95 min-h-[44px] ${
                  active ? 'text-accent' : 'text-silver-600 hover:text-silver-700'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-[9px] font-bold uppercase tracking-wider leading-none truncate w-full text-center`}>
                  {label}
                </span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            aria-label="More navigation options"
            aria-expanded={moreOpen}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 rounded-xl
                        transition-all duration-150 min-w-0 active:scale-95 min-h-[44px] ${
              isMoreActive || moreOpen ? 'text-accent' : 'text-silver-600 hover:text-silver-700'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" strokeWidth={1.8} />
            <span className="text-[9px] font-bold uppercase tracking-wider leading-none">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
