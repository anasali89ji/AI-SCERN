'use client'
import Link    from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { Menu, X, ChevronDown, GraduationCap, Users, Newspaper, Scale, ShieldCheck, Heart, Megaphone, Microscope, Pen, Layers } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

interface SiteNavProps {
  backHref?:  string
  backLabel?: string
}

const SOLUTIONS_LINKS = [
  { href: '/solutions/education',       label: 'Education',         icon: GraduationCap },
  { href: '/solutions/hr',              label: 'HR & Recruiting',   icon: Users          },
  { href: '/solutions/media',           label: 'Media & Journalism',icon: Newspaper      },
  { href: '/solutions/legal',           label: 'Legal & Compliance',icon: Scale          },
  { href: '/solutions/security',        label: 'Cybersecurity',     icon: ShieldCheck    },
  { href: '/solutions/healthcare',      label: 'Healthcare',        icon: Heart          },
  { href: '/solutions/marketing',       label: 'Marketing & Brand', icon: Megaphone      },
  { href: '/solutions/research',        label: 'Research',          icon: Microscope     },
  { href: '/solutions/content-creators',label: 'Content Creators',  icon: Pen            },
]

const NAV_LINKS = [
  { href: '/solutions', label: 'Solutions', hasDropdown: true },
  { href: '/methodology', label: 'Methodology', hasDropdown: false },
  { href: '/pricing',  label: 'Pricing', hasDropdown: false  },
  { href: '/docs/api', label: 'API',     hasDropdown: false  },
  { href: '/blog',     label: 'Blog',    hasDropdown: false  },
]

export function SiteNav({ backHref, backLabel }: SiteNavProps) {
  const { user } = useAuth()
  const [open, setOpen]           = useState(false)
  const [solutionsOpen, setSolutionsOpen] = useState(false)
  const [mobileSolOpen, setMobileSolOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSolutionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Scroll lock — iOS-safe
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      return () => {
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.style.overflow = ''
        document.documentElement.style.overflow = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [open])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-white/[0.08] bg-[#08080d] isolate">
      <div className="max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto h-full px-4 sm:px-6 2xl:px-10 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-black text-lg gradient-text">Aiscern</span>
        </Link>

        {backHref ? (
          <Link href={backHref} className="text-sm text-text-muted hover:text-text-primary transition-colors">
            ← {backLabel ?? 'Back'}
          </Link>
        ) : (
          <>
            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-5">
              {NAV_LINKS.map(l => {
                if (l.hasDropdown) {
                  return (
                    <div key={l.href} className="relative" ref={dropdownRef}>
                      <button
                        className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors font-medium"
                        onClick={() => setSolutionsOpen(o => !o)}
                        aria-expanded={solutionsOpen}
                        aria-haspopup="true"
                      >
                        {l.label}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${solutionsOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {solutionsOpen && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[480px] bg-[#0a0a12] border border-border rounded-2xl shadow-2xl p-4 z-[80]">
                          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                            <Layers className="w-4 h-4 text-primary" />
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Industry Solutions</span>
                            <Link href="/solutions" className="ml-auto text-xs text-primary hover:underline" onClick={() => setSolutionsOpen(false)}>View all →</Link>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {SOLUTIONS_LINKS.map(sl => {
                              const SIcon = sl.icon
                              return (
                                <Link key={sl.href} href={sl.href} onClick={() => setSolutionsOpen(false)}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary/8 transition-colors group">
                                  <SIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                  <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">{sl.label}</span>
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                }
                return (
                  <Link key={l.href} href={l.href}
                    className="text-sm text-text-muted hover:text-text-primary transition-colors font-medium">
                    {l.label}
                  </Link>
                )
              })}
            </div>

            {/* Desktop CTA */}
            <div className="hidden sm:flex items-center gap-3">
              {user ? (
                <Link href="/dashboard"
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="text-sm text-text-muted hover:text-text-primary transition-colors font-medium">
                    Sign in
                  </Link>
                  <Link href="/signup"
                    className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
                    Get started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-surface"
              onClick={() => setOpen(o => !o)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </>
        )}
      </div>

      {/* Mobile menu */}
      {!backHref && open && (
        <>
          <div
            className="sm:hidden fixed inset-0 bg-black/70 z-[60]"
            onClick={() => setOpen(false)}
            style={{ touchAction: 'none' }}
          />
          <div className="sm:hidden fixed top-16 left-0 right-0 bg-[#0a0a12] border-b border-border z-[70] shadow-2xl">
            <div className="px-4 py-4 space-y-1 max-h-[calc(100svh-4rem)] overflow-y-auto">

              {/* Solutions accordion */}
              <div>
                <button
                  className="w-full flex items-center justify-between text-sm text-text-secondary hover:text-text-primary transition-colors font-medium py-3 px-3 rounded-lg hover:bg-surface min-h-[44px]"
                  onClick={() => setMobileSolOpen(o => !o)}
                >
                  Solutions
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileSolOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobileSolOpen && (
                  <div className="pl-4 pb-1 space-y-0.5">
                    <Link href="/solutions" onClick={() => setOpen(false)}
                      className="block text-xs text-primary py-2 px-3 rounded-lg hover:bg-surface font-semibold">
                      View All Solutions →
                    </Link>
                    {SOLUTIONS_LINKS.map(sl => {
                      const SIcon = sl.icon
                      return (
                        <Link key={sl.href} href={sl.href} onClick={() => setOpen(false)}
                          className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary py-2 px-3 rounded-lg hover:bg-surface transition-colors">
                          <SIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          {sl.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>

              {NAV_LINKS.filter(l => !l.hasDropdown).map(l => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                  className="block text-sm text-text-secondary hover:text-text-primary transition-colors font-medium py-3 px-3 rounded-lg hover:bg-surface active:scale-95 min-h-[44px] flex items-center">
                  {l.label}
                </Link>
              ))}

              <div className="pt-3 mt-2 border-t border-border/40 flex flex-col gap-2">
                {user ? (
                  <Link href="/dashboard" onClick={() => setOpen(false)}
                    className="block text-center px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setOpen(false)}
                      className="block text-center text-sm text-text-secondary py-2 hover:text-text-primary transition-colors">
                      Sign in
                    </Link>
                    <Link href="/signup" onClick={() => setOpen(false)}
                      className="block text-center px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
                      Get started free
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  )
}
