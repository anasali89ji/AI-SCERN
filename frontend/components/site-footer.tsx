'use client'
import Link from 'next/link'
import { useState } from 'react'
import {
  Mail, Github, Twitter, ArrowRight, CheckCircle2, Loader2,
  Shield, Zap,
} from 'lucide-react'

const TOOLS_COL = [
  { label: 'Text Attestation',        href: '/detect/text'  },
  { label: 'Image Attestation', href: '/detect/image' },
  { label: 'Audio Attestation',       href: '/detect/audio' },
  { label: 'Video Attestation', href: '/detect/video' },
  { label: 'ARIA AI Assistant',       href: '/chat'         },
  { label: 'Batch Content Analyser',  href: '/batch'        },
]

const COMPANY_COL = [
  { label: 'About',       href: '/about'       },
  { label: 'Solutions',   href: '/solutions'   },
  { label: 'Methodology', href: '/methodology' },
  { label: 'Benchmarks',  href: '/benchmarks'  },
  { label: 'Pricing',     href: '/pricing'     },
  { label: 'Enterprise',  href: '/enterprise'  },
  { label: 'Blog',        href: '/blog'        },
  { label: 'Reviews',     href: '/reviews'     },
]

const DEVELOPERS_COL = [
  { label: 'API Docs',        href: '/docs/api'       },
  { label: 'Getting Started', href: '/docs/quickstart' },
  { label: 'FAQ',             href: '/faq'             },
  { label: 'Status',          href: '/status'          },
  { label: 'Changelog',       href: '/changelog'       },
]

const LEGAL_COL = [
  { label: 'Privacy Policy',   href: '/privacy' },
  { label: 'Terms of Service', href: '/terms'   },
  { label: 'Cookie Policy',    href: '/cookies' },
  { label: 'GDPR',             href: '/gdpr'    },
]

// NOTE: Deliberately not using the "SOC 2 Type II • GDPR Compliant • ISO 27001" trust
// bar copy — those are unverified certification claims we can't currently back up.
// Kept the existing honest badges instead.
const TRUST_BADGES = [
  { icon: Shield,   label: 'SOC 2 Ready'  },
  { icon: Zap,      label: 'API Available' },
  { icon: CheckCircle2, label: 'Free Tier' },
]

export function SiteFooter() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [sending, setSending] = useState(false)

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || sent) return
    setSending(true)
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) { setSent(true); setEmail('') }
    } catch {}
    setSending(false)
  }

  return (
    <footer className="border-t border-white/5 bg-depth-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">

        {/* Top grid — no viewport-entrance animation; footer is always below-fold */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[240px_1fr_1fr_1fr_1fr] gap-12 lg:gap-8">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 mb-5 group" aria-label="Aiscern home">
              <span className="font-heading font-black text-xl text-silver-900 tracking-tight group-hover:text-accent transition-colors duration-200">
                Aiscern
              </span>
            </Link>

            <p className="text-sm text-silver-700 leading-relaxed mb-6 max-w-[220px]">
              Free multi-modal AI content attestation. Text, image, audio, and video.
            </p>

            {/* Status */}
            <Link
              href="/status"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.06]
                         bg-surface text-xs text-silver-700 hover:border-accent/30 transition-colors duration-200
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" aria-hidden="true" />
              All systems operational
            </Link>

            {/* Trust badges */}
            <div className="mt-5 flex flex-col gap-2">
              {TRUST_BADGES.map(b => (
                <div key={b.label} className="flex items-center gap-2 text-xs text-silver-600">
                  <b.icon className="w-3.5 h-3.5 text-silver-500" aria-hidden="true" />
                  {b.label}
                </div>
              ))}
            </div>

            {/* Social */}
            <div className="mt-6 flex items-center gap-2">
              <a
                href="https://github.com/aiscern"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Aiscern on GitHub"
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/[0.06]
                           text-silver-600 hover:text-silver-900 hover:border-white/[0.16] transition-all duration-200
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <Github className="w-4 h-4" aria-hidden="true" />
              </a>
              <a
                href="https://twitter.com/aiscern"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Aiscern on X / Twitter"
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/[0.06]
                           text-silver-600 hover:text-silver-900 hover:border-white/[0.16] transition-all duration-200
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <Twitter className="w-4 h-4" aria-hidden="true" />
              </a>
              <a
                href="mailto:hello@aiscern.com"
                aria-label="Email Aiscern"
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/[0.06]
                           text-silver-600 hover:text-silver-900 hover:border-white/[0.16] transition-all duration-200
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Tools */}
          <FooterCol title="Tools">
            {TOOLS_COL.map(l => <FooterLink key={l.href} {...l} />)}
          </FooterCol>

          {/* Company */}
          <FooterCol title="Company">
            {COMPANY_COL.map(l => <FooterLink key={l.href} {...l} />)}
          </FooterCol>

          {/* Developers */}
          <FooterCol title="Developers">
            {DEVELOPERS_COL.map(l => <FooterLink key={l.href} {...l} />)}
          </FooterCol>

          {/* Newsletter */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-silver-700 mb-4">
              Newsletter
            </h3>
            <p className="text-sm text-silver-600 leading-relaxed mb-4">
              Attestation research, product updates, and AI news. Once a week.
            </p>

            {sent ? (
              <div className="flex items-center gap-2 text-sm text-accent">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                You&apos;re subscribed!
              </div>
            ) : (
              <form onSubmit={subscribe} className="flex flex-col gap-2">
                <label htmlFor="footer-email" className="sr-only">
                  Email address
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-surface-elevated
                                 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20
                                 transition-all duration-200 pl-4 pr-1.5 py-1.5">
                  <input
                    id="footer-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-transparent text-sm text-silver-800 placeholder-silver-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    aria-label="Subscribe"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md shrink-0
                               bg-accent hover:bg-accent-hover text-depth-bg text-xs font-semibold
                               transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed
                               focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    {sending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <>Subscribe <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" /></>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="border-t border-white/5 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-silver-600">
            © {new Date().getFullYear()} Aiscern. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {LEGAL_COL.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs text-silver-600 hover:text-silver-800 transition-colors duration-200"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-silver-700 mb-4">
        {title}
      </h3>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  )
}

function FooterLink({ label, href }: { label: string; href: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group inline-flex items-center gap-1 text-sm text-silver-600 hover:text-silver-800 transition-colors duration-200"
      >
        <span className="group-hover:translate-x-0.5 transition-transform duration-200">{label}</span>
      </Link>
    </li>
  )
}
