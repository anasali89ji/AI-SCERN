'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Shield, ArrowLeft, Mail, MessageSquare, Clock, Send, CheckCircle, Twitter, Linkedin, Github } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'

const SUBJECTS = ['General Inquiry','Bug Report','Enterprise Inquiry','Partnership','Press / Media','API Access','Other']

export default function ContactPage() {
  const [form, setForm] = useState({ name:'', email:'', subject: SUBJECTS[0], message:'' })
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const submit = async () => {
    if (!form.name || !form.email || !form.message) return
    setSending(true); setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to send')
      setSent(true)
    } catch {
      setError('Failed to send. Please email us directly at contact@aiscern.com')
    }
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto h-full px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Aiscern" className="w-8 h-6 object-contain" />
            <span className="font-black text-lg gradient-text">Aiscern</span>
          </Link>
          <Link href="/" className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary">
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </Link>
        </div>
      </nav>

      <main className="pt-24 pb-20 max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-5xl font-black mb-4">Get in <span className="gradient-text">Touch</span></h1>
          <p className="text-text-muted text-base sm:text-lg max-w-xl mx-auto">
            We respond to all inquiries within 24–48 hours. For business and enterprise queries, contact our Project Manager directly.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Contact info */}
          <div className="lg:col-span-2 space-y-4">
            {[
              { icon: Mail, label: 'General', val: 'contact@aiscern.com', href: 'mailto:contact@aiscern.com' },
              { icon: Shield, label: 'Security', val: 'security@aiscern.com', href: 'mailto:security@aiscern.com' },
              { icon: MessageSquare, label: 'Enterprise', val: 'enterprise@aiscern.com', href: 'mailto:enterprise@aiscern.com' },
            ].map(item => (
              <a key={item.label} href={item.href}
                className="flex items-center gap-3 p-4 rounded-xl border border-border/55 bg-surface hover:border-primary/30 transition-all">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-text-muted">{item.label}</p>
                  <p className="text-sm font-semibold text-text-primary truncate">{item.val}</p>
                </div>
              </a>
            ))}

            <div className="p-4 rounded-xl border border-border/55 bg-surface">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-text-primary">Response Time</span>
              </div>
              <p className="text-sm text-text-muted">We respond to all inquiries within <strong className="text-text-secondary">24–48 hours</strong>. Enterprise inquiries get priority.</p>
            </div>

            {/* Project Manager contact */}
            <div className="p-4 rounded-xl border border-emerald/20 bg-emerald/5">
              <p className="text-xs text-emerald/70 uppercase tracking-wider mb-3 font-semibold">Business & Enterprise</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                  T
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text-primary">Temah</p>
                  <p className="text-xs text-text-muted">Project Manager · Aiscern</p>
                </div>
              </div>
              <p className="text-xs text-text-muted mt-3 leading-relaxed">
                For enterprise partnerships, volume agreements, and business inquiries — reach out via <a href="mailto:enterprise@aiscern.com" className="text-primary hover:underline font-medium">enterprise@aiscern.com</a> and Temah will respond within 24 hours.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/55 bg-surface">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-3 font-semibold">Follow Us</p>
              <div className="flex gap-3">
                {[
                  { Icon: Twitter,  href: 'https://twitter.com/aiscern',                label: 'Twitter/X' },
                  { Icon: Linkedin, href: 'https://linkedin.com/company/aiscern',       label: 'LinkedIn' },
                  { Icon: Github,   href: 'https://github.com/saghirahmed9067-png/DETECT-AI', label: 'GitHub' },
                ].map(({ Icon, href, label }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg border border-border/55 bg-surface-active hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center"
                    title={label}>
                    <Icon className="w-4 h-4 text-text-muted" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Contact form */}
          <div className="lg:col-span-3">
            {sent ? (
              <div className="rounded-2xl border border-emerald/20 bg-emerald/5 p-8 text-center">
                <CheckCircle className="w-12 h-12 text-emerald mx-auto mb-4" />
                <h2 className="text-xl font-bold text-text-primary mb-2">Message sent!</h2>
                <p className="text-text-muted text-sm">We'll get back to you within 24–48 hours.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/55 bg-surface p-5 sm:p-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">Name *</label>
                    <input value={form.name} onChange={e => set('name', e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-background border border-border/55 rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/60 transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">Email *</label>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      placeholder="your@email.com"
                      className="w-full bg-background border border-border/55 rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/60 transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">Subject</label>
                  <select value={form.subject} onChange={e => set('subject', e.target.value)}
                    className="w-full bg-background border border-border/55 rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-primary/60 transition-colors">
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">Message *</label>
                  <textarea value={form.message} onChange={e => set('message', e.target.value)}
                    placeholder="Tell us how we can help…" rows={5}
                    className="w-full bg-background border border-border/55 rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled resize-none focus:outline-none focus:border-primary/60 transition-colors" />
                </div>

                {error && <p className="text-rose text-sm px-1">{error}</p>}

                <button onClick={submit}
                  disabled={sending || !form.name || !form.email || !form.message}
                  className="w-full btn-primary py-3.5 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                  {sending ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                  ) : (
                    <><Send className="w-4 h-4" />Send Message</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
