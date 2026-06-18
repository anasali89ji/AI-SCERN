'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Mail, Github, Twitter, ArrowRight, CheckCircle, Zap } from 'lucide-react'

const TOOLS_COL = [
  { label: 'AI Text Detector',          href: '/detect/text'  },
  { label: 'Deepfake Image Detector',   href: '/detect/image' },
  { label: 'AI Audio Detector',         href: '/detect/audio' },
  { label: 'Deepfake Video Detector',   href: '/detect/video' },
  { label: 'ARIA AI Assistant',         href: '/chat'         },
  { label: 'Batch Content Analyser',    href: '/batch'        },
]

const COMPANY_COL = [
  { label: 'About',        href: '/about'        },
  { label: 'Solutions',    href: '/solutions'    },
  { label: 'Methodology',  href: '/methodology'  },
  { label: 'Benchmarks',   href: '/benchmarks'   },
  { label: 'Pricing',      href: '/pricing'      },
  { label: 'Enterprise',   href: '/enterprise'   },
  { label: 'Blog',         href: '/blog'         },
  { label: 'Reviews',      href: '/reviews'      },
]

const DEVELOPERS_COL = [
  { label: 'API Docs',       href: '/docs/api'      },
  { label: 'Getting Started',href: '/docs/quickstart'},
  { label: 'FAQ',            href: '/faq'           },
  { label: 'Status',         href: '/status'        },
  { label: 'Changelog',      href: '/changelog'     },
]

const LEGAL_COL = [
  { label: 'Privacy Policy',    href: '/privacy'   },
  { label: 'Terms of Service',  href: '/terms'     },
  { label: 'Cookie Policy',     href: '/cookies'   },
  { label: 'GDPR',              href: '/gdpr'      },
]

export function SiteFooter() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
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
    <footer className="border-t border-white/[0.07] bg-[#08080d]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[220px_1fr_1fr_1fr_1fr] gap-10 lg:gap-8">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group w-fit">
              <span className="font-black text-xl text-white tracking-tight group-hover:text-blue-400 transition-colors duration-200">
                Aiscern
              </span>
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed mb-5 max-w-[200px]">
              Free multi-modal AI content detection. Text, image, audio, and video.
            </p>
            {/* Status indicator */}
            <Link href="/status"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                         border border-white/[0.07] bg-[#0f0f17] text-xs text-slate-400
                         hover:border-white/[0.12] transition-all duration-200 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500-400 animate-pulse" />
              All systems operational
            </Link>
          </div>

          {/* Nav columns */}
          {[
            { title: 'Tools',      links: TOOLS_COL      },
            { title: 'Company',    links: COMPANY_COL    },
            { title: 'Developers', links: DEVELOPERS_COL },
            { title: 'Legal',      links: LEGAL_COL      },
          ].map(col => (
            <div key={col.title}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-600 mb-4">
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l.href}>
                    <Link href={l.href} title={l.label}
                      className="text-sm text-slate-500 hover:text-slate-200 transition-colors duration-200">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter + socials bar */}
        <div className="mt-14 pt-8 border-t border-white/[0.06]
                        flex flex-col lg:flex-row items-start lg:items-center
                        justify-between gap-8">

          {/* Newsletter */}
          <div className="w-full max-w-sm">
            <p className="text-sm font-semibold text-white mb-1">
              Stay up to date
            </p>
            <p className="text-xs text-slate-500 mb-3">
              New detection models, accuracy benchmarks, and product updates.
            </p>
            {sent ? (
              <div className="flex items-center gap-2 text-sm text-emerald-400-400 font-medium">
                <CheckCircle className="w-4 h-4" />Subscribed. Thanks!
              </div>
            ) : (
              <form onSubmit={subscribe} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 bg-[#0f0f17] border border-white/[0.08] rounded-xl
                             px-3.5 py-2 text-sm text-slate-200 placeholder:text-slate-600
                             focus:outline-none focus:border-blue-500/40 transition-colors h-10 min-w-0"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl
                             text-sm font-semibold transition-colors duration-200 h-10
                             flex items-center gap-1.5 shrink-0"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>

          {/* Right: socials + copyright */}
          <div className="flex flex-col items-start lg:items-end gap-4">
            <div className="flex items-center gap-2">
              {[
                { Icon: Github,  href: 'https://github.com/aiscern',         label: 'GitHub'   },
                { Icon: Twitter, href: 'https://twitter.com/aiscernai',      label: 'Twitter'  },
                { Icon: Mail,    href: 'mailto:contact@aiscern.com',          label: 'Email'    },
              ].map(({ Icon, href, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-xl border border-white/[0.08] flex items-center justify-center
                             text-slate-500 hover:text-white hover:border-white/[0.14]
                             transition-all duration-200">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
            <p className="text-xs text-slate-600">
              © {new Date().getFullYear()} Aiscern · All rights reserved
            </p>
          </div>
        </div>

        {/* SEO tag cloud */}
        <div className="mt-8 pt-6 border-t border-white/[0.04]">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[
              'Free AI Detector','ChatGPT Detector','Deepfake Detector','AI Text Checker',
              'Image AI Detector','Voice Clone Detector','AI Content Detection','DALL-E Detector',
              'Midjourney Detector','AI Detection Tool','Fake Text Detector','Claude Detector',
            ].map(tag => (
              <span key={tag} className="text-[10px] text-slate-700 hover:text-slate-500 transition-colors cursor-default">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
