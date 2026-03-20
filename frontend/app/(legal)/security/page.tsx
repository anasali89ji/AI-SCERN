import Link from 'next/link'
import { Shield, Lock, Server, Eye, ArrowLeft, CheckCircle, Mail } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security — Aiscern',
  description: 'How Aiscern protects your data — encryption, authentication, infrastructure security, and responsible disclosure.',
  alternates: { canonical: 'https://aiscern.com/security' },
}

const PRACTICES = [
  {
    icon: Lock,
    title: 'Encryption in Transit',
    body: 'All data transmitted to and from Aiscern is encrypted using TLS 1.3. API endpoints enforce HTTPS and reject unencrypted connections.',
  },
  {
    icon: Server,
    title: 'Infrastructure Security',
    body: 'Aiscern runs on Vercel\'s globally distributed edge network with DDoS protection. The AI pipeline runs on Cloudflare Workers with isolated execution contexts.',
  },
  {
    icon: Shield,
    title: 'Authentication',
    body: 'User authentication is handled by Clerk — a purpose-built auth platform with MFA support, session management, and anomaly detection. We do not store plaintext passwords.',
  },
  {
    icon: Server,
    title: 'Data Storage',
    body: 'User data is stored in Supabase (PostgreSQL) with Row Level Security policies enforced at the database level. Users can only access their own scan history and profile data.',
  },
  {
    icon: Eye,
    title: 'Data Minimisation',
    body: 'We collect only what is necessary to provide the service. Scan content is not stored permanently — only metadata (verdict, confidence, timestamp) is retained for your history.',
  },
  {
    icon: CheckCircle,
    title: 'Content Security Policy',
    body: 'All pages are served with a strict Content-Security-Policy header to prevent XSS attacks. X-Frame-Options and other security headers are enforced globally.',
  },
]

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto h-full px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Aiscern" className="w-8 h-6 object-contain" />
            <span className="font-black text-lg gradient-text">Aiscern</span>
          </Link>
          <Link href="/" className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary">
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </Link>
        </div>
      </nav>

      <main className="pt-24 pb-20 max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-3">Security at Aiscern</h1>
          <p className="text-text-muted max-w-xl mx-auto">
            We take the security of your data seriously. Here is how we protect the Aiscern platform and your information.
          </p>
        </div>

        {/* Security practices */}
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          {PRACTICES.map(p => (
            <div key={p.title} className="p-5 rounded-2xl border border-border bg-surface">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <p.icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold text-text-primary">{p.title}</h3>
              </div>
              <p className="text-sm text-text-muted leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

        {/* Responsible disclosure */}
        <div className="rounded-2xl border border-amber/20 bg-amber/5 p-6 sm:p-8">
          <h2 className="text-xl font-black text-text-primary mb-3 flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" />
            Responsible Disclosure
          </h2>
          <p className="text-text-muted text-sm leading-relaxed mb-4">
            If you discover a security vulnerability in Aiscern, please report it responsibly. We appreciate the security community's help in keeping Aiscern safe.
          </p>
          <ul className="space-y-2 mb-5">
            {[
              'Email us at security@aiscern.com with a detailed description',
              'Include steps to reproduce the vulnerability',
              'Give us reasonable time to investigate and fix before public disclosure',
              'Do not access or modify other users\' data',
            ].map(item => (
              <li key={item} className="flex items-start gap-2 text-sm text-text-muted">
                <CheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
          <a href="mailto:security@aiscern.com"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber/10 border border-amber/20 text-amber-400 text-sm font-semibold hover:bg-amber/20 transition-all">
            <Mail className="w-4 h-4" />
            security@aiscern.com
          </a>
        </div>

        <p className="text-xs text-text-disabled text-center mt-8">
          Last updated: March 20, 2026 · <Link href="/privacy" className="hover:text-text-muted">Privacy Policy</Link> · <Link href="/terms" className="hover:text-text-muted">Terms of Service</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
