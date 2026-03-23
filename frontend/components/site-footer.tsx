'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Twitter } from 'lucide-react'

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/30 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Image src="/logo.png" alt="Aiscern AI Detection Platform Logo" width={50} height={34} className="object-contain drop-shadow-[0_0_8px_rgba(245,100,0,0.4)]" />
              <span className="font-black text-lg gradient-text">Aiscern</span>
            </div>
            <p className="text-text-muted text-sm leading-relaxed mb-4">
              Enterprise-grade multi-modal AI content detection. Detect deepfakes, synthetic text, AI audio, and more — in seconds.
            </p>
            <p className="text-xs text-text-muted">
              Founded by <span className="text-text-secondary font-semibold">Anas Ali</span> · Islamabad, Pakistan
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Platform</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Deepfake Image Detector',           href: '/detect/image', title: 'Deepfake Image Detector' },
                { label: 'Free Deepfake Video Detector',      href: '/detect/video', title: 'Free Deepfake Video Detector' },
                { label: 'AI Audio & Voice Clone Detector',   href: '/detect/audio', title: 'AI Audio & Voice Clone Detector' },
                { label: 'Free AI Text Detector',             href: '/detect/text',  title: 'Free AI Text Detector' },
                { label: 'AI Detection Assistant',            href: '/chat',         title: 'AI Detection Assistant' },
                { label: 'Batch AI Content Analyser',         href: '/batch',        title: 'Batch AI Content Analyser' },
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
                { label: 'About Aiscern',  href: '/about',    title: 'About Aiscern — AI Detection Built on 413k+ Samples' },
                { label: 'Contact',        href: '/contact',  title: 'Contact Aiscern' },
                { label: 'API Docs',       href: '/docs/api', title: 'Aiscern API — AI Detection REST API for Developers' },
                { label: 'Free Forever', href: '/pricing', title: 'Aiscern is Free' },
                { label: 'Reviews',        href: '/reviews',  title: 'Aiscern User Reviews' },
              ].map(l => (
                <li key={l.label}>
                  <Link href={l.href} title={l.title} className="text-sm text-text-muted hover:text-text-primary transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Legal</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Privacy Policy',    href: '/privacy', title: 'Aiscern Privacy Policy' },
                { label: 'Terms of Service',  href: '/terms',   title: 'Aiscern Terms of Service' },
                { label: 'Security',          href: '/security', title: 'Aiscern Security Policy' },
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
              <a href="mailto:contact@aiscern.com" title="Email Aiscern"
                className="flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors">
                <Mail className="w-4 h-4" /> contact@aiscern.com
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <p className="text-xs text-text-muted">
              © {new Date().getFullYear()} Aiscern · Built by <span className="font-semibold text-text-secondary">Anas Ali</span> · Islamabad, Pakistan
            </p>
            <p className="text-xs text-text-disabled">
              Reviewer photos courtesy of Unsplash.
            </p>
          </div>
          <div className="flex items-center gap-4">
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

    </footer>
  )
}
