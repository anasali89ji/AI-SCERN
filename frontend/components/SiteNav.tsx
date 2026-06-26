'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import {
  Menu, X, ChevronDown,
  GraduationCap, Users, Newspaper, Scale, ShieldCheck,
  Heart, Megaphone, Microscope, Pen, ArrowLeft,
  FileText, Image as ImageIcon, Music, Video, MessageSquare, Database,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { cn } from '@/lib/cn'

interface SiteNavProps {
  backHref?:  string
  backLabel?: string
}

const SOLUTIONS = [
  { href: '/solutions/education',  label: 'Education',          icon: GraduationCap, desc: 'Academic integrity tools'   },
  { href: '/solutions/hr',         label: 'HR & Recruiting',    icon: Users,         desc: 'Verify candidate content'   },
  { href: '/solutions/media',      label: 'Media & Journalism', icon: Newspaper,     desc: 'Fact-check AI content'      },
  { href: '/solutions/legal',      label: 'Legal & Compliance', icon: Scale,         desc: 'Evidence authenticity'      },
  { href: '/solutions/security',   label: 'Cybersecurity',      icon: ShieldCheck,   desc: 'Deepfake threat detection'  },
  { href: '/solutions/healthcare', label: 'Healthcare',         icon: Heart,         desc: 'Medical content integrity'  },
  { href: '/solutions/marketing',  label: 'Marketing & Brand',  icon: Megaphone,     desc: 'Protect brand authenticity' },
  { href: '/solutions/research',   label: 'Research',           icon: Microscope,    desc: 'Dataset validation'         },
  { href: '/solutions/creators',   label: 'Content Creators',   icon: Pen,           desc: 'Prove human authorship'     },
]

const TOOLS = [
  { href: '/detect/text',  label: 'Text Detector',  icon: FileText,      desc: 'ChatGPT, Claude & more'  },
  { href: '/detect/image', label: 'Image Detector', icon: ImageIcon,     desc: 'Deepfakes & AI images'   },
  { href: '/detect/audio', label: 'Audio Detector', icon: Music,         desc: 'Voice cloning & TTS'     },
  { href: '/detect/video', label: 'Video Detector', icon: Video,         desc: 'Frame-level analysis'    },
  { href: '/chat',         label: 'ARIA Assistant', icon: MessageSquare, desc: 'AI detection chat'       },
  { href: '/batch',        label: 'Batch Analyser', icon: Database,      desc: 'Bulk content analysis'   },
]

const NAV_LINKS = [
  { label: 'Pricing',     href: '/pricing'     },
  { label: 'Blog',        href: '/blog'         },
  { label: 'Reviews',     href: '/reviews'      },
]

export function SiteNav({ backHref, backLabel }: SiteNavProps) {
  const { user }                           = useAuth()
  const pathname                           = usePathname()
  const [scrolled,   setScrolled]          = useState(false)
  const [hidden,     setHidden]            = useState(false)
  const [mobileOpen, setMobileOpen]        = useState(false)
  const [dropdown,   setDropdown]          = useState<'tools' | 'solutions' | null>(null)
  const lastY                              = useRef(0)
  const dropdownRef                        = useRef<HTMLDivElement>(null)
  const timerRef                           = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 24)
      if (y > lastY.current + 12 && y > 120) setHidden(true)
      else if (y < lastY.current - 6) setHidden(false)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMobileOpen(false); setDropdown(null) }, [pathname])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdown(null)
    }
    if (dropdown) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdown])

  const openDropdown  = (key: typeof dropdown) => { clearTimeout(timerRef.current); setDropdown(key) }
  const closeDropdown = () => { timerRef.current = setTimeout(() => setDropdown(null), 140) }
  const cancelClose   = () => clearTimeout(timerRef.current)

  const initials = (user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 h-16 transition-transform duration-300',
        hidden ? '-translate-y-full' : 'translate-y-0',
        scrolled
          ? 'bg-[#141414]/95 border-b border-[#1E1E1E] backdrop-blur-xl'
          : 'bg-transparent border-b border-transparent',
      )}
    >
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-6">

        {/* Logo / Back */}
        {backHref ? (
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-sm font-medium text-[#A3A3A3] hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel ?? 'Back'}
          </Link>
        ) : (
          <Link href="/" className="flex items-center gap-2 shrink-0 group" aria-label="Aiscern home">
            <span className="font-black text-xl text-white tracking-tight group-hover:text-[#2BEE34] transition-colors duration-200">
              Aiscern
            </span>
          </Link>
        )}

        {/* Desktop nav */}
        <div ref={dropdownRef} className="hidden lg:flex items-center gap-1 flex-1 justify-center">

          {/* Tools */}
          <div
            className="relative"
            onMouseEnter={() => openDropdown('tools')}
            onMouseLeave={closeDropdown}
          >
            <button
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                dropdown === 'tools'
                  ? 'text-white bg-[#1A1A1A]'
                  : 'text-[#A3A3A3] hover:text-white hover:bg-[#1A1A1A]',
              )}
              aria-expanded={dropdown === 'tools'}
              aria-haspopup="true"
            >
              Tools
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', dropdown === 'tools' && 'rotate-180')} />
            </button>

            {dropdown === 'tools' && (
              <div
                onMouseEnter={cancelClose}
                onMouseLeave={closeDropdown}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[420px] z-50
                           bg-[#141414] border border-[#1E1E1E] rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)]
                           overflow-hidden animate-slide-up"
              >
                <div className="p-2 grid grid-cols-2 gap-1">
                  {TOOLS.map(tool => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1A1A1A] transition-colors duration-150 group"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#1A1A1A] border border-[#2A2A2A] group-hover:border-[#2BEE34]/30 transition-colors flex-shrink-0">
                        <tool.icon className="w-4 h-4 text-[#A3A3A3] group-hover:text-[#2BEE34] transition-colors" strokeWidth={1.8} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#E5E5E5] group-hover:text-white transition-colors">{tool.label}</div>
                        <div className="text-xs text-[#6B6B6B]">{tool.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-[#1E1E1E] flex items-center justify-between">
                  <span className="text-xs text-[#6B6B6B]">All detectors — free tier available</span>
                  <Link href="/batch" className="text-xs text-[#2BEE34] hover:text-[#4FFF58] font-medium flex items-center gap-1 transition-colors">
                    Batch mode <Zap className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Solutions */}
          <div
            className="relative"
            onMouseEnter={() => openDropdown('solutions')}
            onMouseLeave={closeDropdown}
          >
            <button
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                dropdown === 'solutions'
                  ? 'text-white bg-[#1A1A1A]'
                  : 'text-[#A3A3A3] hover:text-white hover:bg-[#1A1A1A]',
              )}
              aria-expanded={dropdown === 'solutions'}
              aria-haspopup="true"
            >
              Solutions
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', dropdown === 'solutions' && 'rotate-180')} />
            </button>

            {dropdown === 'solutions' && (
              <div
                onMouseEnter={cancelClose}
                onMouseLeave={closeDropdown}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[440px] z-50
                           bg-[#141414] border border-[#1E1E1E] rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)]
                           overflow-hidden animate-slide-up"
              >
                <div className="p-2 grid grid-cols-2 gap-1">
                  {SOLUTIONS.map(sol => (
                    <Link
                      key={sol.href}
                      href={sol.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1A1A1A] transition-colors duration-150 group"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#1A1A1A] border border-[#2A2A2A] group-hover:border-[#2BEE34]/30 transition-colors flex-shrink-0">
                        <sol.icon className="w-4 h-4 text-[#A3A3A3] group-hover:text-[#2BEE34] transition-colors" strokeWidth={1.8} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#E5E5E5] group-hover:text-white transition-colors">{sol.label}</div>
                        <div className="text-xs text-[#6B6B6B]">{sol.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-[#1E1E1E]">
                  <Link href="/enterprise" className="text-xs text-[#2BEE34] hover:text-[#4FFF58] font-medium flex items-center gap-1 transition-colors">
                    Enterprise plan — custom volume & SLA <Zap className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Flat links */}
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                pathname === link.href
                  ? 'text-[#2BEE34] bg-[#2BEE34]/10'
                  : 'text-[#A3A3A3] hover:text-white hover:bg-[#1A1A1A]',
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth CTA */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                         bg-[#2BEE34]/10 border border-[#2BEE34]/20 text-[#2BEE34]
                         text-sm font-semibold hover:bg-[#2BEE34]/15 transition-all duration-150"
            >
              <span className="w-7 h-7 rounded-full bg-[#2BEE34] text-[#0A0A0A] text-xs font-black flex items-center justify-center flex-shrink-0">
                {initials}
              </span>
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:flex items-center px-4 py-2 rounded-lg border border-[#2A2A2A]
                           text-sm font-medium text-[#A3A3A3] hover:text-white hover:border-[#3A3A3A]
                           transition-all duration-150"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2BEE34] hover:bg-[#1A8F1F]
                           text-[#0A0A0A] text-sm font-semibold transition-colors duration-150"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Get Started</span>
                <span className="sm:hidden">Join</span>
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            className="lg:hidden w-11 h-11 flex items-center justify-center rounded-lg
                       text-[#A3A3A3] hover:text-white hover:bg-[#1A1A1A] transition-colors"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          id="mobile-nav"
          role="dialog"
          aria-label="Navigation menu"
          className="lg:hidden border-t border-[#1E1E1E] bg-[#141414] overflow-hidden animate-slide-up"
        >
          <div className="px-4 py-4 space-y-1 max-h-[80dvh] overflow-y-auto">

            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B6B6B]">
              Tools
            </p>
            {TOOLS.map(tool => (
              <Link
                key={tool.href}
                href={tool.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#A3A3A3]
                           hover:text-white hover:bg-[#1A1A1A] transition-all text-sm font-medium"
              >
                <tool.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
                {tool.label}
              </Link>
            ))}

            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B6B6B] mt-3">
              Solutions
            </p>
            {SOLUTIONS.slice(0, 5).map(sol => (
              <Link
                key={sol.href}
                href={sol.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#A3A3A3]
                           hover:text-white hover:bg-[#1A1A1A] transition-all text-sm font-medium"
              >
                <sol.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
                {sol.label}
              </Link>
            ))}
            <Link
              href="/solutions"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#2BEE34]
                         hover:bg-[#1A1A1A] transition-all text-sm font-medium"
            >
              All solutions →
            </Link>

            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B6B6B] mt-3">
              More
            </p>
            {[...NAV_LINKS, { label: 'Methodology', href: '/methodology' }, { label: 'Enterprise', href: '/enterprise' }].map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#A3A3A3]
                           hover:text-white hover:bg-[#1A1A1A] transition-all text-sm font-medium"
              >
                {l.label}
              </Link>
            ))}

            {!user && (
              <div className="pt-3 mt-2 border-t border-[#1E1E1E] flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center px-4 py-3 rounded-lg border border-[#2A2A2A]
                             text-sm font-medium text-[#A3A3A3] hover:text-white hover:border-[#3A3A3A] transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                             bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] text-sm font-semibold transition-colors"
                >
                  <Zap className="w-4 h-4" /> Get Started Free
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
