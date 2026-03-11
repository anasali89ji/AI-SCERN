'use client'
import Link from 'next/link'
import { Shield, Mail, Twitter } from 'lucide-react'

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/30 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-black text-lg gradient-text">DETECTAI</span>
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
                { label: 'Image Detection',    href: '/detect/image' },
                { label: 'Video Detection',    href: '/detect/video' },
                { label: 'Audio Detection',    href: '/detect/audio' },
                { label: 'Text Detection',     href: '/detect/text'  },
                { label: 'AI Chat Assistant',  href: '/chat'         },
                { label: 'Batch Analysis',     href: '/batch'        },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-text-muted hover:text-text-primary transition-colors">
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
                { label: 'About Us',    href: '/about'   },
                { label: 'Contact',     href: '/contact' },
                { label: 'Careers',     href: '/contact' },
                { label: 'Blog',        href: '/about'   },
              ].map(l => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-text-muted hover:text-text-primary transition-colors">
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
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Security',  href: '/privacy' },
              ].map(l => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-text-muted hover:text-text-primary transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <h4 className="text-sm font-bold text-text-primary mb-3 uppercase tracking-wider">Contact</h4>
              <a href="mailto:contact@detectai.io"
                className="flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors">
                <Mail className="w-4 h-4" /> contact@detectai.io
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-disabled">
            &copy; {new Date().getFullYear()} DETECTAI. All rights reserved.
          </p>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            <span className="text-xs text-text-muted">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
