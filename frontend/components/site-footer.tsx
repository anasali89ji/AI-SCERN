'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Mail } from 'lucide-react'

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/30 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 mb-10">

          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1 pb-2 sm:pb-0">
            <div className="flex items-center gap-2 mb-3">
              <Image src="/logo.png" alt="Aiscern AI Detection Platform Logo" width={31} height={36} className="object-contain h-8 w-auto drop-shadow-[0_0_8px_rgba(245,100,0,0.4)]" />
              <span className="font-black text-lg gradient-text">Aiscern</span>
            </div>
            <p className="text-text-muted text-sm leading-relaxed mb-3">
              Multi-modal AI content detection. Ensemble-based analysis across text, image, audio, and video. Free tier available.
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs text-amber/80 bg-amber/8 border border-amber/20 px-2.5 py-1 rounded-full">
              🚧 Early Access — Some features are experimental
            </span>
            <p className="text-xs text-text-muted mt-3">
              Founded by <span className="text-text-secondary font-semibold">Anas Ali</span> · Islamabad, Pakistan
            </p>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Platform</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Text Detector',      href: '/detect/text',  title: 'Free AI Text Detector' },
                { label: 'Image Detector',     href: '/detect/image', title: 'Deepfake Image Detector' },
                { label: 'Audio Detector',     href: '/detect/audio', title: 'AI Audio & Voice Clone Detector' },
                { label: 'Video Detector',     href: '/detect/video', title: 'Free Deepfake Video Detector' },
                { label: 'AI Assistant',       href: '/chat',         title: 'AI Detection Assistant' },
                { label: 'Batch Analyser',     href: '/batch',        title: 'Batch AI Content Analyser' },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} title={l.title} className="text-sm text-text-muted hover:text-text-primary transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Company</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'About',        href: '/about',     title: 'About Aiscern' },
                { label: 'Methodology',  href: '/methodology', title: 'Detection Methodology' },
                { label: 'Pricing',      href: '/pricing',   title: 'Pricing — Aiscern' },
                { label: 'Roadmap',      href: '/roadmap',   title: 'Product Roadmap' },
                { label: 'Changelog',    href: '/changelog', title: 'Release Changelog' },
                { label: 'FAQ',          href: '/faq',       title: 'Frequently Asked Questions' },
                { label: 'Blog',         href: '/blog',      title: 'Aiscern Blog' },
                { label: 'Reviews',      href: '/reviews',   title: 'User Reviews' },
                { label: 'API Docs',     href: '/docs/api',  title: 'API Documentation' },
              ].map(l => (
                <li key={l.label}>
                  <Link href={l.href} title={l.title} className="text-sm text-text-muted hover:text-text-primary transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + Contact */}
          <div>
            <h3 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Legal</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Privacy Policy',   href: '/privacy',   title: 'Privacy Policy — Aiscern' },
                { label: 'Terms of Service', href: '/terms',     title: 'Terms of Service — Aiscern' },
                { label: 'Security',         href: '/security',  title: 'Aiscern Security' },
              ].map(l => (
                <li key={l.label}>
                  <Link href={l.href} title={l.title} className="text-sm text-text-muted hover:text-text-primary transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <h3 className="text-sm font-bold text-text-primary mb-3 uppercase tracking-wider">Contact</h3>
              <ul className="space-y-2">
                <li>
                  <a href="mailto:contact@aiscern.com" title="Email Aiscern"
                    className="flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors">
                    <Mail className="w-4 h-4" /> contact@aiscern.com
                  </a>
                </li>
                <li>
                  <Link href="/contact" className="text-sm text-text-muted hover:text-primary transition-colors">
                    Contact page →
                  </Link>
                </li>
              </ul>
            </div>

            {/* Social */}
            <div className="mt-5 flex gap-3">
              <a href="https://twitter.com/aiscern" target="_blank" rel="noopener noreferrer"
                className="text-text-disabled hover:text-primary transition-colors" title="Aiscern on Twitter/X">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.243 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://linkedin.com/company/aiscern" target="_blank" rel="noopener noreferrer"
                className="text-text-disabled hover:text-primary transition-colors" title="Aiscern on LinkedIn">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="border-t border-border pt-6 mb-4">
          <p className="text-xs text-text-disabled text-center leading-relaxed max-w-2xl mx-auto">
            Detection results are probabilistic, not definitive. Use human judgment for high-stakes decisions.
            Aiscern is an early-access product — accuracy benchmarks reflect current model performance and will improve over time.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-text-disabled">
            © {new Date().getFullYear()} Aiscern · Built by Anas Ali in Islamabad, Pakistan
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            <span className="text-xs text-text-muted">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
