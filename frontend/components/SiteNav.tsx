'use client'
import Link    from 'next/link'
import Image   from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

interface SiteNavProps {
  backHref?:  string
  backLabel?: string
  scrollHide?: boolean
}

const NAV_LINKS = [
  { href: '/#tools',   label: 'Tools'   },
  { href: '/reviews',  label: 'Reviews' },
  { href: '/blog',     label: 'Blog'    },
  { href: '/pricing',  label: 'Pricing' },
  { href: '/docs/api', label: 'API'     },
]

export function SiteNav({ backHref, backLabel, scrollHide = false }: SiteNavProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const lastY = useRef(0)

  // Scroll hide / scrolled-state logic
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 10)
      if (scrollHide) {
        if (y > lastY.current + 10 && y > 100) setHidden(true)
        else if (y < lastY.current - 5) setHidden(false)
      }
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [scrollHide])

  // Scroll lock — iOS-safe: uses position:fixed to prevent html/body scroll
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
    <nav className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300 isolate
      ${hidden ? 'nav-hidden' : 'nav-visible'}
      ${scrolled
        ? 'border-b border-border/50 bg-background/95 backdrop-blur-2xl shadow-lg shadow-black/20'
        : 'border-b border-transparent bg-background/60 backdrop-blur-xl'
      }`}>
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group" title="Aiscern — Free AI Content Detector">
          <Image src="/logo.png" alt="Aiscern logo" width={24} height={28}
            className="object-contain h-6 sm:h-7 w-auto drop-shadow-[0_0_8px_rgba(37,99,235,0.4)] group-hover:drop-shadow-[0_0_14px_rgba(37,99,235,0.6)] transition-all duration-300"
            priority />
          <span className="font-bold text-xl gradient-text">Aiscern</span>
        </Link>

        {backHref ? (
          <Link href={backHref} className="text-sm text-text-muted hover:text-text-primary transition-colors">
            ← {backLabel ?? 'Back'}
          </Link>
        ) : (
          <>
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map(l => (
                <Link key={l.href} href={l.href}
                  className="text-sm text-text-muted hover:text-text-primary transition-colors duration-200 font-medium relative group">
                  {l.label}
                  <span className="absolute -bottom-0.5 left-0 w-0 h-[2px] bg-primary group-hover:w-full transition-all duration-300 rounded-full" />
                </Link>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <Link href="/dashboard"
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="text-sm text-text-muted hover:text-text-primary transition-colors font-medium px-4 py-2 rounded-xl border border-border/60 hover:bg-surface-hover hover:border-primary/30">
                    Sign in
                  </Link>
                  <Link href="/signup"
                    className="btn-primary px-4 py-2 text-sm font-bold">
                    Get started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile hamburger — min 44×44px touch target */}
            <button
              className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-surface"
              onClick={() => setOpen(o => !o)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </>
        )}
      </div>

      {/* Mobile menu — fixed overlay with solid background */}
      {!backHref && open && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/70 z-[60]"
            onClick={() => setOpen(false)}
            style={{ touchAction: 'none' }}
          />
          {/* Panel */}
          <div className="md:hidden fixed top-16 left-0 right-0 bg-[#0a0a12] border-b border-border z-[70] shadow-2xl">
            <div className="px-4 py-4 space-y-1 max-h-[calc(100svh-4rem)] overflow-y-auto">
              {NAV_LINKS.map(l => (
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
