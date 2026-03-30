'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Image as ImageIcon, Video, Music, FileText } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Home'  },
  { href: '/detect/image', icon: ImageIcon,        label: 'Image' },
  { href: '/detect/video', icon: Video,            label: 'Video' },
  { href: '/detect/audio', icon: Music,            label: 'Audio' },
  { href: '/detect/text',  icon: FileText,         label: 'Text'  },
] as const

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-surface/95 backdrop-blur-xl border-t border-border"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-around h-14 px-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] py-1 px-2 rounded-xl transition-all duration-200
                ${active
                  ? 'text-primary'
                  : 'text-text-muted hover:text-text-secondary active:scale-95'
                }`}
            >
              <Icon
                className={`w-5 h-5 transition-all ${active ? 'drop-shadow-[0_0_8px_rgba(124,58,237,0.7)]' : ''}`}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span className={`text-[9px] font-bold uppercase tracking-wider leading-none ${active ? 'text-primary' : ''}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
