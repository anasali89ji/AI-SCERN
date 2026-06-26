'use client'
import Link from 'next/link'
import { useState } from 'react'
import {
  Mail, Github, Twitter, ArrowRight, CheckCircle2, Loader2,
  Shield, Zap, FileText, Image as ImageIcon, Music, Video,
} from 'lucide-react'

const TOOLS_COL = [
  { label: 'AI Text Detector',        href: '/detect/text'  },
  { label: 'Deepfake Image Detector', href: '/detect/image' },
  { label: 'AI Audio Detector',       href: '/detect/audio' },
  { label: 'Deepfake Video Detector', href: '/detect/video' },
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

const TRUST_BADGES = [
  { icon: Shield,   label: 'SOC 2 Ready'      },
  { icon: Zap,      label: 'API Available'     },
  { icon: CheckCircle2, label: 'Free Tier'     },
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
    <footer className="border-t border-[#1E1E1E] bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">

        {/* Top grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[240px_1fr_1fr_1fr_1fr] gap-12 lg:gap-8">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 mb-5 group" aria-label="Aiscern home">
              <span className="font-black text-xl text-white tracking-tight group-hover:text-[#2BEE34] transition-colors duration-200">
                Aiscern
              </span>
            </Link>

            <p className="text-sm text-[#A3A3A3] leading-relaxed mb-6 max-w-[220px]">
              Free multi-modal AI content detection. Text, image, audio, and video.
            </p>

            {/* Status */}
            <Link
              href="/status"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1E1E1E]
                         bg-[#141414] text-xs text-[#A3A3A3] hover:border-[#2BEE34]/30 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#2BEE34] flex-shrink-0" />
              All systems operational
            </Link>

            {/* Trust badges */}
            <div className="mt-5 flex flex-col gap-2">
              {TRUST_BADGES.map(b => (
                <div key={b.label} className="flex items-center gap-2 text-xs text-[#6B6B6B]">
                  <b.icon className="w-3.5 h-3.5 text-[#3A3A3A]" />
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
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#1E1E1E]
                           text-[#6B6B6B] hover:text-white hover:border-[#2A2A2A] transition-all"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com/aiscern"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Aiscern on X / Twitter"
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#1E1E1E]
                           text-[#6B6B6B] hover:text-white hover:border-[#2A2A2A] transition-all"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="mailto:hello@aiscern.com"
                aria-label="Email Aiscern"
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#1E1E1E]
                           text-[#6B6B6B] hover:text-white hover:border-[#2A2A2A] transition-all"
              >
                <Mail className="w-4 h-4" />
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
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#A3A3A3] mb-4">
              Newsletter
            </h3>
            <p className="text-sm text-[#6B6B6B] leading-relaxed mb-4">
              Detection research, product updates, and AI news. Once a week.
            </p>

            {sent ? (
              <div className="flex items-center gap-2 text-sm text-[#2BEE34]">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                You&apos;re subscribed!
              </div>
            ) : (
              <form onSubmit={subscribe} className="flex flex-col gap-2">
                <label htmlFor="footer-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="footer-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-2.5
                             text-sm text-[#E5E5E5] placeholder-[#6B6B6B]
                             focus:border-[#2BEE34] focus:ring-1 focus:ring-[#2BEE34]/30 focus:outline-none
                             transition-all duration-150"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                             bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] text-sm font-semibold
                             transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Subscribe <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[#1E1E1E] mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#6B6B6B]">
            © {new Date().getFullYear()} Aiscern. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {LEGAL_COL.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs text-[#6B6B6B] hover:text-[#A3A3A3] transition-colors"
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
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#A3A3A3] mb-4">
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
        className="text-sm text-[#6B6B6B] hover:text-[#E5E5E5] transition-colors duration-150"
      >
        {label}
      </Link>
    </li>
  )
}
