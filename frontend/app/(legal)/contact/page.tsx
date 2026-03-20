'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Shield, ArrowLeft, Mail, MessageSquare, Clock, Twitter, Linkedin, Send, CheckCircle } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'

const SUBJECTS = ['General Question', 'Bug Report', 'Enterprise Inquiry', 'Partnership', 'Press / Media', 'API Support']

export default function ContactPage() {
  const [form, setForm]     = useState({ name: '', email: '', subject: SUBJECTS[0], message: '' })
  const [status, setStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')

  const submit = async () => {
    if (!form.name || !form.email || !form.message) return
    setStatus('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setStatus(res.ok ? 'sent' : 'error')
    } catch { setStatus('error') }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black gradient-text">Aiscern</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10 sm:py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-text-primary mb-3">Get in <span className="gradient-text">Touch</span></h1>
          <p className="text-text-muted text-sm sm:text-base">Have a question, found a bug, or want to collaborate? We'd love to hear from you.</p>
          <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-text-muted">
            <Clock className="w-3.5 h-3.5" /> We respond to all inquiries within 24–48 hours
          </div>
        </div>

        {status === 'sent' ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-emerald/10 border border-emerald/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Message sent!</h2>
            <p className="text-text-muted text-sm">We'll get back to you within 24–48 hours.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Form */}
            <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5 block">Name *</label>
                  <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                    placeholder="Your name" maxLength={80}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5 block">Email *</label>
                  <input value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                    placeholder="your@email.com" type="email"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/50 transition-colors" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5 block">Subject</label>
                <select value={form.subject} onChange={e => setForm(p => ({...p, subject: e.target.value}))}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary/50 transition-colors">
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Message *</label>
                  <span className="text-xs text-text-disabled">{form.message.length}/2000</span>
                </div>
                <textarea value={form.message} onChange={e => setForm(p => ({...p, message: e.target.value.slice(0,2000)}))}
                  placeholder="Tell us what's on your mind…" rows={5} maxLength={2000}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled resize-none focus:outline-none focus:border-primary/50 transition-colors" />
              </div>

              {status === 'error' && (
                <p className="text-xs text-rose">Something went wrong. Please email us directly at <a href="mailto:contact@aiscern.com" className="underline">contact@aiscern.com</a></p>
              )}

              <button onClick={submit}
                disabled={status === 'sending' || !form.name || !form.email || !form.message}
                className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {status === 'sending'
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
                  : <><Send className="w-4 h-4" /> Send Message</>}
              </button>
            </div>

            {/* Alt contacts */}
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: Mail, label: 'General', value: 'contact@aiscern.com', href: 'mailto:contact@aiscern.com' },
                { icon: MessageSquare, label: 'Security', value: 'security@aiscern.com', href: 'mailto:security@aiscern.com' },
              ].map(item => (
                <a key={item.label} href={item.href}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/40 bg-surface transition-all group">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">{item.label}</p>
                    <p className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">{item.value}</p>
                  </div>
                </a>
              ))}
            </div>

            {/* Social */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <a href="https://twitter.com/aiscern" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors">
                <Twitter className="w-4 h-4" /> @aiscern
              </a>
              <a href="https://linkedin.com/company/aiscern" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors">
                <Linkedin className="w-4 h-4" /> Aiscern
              </a>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
