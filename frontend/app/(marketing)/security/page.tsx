import Link from 'next/link'
import { SiteNav }    from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { Shield, Lock, Eye, Server, AlertTriangle, CheckCircle } from 'lucide-react'

export const metadata = {
  title: 'Security | Aiscern',
  description: 'How Aiscern protects your data — encryption, data handling, retention policies, and responsible disclosure.',
  openGraph: { title: 'Security | Aiscern', url: 'https://aiscern.com/security' },
}

const PRACTICES = [
  {
    icon: Lock,
    title: 'Data in transit',
    items: [
      'All traffic served over HTTPS/TLS 1.3',
      'HSTS enforced with 1-year max-age',
      'Strict-Transport-Security header on all responses',
    ],
  },
  {
    icon: Server,
    title: 'Data at rest',
    items: [
      'Supabase stores all scan metadata — AES-256 encrypted at rest',
      'Uploaded files stored in Cloudflare R2 — server-side encrypted',
      'API keys stored as hashed values only — plaintext never persisted',
    ],
  },
  {
    icon: Eye,
    title: 'Data access',
    items: [
      'Row-Level Security (RLS) enforced on all Supabase tables',
      'Users can only read and modify their own scan records',
      'Service-role key used server-side only, never exposed to clients',
      'Clerk handles authentication — we never store passwords',
    ],
  },
  {
    icon: Shield,
    title: 'API security',
    items: [
      'Public API requires valid API key — validated against Supabase on every request',
      'Per-IP rate limiting via Upstash Redis (60 req/min)',
      'Daily quota enforced per API key (1000 calls/day default)',
      'X-Frame-Options, X-Content-Type-Options, and COOP headers set',
      'Content Security Policy restricts script/style sources',
    ],
  },
]

const RETENTION = [
  { item: 'Scan results (verdict, confidence, signals)', retention: 'Retained indefinitely — visible in your History' },
  { item: 'Uploaded files (images, audio, video)',       retention: 'Deleted from R2 after 24 hours automatically' },
  { item: 'Scan content previews (text)',                retention: 'First 500 characters stored for History display' },
  { item: 'Anonymous scans (no account)',                retention: 'Not persisted — results shown in session only' },
  { item: 'API keys',                                    retention: 'Stored as hash — retained until you delete them' },
]

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <SiteNav />

      <main className="pt-24 pb-20 max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-4">
            <Shield className="w-3 h-3" /> Security
          </div>
          <h1 className="text-3xl sm:text-5xl font-black mb-4">
            How we protect <span className="gradient-text">your data</span>
          </h1>
          <p className="text-text-muted text-base sm:text-lg max-w-2xl mx-auto">
            A plain-English explanation of what data we collect, how it's secured, and how long we keep it.
          </p>
        </div>

        {/* Summary card */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 mb-12">
          <h2 className="font-black text-lg mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" /> The short version
          </h2>
          <ul className="space-y-2 text-sm text-text-muted">
            {[
              'Uploaded files are deleted within 24 hours — we do not keep your images, audio, or video',
              'Text content previews (first 500 chars) are stored for your History — delete anytime',
              'Anonymous scans are never stored — if you scan without an account, nothing is saved',
              'We never sell your data or use it for advertising',
              'API keys are stored as one-way hashes — we cannot recover the original key',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Security practices */}
        <div className="grid sm:grid-cols-2 gap-5 mb-14">
          {PRACTICES.map(({ icon: Icon, title, items }) => (
            <div key={title} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <h3 className="font-bold text-sm">{title}</h3>
              </div>
              <ul className="space-y-2">
                {items.map(item => (
                  <li key={item} className="flex items-start gap-2 text-xs text-text-muted leading-relaxed">
                    <span className="w-1 h-1 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Data retention table */}
        <section className="mb-14">
          <h2 className="text-xl font-black mb-5">Data retention</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-4 py-3 font-semibold text-text-primary w-1/2">Data</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-primary">Retention</th>
                </tr>
              </thead>
              <tbody>
                {RETENTION.map(({ item, retention }, i) => (
                  <tr key={item} className={i % 2 === 0 ? 'bg-background' : 'bg-surface'}>
                    <td className="px-4 py-3 text-text-muted text-xs">{item}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{retention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Responsible disclosure */}
        <section className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6 mb-10">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h2 className="font-black text-lg">Responsible disclosure</h2>
          </div>
          <p className="text-sm text-text-muted leading-relaxed mb-3">
            If you discover a security vulnerability in Aiscern, please report it responsibly before disclosing publicly. We investigate all credible reports promptly.
          </p>
          <p className="text-sm text-text-muted">
            Contact: <a href="mailto:security@aiscern.com" className="text-primary hover:underline">security@aiscern.com</a>
          </p>
        </section>

        {/* Links */}
        <div className="flex flex-wrap gap-4 justify-center text-sm">
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          <Link href="/terms"   className="text-primary hover:underline">Terms of Service</Link>
          <Link href="/contact" className="text-primary hover:underline">Contact Us</Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
