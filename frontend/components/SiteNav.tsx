'use client'
import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu, X, ChevronDown,
  GraduationCap, Users, Newspaper, Scale, ShieldCheck,
  Heart, Megaphone, Microscope, Pen, ArrowLeft,
  FileText, Image as ImageIcon, Music, Video, MessageSquare, Database,
  Zap, Activity, Star, BookOpen,
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

interface SiteNavProps {
  backHref?:  string
  backLabel?: string
}

const SOLUTIONS = [
  { href: '/solutions/education',  label: 'Education',          icon: GraduationCap, desc: 'Academic integrity tools' },
  { href: '/solutions/hr',         label: 'HR & Recruiting',    icon: Users,         desc: 'Verify candidate content'  },
  { href: '/solutions/media',      label: 'Media & Journalism', icon: Newspaper,     desc: 'Fact-check AI content'     },
  { href: '/solutions/legal',      label: 'Legal & Compliance', icon: Scale,         desc: 'Evidence authenticity'     },
  { href: '/solutions/security',   label: 'Cybersecurity',      icon: ShieldCheck,   desc: 'Deepfake threat detection' },
  { href: '/solutions/healthcare', label: 'Healthcare',         icon: Heart,         desc: 'Medical content integrity' },
  { href: '/solutions/marketing',  label: 'Marketing & Brand',  icon: Megaphone,     desc: 'Protect brand authenticity'},
  { href: '/solutions/research',   label: 'Research',           icon: Microscope,    desc: 'Dataset validation'        },
  { href: '/solutions/creators',   label: 'Content Creators',   icon: Pen,           desc: 'Prove human authorship'    },
]

const TOOLS = [
  { href: '/detect/text',  label: 'Text Detector',     icon: FileText,    color: 'text-amber-400-400',   desc: 'ChatGPT, Claude & more' },
  { href: '/detect/image', label: 'Image Detector',    icon: ImageIcon,   color: 'text-blue-400',    desc: 'Deepfakes & AI images'  },
  { href: '/detect/audio', label: 'Audio Detector',    icon: Music,       color: 'text-violet-400',  desc: 'Voice cloning & TTS'    },
  { href: '/detect/video', label: 'Video Detector',    icon: Video,       color: 'text-emerald-400-400', desc: 'Frame-level analysis'   },
  { href: '/chat',         label: 'ARIA Assistant',    icon: MessageSquare, color: 'text-sky-400',   desc: 'AI detection chat'      },
  { href: '/batch',        label: 'Batch Analyser',    icon: Database,    color: 'text-rose-400-400',    desc: 'Bulk content analysis'  },
]

const NAV_LINKS = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog',    href: '/blog'    },
  { label: 'Reviews', href: '/reviews' },
]

export function SiteNav({ backHref, backLabel }: SiteNavProps) {
  const { user }                          = useAuth()
  const pathname                          = usePathname()
  const [scrolled,    setScrolled]        = useState(false)
  const [hidden,      setHidden]          = useState(false)
  const [mobileOpen,  setMobileOpen]      = useState(false)
  const [dropdown,    setDropdown]        = useState<'tools' | 'solutions' | null>(null)
  const lastY                             = useRef(0)
  const dropdownRef                       = useRef<HTMLDivElement>(null)
  const dropdownTimerRef                  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
      document.body.style.overflow  = 'hidden'
      document.body.style.position  = 'fixed'
      document.body.style.width     = '100%'
    } else {
      document.body.style.overflow  = ''
      document.body.style.position  = ''
      document.body.style.width     = ''
    }
    return () => { document.body.style.overflow = ''; document.body.style.position = ''; document.body.style.width = '' }
  }, [mobileOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdown(null)
    }
    if (dropdown) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdown])

  const openDropdown  = (key: typeof dropdown) => { clearTimeout(dropdownTimerRef.current); setDropdown(key) }
  const closeDropdown = () => { dropdownTimerRef.current = setTimeout(() => setDropdown(null), 140) }
  const cancelClose   = () => clearTimeout(dropdownTimerRef.current)

  const initials = (user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()

  return (
    <nav
      aria-label="Main navigation"
      className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300
        ${hidden ? '-translate-y-full' : 'translate-y-0'}
        ${scrolled
          ? 'bg-[#08080d]/92 border-b border-white/[0.08] shadow-[0_1px_0_0_rgba(255,255,255,0.04)]'
          : 'bg-transparent border-b border-transparent'}
        backdrop-blur-[20px]`}
      style={{ WebkitBackdropFilter: 'blur(20px)' }}
    >
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-6">

        {/* Back link OR logo */}
        {backHref ? (
          <Link href={backHref}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-400
                       hover:text-white transition-colors duration-200 shrink-0">
            <ArrowLeft className="w-4 h-4" />{backLabel ?? 'Back'}
          </Link>
        ) : (
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <span className="font-black text-xl text-white tracking-tight
                             group-hover:text-blue-400 transition-colors duration-200">
              Aiscern
            </span>
          </Link>
        )}

        {/* Desktop nav — centre */}
        <div ref={dropdownRef} className="hidden lg:flex items-center gap-1 flex-1 justify-center">

          {/* Tools dropdown */}
          <div className="relative"
            onMouseEnter={() => openDropdown('tools')}
            onMouseLeave={closeDropdown}
          >
            <button
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200
                ${dropdown === 'tools' ? 'text-white bg-white/[0.06]' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
              aria-expanded={dropdown === 'tools'}
              aria-haspopup="true"
              onClick={() => setDropdown(d => d === 'tools' ? null : 'tools')}
            >
              Tools <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdown === 'tools' ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {dropdown === 'tools' && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.22,1,0.36,1] }}
                  onMouseEnter={cancelClose}
                  onMouseLeave={closeDropdown}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[420px] rounded-[14px]
                             border border-white/[0.10] bg-[#0f0f17] shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-3 grid grid-cols-2 gap-1">
                    {TOOLS.map(tool => (
                      <Link key={tool.href} href={tool.href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                                   hover:bg-white/[0.05] transition-colors duration-150 group">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] flex-shrink-0">
                          <tool.icon className={`w-4 h-4 ${tool.color}`} strokeWidth={1.8} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{tool.label}</div>
                          <div className="text-[11px] text-slate-500">{tool.desc}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="px-3 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[11px] text-slate-600">All detectors — free tier</span>
                    <Link href="/batch" className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors">
                      Batch mode <Zap className="w-3 h-3" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Solutions dropdown */}
          <div className="relative"
            onMouseEnter={() => openDropdown('solutions')}
            onMouseLeave={closeDropdown}
          >
            <button
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200
                ${dropdown === 'solutions' ? 'text-white bg-white/[0.06]' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
              aria-expanded={dropdown === 'solutions'}
              aria-haspopup="true"
              onClick={() => setDropdown(d => d === 'solutions' ? null : 'solutions')}
            >
              Solutions <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdown === 'solutions' ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {dropdown === 'solutions' && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.22,1,0.36,1] }}
                  onMouseEnter={cancelClose}
                  onMouseLeave={closeDropdown}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[440px] rounded-[14px]
                             border border-white/[0.10] bg-[#0f0f17] shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-3 grid grid-cols-2 gap-1">
                    {SOLUTIONS.map(sol => (
                      <Link key={sol.href} href={sol.href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                                   hover:bg-white/[0.05] transition-colors duration-150 group">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] flex-shrink-0">
                          <sol.icon className="w-4 h-4 text-blue-400" strokeWidth={1.8} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{sol.label}</div>
                          <div className="text-[11px] text-slate-500">{sol.desc}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="px-3 py-2.5 border-t border-white/[0.06]">
                    <Link href="/enterprise" className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors">
                      Enterprise plan — custom volume & SLA <Zap className="w-3 h-3" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Flat links */}
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200
                ${pathname === link.href ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth CTA */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <Link href="/dashboard"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                         bg-blue-500/[0.08] border border-blue-500/25 text-blue-400
                         text-sm font-semibold hover:bg-blue-500/[0.14] transition-all duration-200">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-black
                               flex items-center justify-center flex-shrink-0">
                {initials}
              </span>
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          ) : (
            <>
              <Link href="/login"
                className="hidden sm:flex items-center px-4 py-2 rounded-xl border border-white/[0.08]
                           text-sm font-medium text-slate-300 hover:text-white hover:border-white/[0.14]
                           transition-all duration-200">
                Sign In
              </Link>
              <Link href="/signup"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
                           text-white text-sm font-semibold transition-colors duration-200">
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Get Started</span>
                <span className="sm:hidden">Join</span>
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center
                       rounded-xl text-slate-400 hover:text-white transition-colors"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen
                ? <motion.span key="x"    initial={{rotate:-90,opacity:0}} animate={{rotate:0,opacity:1}} exit={{rotate:90,opacity:0}} transition={{duration:0.15}}><X className="w-5 h-5"/></motion.span>
                : <motion.span key="menu" initial={{rotate:90,opacity:0}} animate={{rotate:0,opacity:1}} exit={{rotate:-90,opacity:0}} transition={{duration:0.15}}><Menu className="w-5 h-5"/></motion.span>
              }
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* ── Mobile Drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav"
            role="dialog"
            aria-label="Navigation menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22,1,0.36,1] }}
            className="lg:hidden border-t border-white/[0.07] bg-[#08080d]/98 overflow-hidden"
            style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
          >
            <div className="px-4 py-4 space-y-1 max-h-[80dvh] overflow-y-auto">

              {/* Tools group */}
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Tools</p>
              {TOOLS.map(tool => (
                <Link key={tool.href} href={tool.href} onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400
                             hover:text-white hover:bg-white/[0.04] transition-all text-sm font-medium">
                  <tool.icon className={`w-4 h-4 ${tool.color} flex-shrink-0`} strokeWidth={1.8} />
                  {tool.label}
                </Link>
              ))}

              {/* Solutions group */}
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-3">Solutions</p>
              {SOLUTIONS.slice(0, 5).map(sol => (
                <Link key={sol.href} href={sol.href} onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400
                             hover:text-white hover:bg-white/[0.04] transition-all text-sm font-medium">
                  <sol.icon className="w-4 h-4 text-blue-400 flex-shrink-0" strokeWidth={1.8} />
                  {sol.label}
                </Link>
              ))}
              <Link href="/solutions" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-blue-400
                           hover:bg-white/[0.04] transition-all text-sm font-medium">
                All solutions →
              </Link>

              {/* Flat nav */}
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-3">More</p>
              {[...NAV_LINKS,{ label:'Methodology',href:'/methodology' },{ label:'Enterprise',href:'/enterprise' }].map(l => (
                <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400
                             hover:text-white hover:bg-white/[0.04] transition-all text-sm font-medium">
                  {l.label}
                </Link>
              ))}

              {/* Auth */}
              {!user && (
                <div className="pt-3 mt-2 border-t border-white/[0.07] flex flex-col gap-2">
                  <Link href="/login" onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center px-4 py-3 rounded-xl border border-white/[0.08]
                               text-sm font-medium text-slate-300 hover:text-white hover:border-white/[0.14] transition-all">
                    Sign In
                  </Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                               bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
                    <Zap className="w-4 h-4" />Get Started Free
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
