'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard, Image as ImageIcon, FileText, Clock,
  MoreHorizontal, Video, Music, Layers, MessageSquare,
  User, Settings, X, Globe,
} from 'lucide-react'

const PRIMARY_NAV = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Home'    },
  { href: '/detect/text',  icon: FileText,        label: 'Text'    },
  { href: '/detect/image', icon: ImageIcon,       label: 'Image'   },
  { href: '/history',      icon: Clock,           label: 'History' },
]

const MORE_NAV = [
  { href: '/detect/audio', icon: Music,        label: 'Audio'    },
  { href: '/detect/video', icon: Video,        label: 'Video'    },
  { href: '/batch',        icon: Layers,       label: 'Batch'    },
  { href: '/chat',         icon: MessageSquare,label: 'AI Chat'  },
  { href: '/scraper',      icon: Globe,        label: 'Scanner'  },
  { href: '/profile',      icon: User,         label: 'Profile'  },
  { href: '/settings',     icon: Settings,     label: 'Settings' },
]

export function MobileNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = MORE_NAV.some(
    item => pathname === item.href || pathname.startsWith(item.href)
  )

  return (
    <>
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="lg:hidden fixed inset-0 bg-black/70 z-[55]"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="lg:hidden fixed bottom-0 inset-x-0 z-[60] bg-[#0a0a12] border-t border-border rounded-t-3xl"
              style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="px-4 pb-2">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-black text-text-muted uppercase tracking-widest">More tools</p>
                  <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-active text-text-muted transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {MORE_NAV.map(({ href, icon: Icon, label }) => {
                    const active = pathname === href || pathname.startsWith(href)
                    return (
                      <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all active:scale-95
                          ${active ? 'bg-primary/15 text-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-secondary'}`}>
                        <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
                        <span className="text-[9px] font-bold uppercase tracking-wider leading-none text-center">{label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-surface/96 backdrop-blur-xl border-t border-border/40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around px-2 h-16">
          {PRIMARY_NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 px-1 rounded-xl transition-all duration-200 min-w-0
                  ${active ? 'text-primary' : 'text-text-muted hover:text-text-secondary active:scale-95'}`}>
                <Icon className={`w-5 h-5 transition-all ${active ? 'drop-shadow-[0_0_8px_rgba(124,58,237,0.7)]' : ''}`} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-[9px] font-bold uppercase tracking-wider leading-none truncate w-full text-center ${active ? 'text-primary' : ''}`}>{label}</span>
              </Link>
            )
          })}
          <button onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 px-1 rounded-xl transition-all duration-200 min-w-0 active:scale-95
              ${isMoreActive || moreOpen ? 'text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
            <MoreHorizontal className={`w-5 h-5 ${moreOpen ? 'drop-shadow-[0_0_8px_rgba(124,58,237,0.7)]' : ''}`} strokeWidth={1.8} />
            <span className="text-[9px] font-bold uppercase tracking-wider leading-none">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
