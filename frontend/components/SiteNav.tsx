'use client'
import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu, X, ChevronDown,
  GraduationCap, Users, Newspaper, Scale, ShieldCheck,
  Heart, Megaphone, Microscope, Pencil, ArrowLeft,
  FileType2, Image as ImageIcon, Music, Video, MessageSquare, Database,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { cn } from '@/lib/cn'
import { ScrollProgress } from '@/components/ScrollProgress'

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
  { href: '/solutions/content-creators', label: 'Content Creators',   icon: Pencil,           desc: 'Prove human authorship'     },
]

const TOOLS = [
  { href: '/detect/text',  label: 'Text Attestation',  icon: FileType2,      desc: 'ChatGPT, Claude & more'  },
  { href: '/detect/image', label: 'Image Attestation', icon: ImageIcon,     desc: 'Deepfakes & AI images'   },
  { href: '/detect/audio', label: 'Audio Attestation', icon: Music,         desc: 'Voice cloning & TTS'     },
  { href: '/detect/video', label: 'Video Attestation', icon: Video,         desc: 'Frame-level analysis'    },
  { href: '/chat',         label: 'ARIA Assistant', icon: MessageSquare, desc: 'Attestation chat'       },
  { href: '/batch',        label: 'Bulk Attestation', icon: Database,      desc: 'Bulk content examination'   },
]

const NAV_LINKS = [
  { label: 'Pricing',     href: '/pricing'     },
  { label: 'Blog',        href: '/blog'         },
  { label: 'Reviews',     href: '/reviews'      },
]

// Flat list of jump targets for the command palette — pages only, no live data source.
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
    <>
      <ScrollProgress />
      <nav
      aria-label="Main navigation"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 h-16 transition-transform duration-300',
        hidden ? '-translate-y-full' : 'translate-y-0',
        scrolled
          ? 'bg-depth-bg/80 border-b border-white/15 backdrop-blur-xl'
          : 'bg-transparent border-b border-transparent',
      )}
    >
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-6">

        {/* Logo / Back */}
        {backHref ? (
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-sm font-medium text-silver-700 hover:text-silver-900 transition-colors duration-200 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {backLabel ?? 'Back'}
          </Link>
        ) : (
          <Link href="/" className="flex items-center gap-2 shrink-0 group" aria-label="Aiscern home">
            <span className="font-heading font-black text-xl text-silver-900 tracking-tight group-hover:text-accent transition-colors duration-200">
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
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50',
                dropdown === 'tools'
                  ? 'text-silver-900 bg-surface-elevated'
                  : 'text-silver-700 hover:text-silver-900 hover:bg-surface-elevated',
              )}
              aria-expanded={dropdown === 'tools'}
              aria-haspopup="true"
            >
              Tools
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', dropdown === 'tools' && 'rotate-180')} aria-hidden="true" />
            </button>

            <AnimatePresence>
              {dropdown === 'tools' && (
                <motion.div
                  onMouseEnter={cancelClose}
                  onMouseLeave={closeDropdown}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[420px] z-50
                             bg-surface border border-white/[0.06] rounded-xl shadow-lift overflow-hidden"
                >
                  <div className="p-2 grid grid-cols-2 gap-1">
                    {TOOLS.map(tool => (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-elevated transition-colors duration-200 group focus-visible:ring-2 focus-visible:ring-accent/50"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-elevated border border-white/[0.08] group-hover:border-accent/30 transition-colors duration-200 flex-shrink-0">
                          <tool.icon className="w-4 h-4 text-silver-700 group-hover:text-accent transition-colors duration-200" strokeWidth={1.8} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-silver-800 group-hover:text-silver-900 transition-colors duration-200">{tool.label}</div>
                          <div className="text-xs text-silver-600">{tool.desc}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs text-silver-600">All attestation tools — free tier available</span>
                    <Link href="/batch" className="text-xs text-accent hover:text-moss-200 font-medium flex items-center gap-1 transition-colors duration-200">
                      Batch mode <Zap className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Solutions */}
          <div
            className="relative"
            onMouseEnter={() => openDropdown('solutions')}
            onMouseLeave={closeDropdown}
          >
            <button
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50',
                dropdown === 'solutions'
                  ? 'text-silver-900 bg-surface-elevated'
                  : 'text-silver-700 hover:text-silver-900 hover:bg-surface-elevated',
              )}
              aria-expanded={dropdown === 'solutions'}
              aria-haspopup="true"
            >
              Solutions
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', dropdown === 'solutions' && 'rotate-180')} aria-hidden="true" />
            </button>

            <AnimatePresence>
              {dropdown === 'solutions' && (
                <motion.div
                  onMouseEnter={cancelClose}
                  onMouseLeave={closeDropdown}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[440px] z-50
                             bg-surface border border-white/[0.06] rounded-xl shadow-lift overflow-hidden"
                >
                  <div className="p-2 grid grid-cols-2 gap-1">
                    {SOLUTIONS.map(sol => (
                      <Link
                        key={sol.href}
                        href={sol.href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-elevated transition-colors duration-200 group focus-visible:ring-2 focus-visible:ring-accent/50"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-elevated border border-white/[0.08] group-hover:border-accent/30 transition-colors duration-200 flex-shrink-0">
                          <sol.icon className="w-4 h-4 text-silver-700 group-hover:text-accent transition-colors duration-200" strokeWidth={1.8} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-silver-800 group-hover:text-silver-900 transition-colors duration-200">{sol.label}</div>
                          <div className="text-xs text-silver-600">{sol.desc}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="px-4 py-2.5 border-t border-white/[0.06]">
                    <Link href="/enterprise" className="text-xs text-accent hover:text-moss-200 font-medium flex items-center gap-1 transition-colors duration-200">
                      Enterprise plan — custom volume & SLA <Zap className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Flat links */}
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50',
                pathname === link.href
                  ? 'text-accent bg-accent/10'
                  : 'text-silver-700 hover:text-silver-900 hover:bg-surface-elevated',
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
                         bg-accent/10 border border-accent/20 text-accent
                         text-sm font-semibold hover:bg-accent/15 transition-all duration-200
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <span className="w-7 h-7 rounded-full bg-accent text-depth-bg text-xs font-black flex items-center justify-center flex-shrink-0">
                {initials}
              </span>
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:flex items-center px-4 py-2 rounded-lg border border-white/[0.08]
                           text-sm font-medium text-silver-700 hover:text-silver-900 hover:border-white/[0.16]
                           transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover
                           text-depth-bg text-sm font-semibold transition-colors duration-200
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Begin Attestation</span>
                <span className="sm:hidden">Join</span>
              </Link>
            </>
          )}

          {/* Mobile hamburger — 44px min touch target */}
          <button
            className="lg:hidden w-11 h-11 flex items-center justify-center rounded-lg
                       text-silver-700 hover:text-silver-900 hover:bg-surface-elevated transition-colors duration-200
                       focus-visible:ring-2 focus-visible:ring-accent/50"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen ? (
                <motion.span
                  key="close"
                  initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="flex"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </motion.span>
              ) : (
                <motion.span
                  key="open"
                  initial={{ rotate: 90, opacity: 0, scale: 0.6 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: -90, opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="flex"
                >
                  <Menu className="w-5 h-5" aria-hidden="true" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Mobile Drawer — height/slide open with staggered link entrance */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav"
            role="dialog"
            aria-label="Navigation menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden border-t border-white/15 bg-depth-bg overflow-hidden"
          >
          <motion.div
            className="px-4 py-4 space-y-1 max-h-[80dvh] overflow-y-auto"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
            }}
            initial="hidden"
            animate="show"
          >
            {[
              { key: 'tools', label: 'Tools' },
            ].map(h => (
              <motion.p
                key={h.key}
                variants={{ hidden: { opacity: 0, y: -6 }, show: { opacity: 1, y: 0 } }}
                className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-silver-600"
              >
                {h.label}
              </motion.p>
            ))}
            {TOOLS.map(tool => (
              <motion.div key={tool.href} variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }}>
                <Link
                  href={tool.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-silver-700
                             hover:text-silver-900 hover:bg-surface-elevated transition-all duration-200 text-sm font-medium
                             focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <tool.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  {tool.label}
                </Link>
              </motion.div>
            ))}

            <motion.p
              variants={{ hidden: { opacity: 0, y: -6 }, show: { opacity: 1, y: 0 } }}
              className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-silver-600 mt-3"
            >
              Solutions
            </motion.p>
            {SOLUTIONS.slice(0, 5).map(sol => (
              <motion.div key={sol.href} variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }}>
                <Link
                  href={sol.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-silver-700
                             hover:text-silver-900 hover:bg-surface-elevated transition-all duration-200 text-sm font-medium
                             focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <sol.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  {sol.label}
                </Link>
              </motion.div>
            ))}
            <motion.div variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }}>
              <Link
                href="/solutions"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-accent
                           hover:bg-surface-elevated transition-all duration-200 text-sm font-medium
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                All solutions →
              </Link>
            </motion.div>

            <motion.p
              variants={{ hidden: { opacity: 0, y: -6 }, show: { opacity: 1, y: 0 } }}
              className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-silver-600 mt-3"
            >
              More
            </motion.p>
            {[...NAV_LINKS, { label: 'Methodology', href: '/methodology' }, { label: 'Enterprise', href: '/enterprise' }].map(l => (
              <motion.div key={l.href} variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }}>
                <Link
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-silver-700
                             hover:text-silver-900 hover:bg-surface-elevated transition-all duration-200 text-sm font-medium
                             focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  {l.label}
                </Link>
              </motion.div>
            ))}

            {!user && (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                className="pt-3 mt-2 border-t border-white/15 flex flex-col gap-2"
              >
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center px-4 py-3 min-h-[48px] rounded-lg border border-white/[0.08]
                             text-sm font-medium text-silver-700 hover:text-silver-900 hover:border-white/[0.16] transition-all duration-200
                             focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-lg
                             bg-accent hover:bg-accent-hover text-depth-bg text-sm font-semibold transition-colors duration-200
                             focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <Zap className="w-4 h-4" aria-hidden="true" /> Begin Attestation Free
                </Link>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </nav>
    </>
  )
}
