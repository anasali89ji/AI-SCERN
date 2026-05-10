'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Mail, ArrowRight, ExternalLink, Zap } from 'lucide-react'

const PLATFORM_LINKS = [
  { label: 'Text Detector',  href: '/detect/text',  title: 'Free AI Text Detector' },
  { label: 'Image Detector', href: '/detect/image', title: 'Deepfake Image Detector' },
  { label: 'Audio Detector', href: '/detect/audio', title: 'AI Audio & Voice Clone Detector' },
  { label: 'Video Detector', href: '/detect/video', title: 'Free Deepfake Video Detector' },
  { label: 'AI Assistant',   href: '/chat',         title: 'AI Detection Assistant' },
  { label: 'Batch Analyser', href: '/batch',        title: 'Batch AI Content Analyser' },
]

const COMPANY_LINKS = [
  { label: 'About',       href: '/about',       title: 'About Aiscern' },
  { label: 'Methodology', href: '/methodology', title: 'Detection Methodology' },
  { label: 'Pricing',     href: '/pricing',     title: 'Pricing — Aiscern' },
  { label: 'Roadmap',     href: '/roadmap',     title: 'Product Roadmap' },
  { label: 'Changelog',   href: '/changelog',   title: 'Release Changelog' },
  { label: 'FAQ',         href: '/faq',         title: 'Frequently Asked Questions' },
  { label: 'Blog',        href: '/blog',        title: 'Aiscern Blog' },
  { label: 'Reviews',     href: '/reviews',     title: 'User Reviews' },
  { label: 'API Docs',    href: '/docs/api',    title: 'API Documentation' },
]

const LEGAL_LINKS = [
  { label: 'Privacy Policy',   href: '/privacy',  title: 'Privacy Policy — Aiscern' },
  { label: 'Terms of Service', href: '/terms',    title: 'Terms of Service — Aiscern' },
  { label: 'Security',         href: '/security', title: 'Aiscern Security' },
]

function FooterLink({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} title={title}
        className="group text-sm text-text-muted hover:text-text-primary transition-colors duration-200 flex items-center gap-1">
        {children}
        <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all duration-200" />
      </Link>
    </li>
  )
}

export function SiteFooter() {
  const [email, setEmail] = useState('')
  const [subState, setSubState] = useState<'idle' | 'sent'>('idle')

  const handleSub = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return
    setSubState('sent')
    setEmail('')
    setTimeout(() => setSubState('idle'), 4000)
  }

  return (
    <footer className="border-t border-border/20 relative overflow-hidden">
      {/* Subtle top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, rgba(139,92,246,0.05) 0%, transparent 70%)' }} />

      <div className="max-w-6xl mx-auto px-4 pt-14 pb-8 relative">

        {/* Main grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-12 mb-12">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <Image src="/logo.png" alt="Aiscern AI Detection Platform Logo"
                width={31} height={36}
                className="object-contain h-8 w-auto drop-shadow-[0_0_10px_rgba(245,100,0,0.45)]" />
              <span className="font-black text-xl gradient-text">Aiscern</span>
            </div>

            <p className="text-text-muted text-sm leading-relaxed mb-4">
              Multi-modal AI content detection. Ensemble-based analysis across text, image, audio, and video. Free tier available.
            </p>

            <span className="inline-flex items-center gap-1.5 text-xs text-amber/80 bg-amber/8 border border-amber/20 px-2.5 py-1 rounded-full mb-4">
              🚧 Early Access — Some features are experimental
            </span>

            <p className="text-xs text-text-muted">
              Founded by <span className="text-text-secondary font-semibold">Anas Ali</span> · Islamabad, Pakistan
            </p>

            {/* Social icons */}
            <div className="mt-5 flex gap-3">
              <a href="https://twitter.com/aiscern" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl border border-border/60 bg-surface/40 flex items-center justify-center text-text-muted hover:text-purple-400 hover:border-purple-500/30 hover:bg-purple-500/8 transition-all duration-200"
                title="Aiscern on Twitter/X">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.243 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://linkedin.com/company/aiscern" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl border border-border/60 bg-surface/40 flex items-center justify-center text-text-muted hover:text-purple-400 hover:border-purple-500/30 hover:bg-purple-500/8 transition-all duration-200"
                title="Aiscern on LinkedIn">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              <a href="mailto:contact@aiscern.com"
                className="w-9 h-9 rounded-xl border border-border/60 bg-surface/40 flex items-center justify-center text-text-muted hover:text-purple-400 hover:border-purple-500/30 hover:bg-purple-500/8 transition-all duration-200"
                title="Email Aiscern">
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-xs font-bold text-text-primary mb-5 uppercase tracking-widest">Platform</h3>
            <ul className="space-y-3">
              {PLATFORM_LINKS.map(l => <FooterLink key={l.href} href={l.href} title={l.title}>{l.label}</FooterLink>)}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs font-bold text-text-primary mb-5 uppercase tracking-widest">Company</h3>
            <ul className="space-y-3">
              {COMPANY_LINKS.map(l => <FooterLink key={l.label} href={l.href} title={l.title}>{l.label}</FooterLink>)}
            </ul>
          </div>

          {/* Legal + Newsletter */}
          <div>
            <h3 className="text-xs font-bold text-text-primary mb-5 uppercase tracking-widest">Legal</h3>
            <ul className="space-y-3 mb-7">
              {LEGAL_LINKS.map(l => <FooterLink key={l.label} href={l.href} title={l.title}>{l.label}</FooterLink>)}
              <li>
                <Link href="/contact" className="group text-sm text-text-muted hover:text-text-primary transition-colors flex items-center gap-1">
                  Contact Us
                  <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all duration-200" />
                </Link>
              </li>
            </ul>

            {/* Newsletter */}
            <div className="p-4 rounded-xl border border-border/50 bg-surface/30">
              <p className="text-xs font-semibold text-text-primary mb-1">Stay updated</p>
              <p className="text-xs text-text-muted mb-3">Get notified on new features &amp; accuracy improvements.</p>
              {subState === 'sent' ? (
                <div className="text-xs text-emerald flex items-center gap-1.5 py-1">
                  <span className="w-4 h-4 rounded-full bg-emerald/20 flex items-center justify-center text-[10px]">✓</span>
                  You're on the list!
                </div>
              ) : (
                <form onSubmit={handleSub} className="flex gap-2">
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                  <button type="submit"
                    className="px-3 py-2 rounded-lg text-white text-xs font-bold flex-shrink-0 transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    <Zap className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/20 pt-6 mb-5">
          <p className="text-xs text-text-disabled text-center leading-relaxed max-w-2xl mx-auto">
            Detection results are probabilistic, not definitive. Use human judgment for high-stakes decisions.
            Aiscern is an early-access product — accuracy benchmarks reflect current model performance and will improve over time.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-text-disabled">
            © {new Date().getFullYear()} Aiscern · Built with precision in Islamabad, Pakistan
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
              </span>
              <span className="text-xs text-text-muted">All systems operational</span>
            </div>
            <a href="https://aiscern.com" className="text-xs text-text-disabled hover:text-text-muted transition-colors flex items-center gap-1">
              aiscern.com <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
