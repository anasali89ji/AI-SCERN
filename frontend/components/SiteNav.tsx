'use client'
import Link    from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

interface SiteNavProps {
  backHref?:  string   // show a ← Back link instead of the full nav (e.g. "/blog")
  backLabel?: string
}

const NAV_LINKS = [
  { href: '/#tools',   label: 'Tools'   },
  { href: '/reviews',  label: 'Reviews' },
  { href: '/blog',     label: 'Blog'    },
  { href: '/pricing',  label: 'Pricing' },
  { href: '/docs/api', label: 'API'     },
]

export function SiteNav({ backHref, backLabel }: SiteNavProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.png" alt="Aiscern" className="w-8 h-6 object-contain" />
          <span className="font-black text-lg gradient-text">Aiscern</span>
        </Link>

        {/* Back link variant */}
        {backHref ? (
          <Link href={backHref}
            className="text-sm text-text-muted hover:text-text-primary transition-colors">
            ← {backLabel ?? 'Back'}
          </Link>
        ) : (
          <>
            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-6">
              {NAV_LINKS.map(l => (
                <Link key={l.href} href={l.href}
                  className="text-sm text-text-muted hover:text-text-primary transition-colors font-medium">
                  {l.label}
                </Link>
              ))}
            </div>

            {/* CTA */}
            <div className="hidden sm:flex items-center gap-3">
              {user ? (
                <Link href="/dashboard"
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login"
                    className="text-sm text-text-muted hover:text-text-primary transition-colors font-medium">
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
            <button className="sm:hidden p-2 text-text-muted" onClick={() => setOpen(o => !o)}
              aria-label="Toggle menu">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </>
        )}
      </div>

      {/* Mobile menu */}
      {!backHref && open && (
        <div className="sm:hidden absolute top-16 left-0 right-0 bg-background border-b border-border/50 px-4 py-4 space-y-3">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="block text-sm text-text-muted hover:text-text-primary transition-colors font-medium py-1">
              {l.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-border/40 flex flex-col gap-2">
            {user ? (
              <Link href="/dashboard" onClick={() => setOpen(false)}
                className="block text-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)}
                  className="block text-center text-sm text-text-muted py-1">Sign in</Link>
                <Link href="/signup" onClick={() => setOpen(false)}
                  className="block text-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
