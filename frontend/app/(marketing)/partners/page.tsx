import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { Handshake, Code2, Building2, Globe, ArrowRight, CheckCircle, Mail, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Partner Program — Aiscern',
  description: 'Integrate Aiscern AI detection into your platform. API access, white-label options, and reseller partnerships for technology providers.',
  openGraph: {
    title: 'Partner Program — Aiscern',
    url: 'https://aiscern.com/partners',
    siteName: 'Aiscern',
  },
}

const PARTNER_TYPES = [
  {
    icon: Code2,
    title: 'Technology Integration',
    desc: 'Embed Aiscern detection directly into your SaaS platform, CMS, LMS, or productivity tool via our REST API.',
    benefits: ['Full API access', 'Co-marketing opportunities', 'Dedicated integration support', 'Revenue share available'],
  },
  {
    icon: Building2,
    title: 'Reseller / Agency',
    desc: 'Resell Aiscern plans to your clients as part of a broader trust and safety or content verification offering.',
    benefits: ['Wholesale pricing', 'White-label reporting', 'Co-branded sales materials', 'Priority partner support'],
  },
  {
    icon: Globe,
    title: 'Research Partner',
    desc: 'Academic institutions and research labs can partner for dataset sharing, model evaluation, and joint research.',
    benefits: ['Free research access', 'Dataset collaboration', 'Co-authorship opportunities', 'Early model access'],
  },
]

export default function PartnersPage() {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-[#08080d] pt-16">
        {/* Hero */}
        <section className="py-20 md:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08)_0%,transparent_60%)] pointer-events-none" />
          <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-6">
              <Handshake className="w-3.5 h-3.5" />
              Partner Program
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-100 mb-5 leading-tight">
              Build on Aiscern.<br /><span className="gradient-text">Grow Together.</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
              Integrate multi-modal AI detection into your platform, resell to your clients, or collaborate on research. We&apos;re building the trust infrastructure for the AI age — join us.
            </p>
            <a href="mailto:partners@aiscern.com" className="btn-primary inline-flex items-center gap-2">
              <Mail className="w-4 h-4" /> Apply to Partner Program
            </a>
          </div>
        </section>

        {/* Partner Types */}
        <section className="py-16 border-t border-white/[0.08]/20">
          <div className="max-w-5xl 2xl:max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <h2 className="text-2xl md:text-3xl font-black text-slate-100 text-center mb-10">Partnership Types</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {PARTNER_TYPES.map((pt, i) => {
                const PIcon = pt.icon
                return (
                  <div key={i} className="card border border-white/[0.08] rounded-xl p-6">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                      <PIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="font-bold text-slate-100 mb-2">{pt.title}</h3>
                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">{pt.desc}</p>
                    <ul className="space-y-2">
                      {pt.benefits.map((b, j) => (
                        <li key={j} className="flex items-center gap-2 text-xs text-slate-400">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* API Access */}
        <section className="py-16 bg-surface/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-center gap-10">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-4">
                  <Zap className="w-3.5 h-3.5" /> API First
                </div>
                <h2 className="text-2xl font-black text-slate-100 mb-3">Full REST API Access</h2>
                <p className="text-slate-500 text-sm leading-relaxed mb-5">
                  Every detection capability is available via our documented REST API. Text, image, audio, and video detection endpoints with structured JSON responses. SDKs and code examples available in the docs.
                </p>
                <div className="flex gap-3 flex-wrap">
                  <Link href="/docs/api" className="btn-primary text-sm">API Documentation <ArrowRight className="w-4 h-4" /></Link>
                  <Link href="/pricing" className="btn-secondary text-sm">API Pricing</Link>
                </div>
              </div>
              <div className="flex-shrink-0 w-full lg:w-auto">
                <pre className="bg-background border border-white/[0.08] rounded-xl p-4 text-xs text-slate-400 overflow-x-auto font-mono">
{`POST /api/v1/detect/text
Content-Type: application/json
X-API-Key: your-key

{
  "text": "Content to analyze...",
  "options": { "detail": "full" }
}

→ {
  "verdict": "AI",
  "confidence": 0.87,
  "models": {
    "roberta": 0.91,
    "binoculars": 0.84,
    "gemini": 0.85
  }
}`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-20">
          <div className="max-w-2xl 2xl:max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center">
            <h2 className="text-2xl font-black text-slate-100 mb-4">Ready to partner with Aiscern?</h2>
            <p className="text-slate-400 mb-6 text-sm">Tell us about your platform, use case, and expected volume. We&apos;ll respond within 2 business days.</p>
            <a href="mailto:partners@aiscern.com?subject=Partnership Inquiry" className="btn-primary inline-flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email partners@aiscern.com
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
