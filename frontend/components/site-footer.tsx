'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, ArrowRight, ExternalLink, Zap, Headphones, Shield } from 'lucide-react'

const PLATFORM_LINKS = [
  { label: 'Text Detector',  href: '/detect/text',  title: 'Free AI Text Detector' },
  { label: 'Image Detector', href: '/detect/image', title: 'Deepfake Image Detector' },
  { label: 'Audio Detector', href: '/detect/audio', title: 'AI Audio & Voice Clone Detector' },
  { label: 'Video Detector', href: '/detect/video', title: 'Free Deepfake Video Detector' },
  { label: 'AI Assistant',   href: '/chat',         title: 'AI Detection Assistant' },
  { label: 'Batch Analyser', href: '/batch',        title: 'Batch AI Content Analyser' },
]

const COMPANY_LINKS = [
  { label: 'About',        href: '/about',        title: 'About Aiscern' },
  { label: 'Solutions',    href: '/solutions',    title: 'Industry Solutions — Aiscern' },
  { label: 'Methodology',  href: '/methodology',  title: 'Detection Methodology' },
  { label: 'Benchmarks',   href: '/benchmarks',   title: 'Accuracy Benchmarks' },
  { label: 'Pricing',      href: '/pricing',      title: 'Pricing — Aiscern' },
  { label: 'Enterprise',   href: '/enterprise',   title: 'Enterprise — Aiscern' },
  { label: 'Blog',         href: '/blog',         title: 'Aiscern Blog' },
  { label: 'Reviews',      href: '/reviews',      title: 'User Reviews' },
  { label: 'API Docs',     href: '/docs/api',     title: 'API Documentation' },
  { label: 'FAQ',          href: '/faq',          title: 'Frequently Asked Questions' },
]

const LEGAL_LINKS = [
  { label: 'Privacy Policy',   href: '/privacy',       title: 'Privacy Policy — Aiscern' },
  { label: 'Terms of Service', href: '/terms',         title: 'Terms of Service — Aiscern' },
  { label: 'DPA',              href: '/dpa',           title: 'Data Processing Agreement — Aiscern' },
  { label: 'Accessibility',    href: '/accessibility', title: 'Accessibility Statement — Aiscern' },
  { label: 'Security',         href: '/security',      title: 'Aiscern Security' },
  { label: 'Contact Us',       href: '/contact',       title: 'Contact Aiscern' },
]

function FooterLink({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} title={title}
        className="text-sm text-slate-500 hover:text-slate-300 transition-colors duration-200">
        {children}
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
    <footer className="border-t border-white/[0.08] bg-[#0f0f17]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">

        {/* Main grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-12 mb-12">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <Image src="/logo.png" alt="Aiscern" width={31} height={36} className="object-contain h-8 w-auto" />
              <span className="font-black text-xl text-white">Aiscern</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              Multi-modal AI content detection. Ensemble-based analysis across text, image, audio, and video. Free tier available.
            </p>
            <p className="text-xs text-slate-600">
              Founded by <span className="text-slate-400 font-medium">Anas Ali</span> · Mandi Bahauddin, Pakistan
            </p>
            <div className="mt-5 flex gap-3">
              {[
                { href: 'https://twitter.com/aiscern', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.243 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>, title: 'Aiscern on Twitter/X' },
                { href: 'https://linkedin.com/company/aiscern', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>, title: 'Aiscern on LinkedIn' },
                { href: 'mailto:contact@aiscern.com', icon: <Mail className="w-4 h-4" />, title: 'contact@aiscern.com' },
                { href: 'mailto:support@aiscern.com', icon: <Headphones className="w-4 h-4" />, title: 'support@aiscern.com' },
                { href: 'mailto:security@aiscern.com', icon: <Shield className="w-4 h-4" />, title: 'security@aiscern.com' },
              ].map((s) => (
                <a key={s.href} href={s.href} title={s.title}
                  target={s.href.startsWith('http') ? '_blank' : undefined}
                  rel={s.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="w-9 h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-slate-500 hover:text-slate-300 hover:border-white/[0.12] transition-colors duration-200">
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-xs font-medium text-slate-300 mb-5 uppercase tracking-wider">Platform</h3>
            <ul className="space-y-3">
              {PLATFORM_LINKS.map(l => <FooterLink key={l.href} href={l.href} title={l.title}>{l.label}</FooterLink>)}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs font-medium text-slate-300 mb-5 uppercase tracking-wider">Company</h3>
            <ul className="space-y-3">
              {COMPANY_LINKS.map(l => <FooterLink key={l.label} href={l.href} title={l.title}>{l.label}</FooterLink>)}
            </ul>
          </div>

          {/* Legal + Newsletter */}
          <div>
            <h3 className="text-xs font-medium text-slate-300 mb-5 uppercase tracking-wider">Legal</h3>
            <ul className="space-y-3 mb-7">
              {LEGAL_LINKS.map(l => <FooterLink key={l.label} href={l.href} title={l.title}>{l.label}</FooterLink>)}
            </ul>
            <div className="p-4 rounded-xl border border-white/[0.08] bg-[#08080d]">
              <p className="text-xs font-medium text-slate-300 mb-1">Stay updated</p>
              <p className="text-xs text-slate-500 mb-3">Get notified on new features & accuracy improvements.</p>
              {subState === 'sent' ? (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5 py-1">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">✓</span>
                  You&apos;re on the list!
                </div>
              ) : (
                <form onSubmit={handleSub} className="flex gap-2">
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="flex-1 min-w-0 bg-[#0f0f17] border border-white/[0.08] rounded-md px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                  />
                  <button type="submit" aria-label="Subscribe"
                    className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs flex-shrink-0 transition-colors">
                    <Zap className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="border-t border-white/[0.06] pt-6 mb-5">
          <p className="text-xs text-slate-600 text-center leading-relaxed max-w-2xl mx-auto">
            Detection results are probabilistic, not definitive. Use human judgment for high-stakes decisions.
            Accuracy benchmarks reflect current model performance and will improve over time.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} Aiscern · Built with precision in Mandi Bahauddin, Pakistan
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-500">All systems operational</span>
            </div>
            <a href="https://github.com/anasali89ji/AI-SCERN" target="_blank" rel="noopener noreferrer"
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1">
              GitHub <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
