'use client'
import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu, X, ChevronDown, Search,
  GraduationCap, Users, Newspaper, Scale, ShieldCheck,
  Heart, Megaphone, Microscope, Pen, ArrowLeft,
  FileText, Image as ImageIcon, Music, Video, MessageSquare, Database,
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
  { href: '/solutions/creators',   label: 'Content Creators',   icon: Pen,           desc: 'Prove human authorship'     },
]

const TOOLS = [
  { href: '/detect/text',  label: 'Text Attestation',  icon: FileText,      desc: 'ChatGPT, Claude & more'  },
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
const COMMAND_ITEMS = [
  ...TOOLS.map(t => ({ label: t.label, href: t.href, hint: t.desc })),
  ...SOLUTIONS.map(s => ({ label: s.label, href: s.href, hint: s.desc })),
  ...NAV_LINKS.map(l => ({ label: l.label, href: l.href, hint: '' })),
  { label: 'Enterprise', href: '/enterprise', hint: 'Custom volume & SLA' },
  { label: 'Methodology', href: '/methodology', hint: 'How detection works' },
  { label: 'Dashboard', href: '/dashboard', hint: '' },
]

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const results = query.trim()
    ? COMMAND_ITEMS.filter(i => i.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : COMMAND_ITEMS.slice(0, 8)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      // Focus after mount so AnimatePresence has painted the modal first.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const go = useCallback((href: string) => {
    onClose()
    router.push(href)
  }, [onClose, router])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter' && results[activeIndex]) { e.preventDefault(); go(results[activeIndex].href) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-depth-bg/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            onKeyDown={onKeyDown}
            className="w-full max-w-lg bg-surface-elevated border border-white/[0.08] rounded-xl shadow-lift overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 border-b border-white/[0.06]">
              <Search className="w-4 h-4 text-silver-600 shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setActiveIndex(0) }}
                placeholder="Search pages, tools, solutions..."
                aria-label="Search pages, tools, and solutions"
                className="flex-1 bg-transparent py-3.5 text-sm text-silver-900 placeholder:text-silver-600 focus:outline-none"
              />
              <kbd className="hidden sm:inline text-[10px] text-silver-600 border border-white/[0.08] rounded px-1.5 py-0.5">Esc</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto py-2" role="listbox">
              {results.length === 0 && (
                <p className="px-4 py-6 text-sm text-silver-600 text-center">No results for &ldquo;{query}&rdquo;</p>
              )}
              {results.map((item, i) => (
                <button
                  key={item.href}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => go(item.href)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors duration-200',
                    i === activeIndex ? 'bg-white/[0.06] text-silver-900' : 'text-silver-700',
                  )}
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.hint && <span className="text-xs text-silver-600 truncate">{item.hint}</span>}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function SiteNav({ backHref, backLabel }: SiteNavProps) {
  const { user }                           = useAuth()
  const pathname                           = usePathname()
  const [scrolled,   setScrolled]          = useState(false)
  const [hidden,     setHidden]            = useState(false)
  const [mobileOpen, setMobileOpen]        = useState(false)
  const [dropdown,   setDropdown]          = useState<'tools' | 'solutions' | null>(null)
  const [paletteOpen, setPaletteOpen]      = useState(false)
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

  // Cmd/Ctrl+K opens the command palette from anywhere on the site.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const openDropdown  = (key: typeof dropdown) => { clearTimeout(timerRef.current); setDropdown(key) }
  const closeDropdown = () => { timerRef.current = setTimeout(() => setDropdown(null), 140) }
  const cancelClose   = () => clearTimeout(timerRef.current)

  const initials = (user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()

  return (
    <>
      <ScrollProgress />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <nav
      aria-label="Main navigation"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 h-16 transition-transform duration-300',
        hidden ? '-translate-y-full' : 'translate-y-0',
        scrolled
          ? 'bg-depth-bg/80 border-b border-white/5 backdrop-blur-xl'
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

        {/* Search trigger + Auth CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Open search"
            className="hidden md:flex items-center gap-2 px-3 h-9 rounded-lg border border-white/[0.08]
                       text-silver-600 hover:text-silver-900 hover:border-white/[0.16] transition-all duration-200
                       focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="text-xs">Search</span>
            <kbd className="text-[10px] border border-white/[0.08] rounded px-1 py-0.5 ml-1">⌘K</kbd>
          </button>

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
            {mobileOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer — simple fade only, per spec (no hamburger-to-X animation) */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav"
            role="dialog"
            aria-label="Navigation menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden border-t border-white/5 bg-depth-bg overflow-hidden"
          >
          <div className="px-4 py-4 space-y-1 max-h-[80dvh] overflow-y-auto">

            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-silver-600">
              Tools
            </p>
            {TOOLS.map(tool => (
              <Link
                key={tool.href}
                href={tool.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-silver-700
                           hover:text-silver-900 hover:bg-surface-elevated transition-all duration-200 text-sm font-medium
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <tool.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} aria-hidden="true" />
                {tool.label}
              </Link>
            ))}

            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-silver-600 mt-3">
              Solutions
            </p>
            {SOLUTIONS.slice(0, 5).map(sol => (
              <Link
                key={sol.href}
                href={sol.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-silver-700
                           hover:text-silver-900 hover:bg-surface-elevated transition-all duration-200 text-sm font-medium
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <sol.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} aria-hidden="true" />
                {sol.label}
              </Link>
            ))}
            <Link
              href="/solutions"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-accent
                         hover:bg-surface-elevated transition-all duration-200 text-sm font-medium
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              All solutions →
            </Link>

            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-silver-600 mt-3">
              More
            </p>
            {[...NAV_LINKS, { label: 'Methodology', href: '/methodology' }, { label: 'Enterprise', href: '/enterprise' }].map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-silver-700
                           hover:text-silver-900 hover:bg-surface-elevated transition-all duration-200 text-sm font-medium
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                {l.label}
              </Link>
            ))}

            {!user && (
              <div className="pt-3 mt-2 border-t border-white/5 flex flex-col gap-2">
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
              </div>
            )}
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </nav>
    </>
  )
}
