import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { Shield, Lock, Eye, Database, Server, CheckCircle, AlertTriangle, Globe } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Transparency & Data Privacy — Aiscern',
  description: 'How Aiscern processes scans, handles data, complies with GDPR, and protects user privacy. Full transparency on retention policy and data handling.',
  openGraph: {
    title: 'Transparency & Data Privacy — Aiscern',
    description: 'Full transparency on how Aiscern handles your data, processes scans, and complies with GDPR.',
    url: 'https://aiscern.com/transparency',
    siteName: 'Aiscern',
  },
}

const SECTIONS = [
  {
    icon: Eye,
    title: 'How Scans Are Processed',
    color: 'primary',
    items: [
      'Submitted content is sent over TLS 1.3 encrypted connections.',
      'Text is tokenized and passed through our ensemble inference pipeline (RoBERTa, Binoculars perplexity, Gemini) in ephemeral memory.',
      'Image content is analyzed through our ViT-based classifier and pixel-integrity pipeline — never permanently stored on our servers.',
      'Audio and video files are processed through a dedicated inference worker, analyzed, and the raw media is deleted after verdict generation.',
      'Scan results (verdict, confidence, model breakdown) are stored in your account history only if you are signed in and have not disabled history.',
      'Anonymous (unauthenticated) scans are processed ephemerally — no results are retained after the session ends.',
    ],
  },
  {
    icon: Database,
    title: 'Data Retention Policy',
    color: 'blue',
    items: [
      'Scan content (text, images, audio, video) is never permanently stored unless you explicitly save a report.',
      'Scan metadata (verdict, confidence score, timestamp) is retained for signed-in users to support scan history. You can delete this at any time from your settings.',
      'Account data (email, authentication) is retained until you delete your account.',
      'Anonymous scan data: no content or metadata is retained after the browser session ends.',
      'Newsletter subscribers: email only, retained until unsubscription.',
      'Log data for security and rate limiting is retained for 30 days in rolling fashion.',
    ],
  },
  {
    icon: Lock,
    title: 'GDPR Compliance',
    color: 'emerald',
    items: [
      'Aiscern is operated from Pakistan. We comply with GDPR obligations for EU/EEA users.',
      'Data subjects have rights to access, rectification, erasure, and data portability for any personal data we hold.',
      'We do not use submitted scan content for model training without explicit opt-in consent.',
      'We do not sell personal data to third parties under any circumstances.',
      'Third-party processors (Supabase, Vercel, Cloudflare) are GDPR-compliant and covered by Data Processing Agreements.',
      'Cookie usage is limited to functional and authentication cookies. No advertising or tracking cookies are set.',
      'To exercise your GDPR rights, contact privacy@aiscern.com.',
    ],
  },
  {
    icon: Server,
    title: 'Infrastructure & Security',
    color: 'amber',
    items: [
      'Hosted on Vercel (US/EU edge) with Cloudflare as a security and CDN layer.',
      'Database: Supabase PostgreSQL with Row Level Security enforced on all tables.',
      'Authentication: Clerk, a SOC 2 Type II certified identity provider.',
      'API communications use HMAC-signed requests with CSRF protection.',
      'Content Security Policy (CSP) headers enforced on all pages.',
      'Security disclosures can be reported to security@aiscern.com — see /security for our responsible disclosure policy.',
    ],
  },
  {
    icon: Globe,
    title: 'Third-Party Services',
    color: 'rose',
    items: [
      'Supabase (database) — GDPR compliant, EU data residency available.',
      'Vercel (hosting) — SOC 2 Type II certified.',
      'Cloudflare (CDN/WAF) — GDPR compliant.',
      'Clerk (authentication) — SOC 2 Type II, GDPR compliant.',
      'HuggingFace (model inference) — ephemeral inference, no data retention.',
      'Google Gemini (supplementary AI analysis) — processed per Google\'s API terms; no content storage by Google for API calls.',
    ],
  },
]

const colorMap: Record<string, { bg: string; border: string; icon: string }> = {
  primary: { bg: 'bg-[#2BEE34]/10', border: 'border-[#2BEE34]/20', icon: 'text-[#2BEE34]' },
  blue:    { bg: 'bg-[#2BEE34]/10', border: 'border-[#2BEE34]/20', icon: 'text-[#2BEE34]' },
  cyan:    { bg: 'bg-[#2BEE34]/10',    border: 'border-[#2BEE34]/20',    icon: 'text-[#2BEE34]'    },
  emerald: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
  amber:   { bg: 'bg-amber-500/8',   border: 'border-amber-500/20',   icon: 'text-amber-400'   },
  rose:    { bg: 'bg-rose-500/8',    border: 'border-rose-500/20',    icon: 'text-rose-400'    },
}

export default function TransparencyPage() {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-[#08080d] pt-16">
        {/* Hero */}
        <section className="py-16 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08)_0%,transparent_60%)] pointer-events-none" />
          <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 mb-6">
              <Shield className="w-3.5 h-3.5" />
              Full Transparency
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              How We Handle<br /><span className="text-[#2BEE34]">Your Data</span>
            </h1>
            <p className="text-lg text-[#A3A3A3] leading-relaxed">
              We believe users deserve to know exactly how their content is processed. No vague policies — just a clear, direct explanation of what happens to your data.
            </p>
          </div>
        </section>

        {/* Trust Badges */}
        <section className="pb-8">
          <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { icon: Shield, label: 'No Data Sold — Ever' },
                { icon: Lock, label: 'GDPR Compliant' },
                { icon: CheckCircle, label: 'Open Source Models' },
                { icon: AlertTriangle, label: 'SOC 2 In Progress' },
              ].map((badge, i) => {
                const BIcon = badge.icon
                return (
                  <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#141414] border border-[#1E1E1E] text-sm text-[#A3A3A3]">
                    <BIcon className="w-4 h-4 text-emerald-400" />
                    {badge.label}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-10 pb-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            {SECTIONS.map((section) => {
              const SIcon = section.icon
              const c = colorMap[section.color]
              return (
                <div key={section.title} className="card border border-[#1E1E1E] rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0`}>
                      <SIcon className={`w-5 h-5 ${c.icon}`} />
                    </div>
                    <h2 className="text-lg font-bold text-white">{section.title}</h2>
                  </div>
                  <ul className="space-y-3">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-[#A3A3A3] leading-relaxed">
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}

            {/* Contact */}
            <div className="text-center p-6 rounded-xl border border-[#2BEE34]/20 bg-[#2BEE34]/5">
              <h2 className="text-lg font-bold text-white mb-2">Questions about your data?</h2>
              <p className="text-sm text-[#6B6B6B] mb-4">Contact our privacy team or submit a GDPR data request.</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/contact" className="btn-primary text-sm">Contact Privacy Team</Link>
                <Link href="/privacy" className="btn-secondary text-sm">Full Privacy Policy</Link>
                <Link href="/dpa" className="btn-secondary text-sm">Data Processing Agreement</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
