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
              <Image src="/logo.png" alt="Aiscern AI Detection Platform Logo" width={36} height={36} className="rounded-lg" />
              <span className="font-black text-lg gradient-text">Aiscern</span>
            </div>
            <p className="text-text-muted text-sm leading-relaxed mb-4">
              Enterprise-grade multi-modal AI content detection. Detect deepfakes, synthetic text, AI audio, and more — in seconds.
            </p>
            <p className="text-xs text-text-disabled">
              Founded by <span className="text-text-secondary font-semibold">Anas Ali</span> · Islamabad, Pakistan
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Platform</h4>
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
            <h4 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Company</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'About Aiscern',  href: '/about',    title: 'About Aiscern — AI Detection Built on 285k+ Samples' },
                { label: 'Contact',        href: '/contact',  title: 'Contact Aiscern' },
                { label: 'API Docs',       href: '/docs/api', title: 'Aiscern API — AI Detection REST API for Developers' },
                { label: 'View AI Detector Plans', href: '/pricing', title: 'View AI Detector Plans' },
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
            <h4 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Privacy Policy',    href: '/privacy', title: 'Aiscern Privacy Policy' },
                { label: 'Terms of Service',  href: '/terms',   title: 'Aiscern Terms of Service' },
                { label: 'Security',          href: '/privacy', title: 'Aiscern Security Policy' },
              ].map(l => (
                <li key={l.label}>
                  <Link href={l.href} title={l.title} className="text-sm text-text-muted hover:text-text-primary transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <h4 className="text-sm font-bold text-text-primary mb-3 uppercase tracking-wider">Contact</h4>
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
            <p className="text-xs text-text-disabled">
              &copy; 2026 Aiscern. All rights reserved.
            </p>
            <p className="text-xs text-text-disabled">
              Testimonial photos courtesy of Unsplash photographers.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            <span className="text-xs text-text-muted">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
