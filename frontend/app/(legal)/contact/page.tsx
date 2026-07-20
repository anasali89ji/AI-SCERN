'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Shield, ArrowLeft, Mail, MessageSquare, Clock,
  Send, CheckCircle, Twitter, Linkedin, Github, Headphones
} from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'

const SUBJECTS = [
  'General Inquiry',
  'Technical Support',
  'Bug Report',
  'Enterprise Inquiry',
  'Partnership',
  'Press / Media',
  'Security Issue',
  'API Access',
  'Other',
]

// Map subject → which inbox receives the email
const SUBJECT_ROUTING: Record<string, string> = {
  'Security Issue':    'security',
  'Enterprise Inquiry':'enterprise',
  'Partnership':       'enterprise',
  'Technical Support': 'support',
  'Bug Report':        'support',
}

const CONTACT_CARDS = [
  {
    icon: Mail,
    label: 'General',
    description: 'General inquiries & feedback',
    val: 'contact@aiscern.com',
    href: 'mailto:contact@aiscern.com',
    color: '#2563eb',
  },
  {
    icon: Headphones,
    label: 'Support',
    description: 'Technical help & bug reports',
    val: 'support@aiscern.com',
    href: 'mailto:support@aiscern.com',
    color: '#0891b2',
  },
  {
    icon: Shield,
    label: 'Security',
    description: 'Vulnerability disclosures',
    val: 'security@aiscern.com',
    href: 'mailto:security@aiscern.com',
    color: '#16a34a',
  },
]

export default function ContactPage() {
  const [form, setForm]     = useState({ name: '', email: '', subject: SUBJECTS[0], message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const submit = async () => {
    if (!form.name || !form.email || !form.message) return
    setSending(true); setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          routing: SUBJECT_ROUTING[form.subject] ?? 'general',
        }),
      })
      if (!res.ok) throw new Error('Failed to send')
      setSent(true)
    } catch {
      setError('Failed to send. Please email us at contact@aiscern.com')
    }
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-[#08080d] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-[#1E1E1E] bg-[#08080d]">
        <div className="max-w-5xl mx-auto h-full px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Aiscern" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-black text-lg text-[#2BEE34]">Aiscern</span>
          </Link>
          <Link href="/" className="flex items-center gap-1 text-sm text-[#6B6B6B] hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </Link>
        </div>
      </nav>

      <main className="pt-24 pb-20 max-w-5xl 2xl:max-w-[1300px] mx-auto px-4 sm:px-6 2xl:px-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-5xl font-black mb-4">
            Get in <span className="text-[#2BEE34]">Touch</span>
          </h1>
          <p className="text-[#6B6B6B] text-base sm:text-lg max-w-xl mx-auto">
            We respond to all inquiries within 24–48 hours. Choose the right channel below for the fastest response.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left column — contact info */}
          <div className="lg:col-span-2 space-y-4">

            {/* 3 main email cards */}
            {CONTACT_CARDS.map(item => (
              <a key={item.label} href={item.href}
                className="flex items-center gap-3 p-4 rounded-xl border border-[#1E1E1E] bg-[#141414] hover:border-white/[0.12] transition-all group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ background: item.color + '18' }}>
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-[#6B6B6B] font-semibold uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm font-bold text-white truncate group-hover:text-white transition-colors">{item.val}</p>
                  <p className="text-[11px] text-[#6B6B6B]">{item.description}</p>
                </div>
              </a>
            ))}

            {/* Response time */}
            <div className="p-4 rounded-xl border border-[#1E1E1E] bg-[#141414]">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-[#2BEE34]" />
                <span className="text-sm font-semibold text-white">Response Time</span>
              </div>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                We respond to all inquiries within{' '}
                <strong className="text-[#A3A3A3]">24–48 hours</strong>.
                Security issues are handled within <strong className="text-[#A3A3A3]">24 hours</strong>.
              </p>
            </div>

            {/* Temah / PM card */}
            <div className="p-4 rounded-xl border border-[#2BEE34]/20 bg-[#2BEE34]/5">
              <p className="text-[11px] text-[#2BEE34]/70 uppercase tracking-wider mb-3 font-bold">
                Business &amp; Enterprise
              </p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#2BEE34]
                  flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                  T
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">Temah</p>
                  <p className="text-xs text-[#6B6B6B]">Project Manager · Aiscern</p>
                </div>
              </div>
              <p className="text-xs text-[#6B6B6B] leading-relaxed mb-3">
                For enterprise partnerships, volume agreements, white-label, and business inquiries — reach out to our PM directly.
              </p>
              <a href="mailto:temah@aiscern.com"
                className="flex items-center gap-2 text-sm font-semibold text-[#2BEE34] hover:underline">
                <MessageSquare className="w-3.5 h-3.5" />
                temah@aiscern.com
              </a>
            </div>

            {/* Social */}
            <div className="p-4 rounded-xl border border-[#1E1E1E] bg-[#141414]">
              <p className="text-xs text-[#6B6B6B] uppercase tracking-wider mb-3 font-semibold">Follow Us</p>
              <div className="flex gap-3">
                {[
                  { Icon: Twitter,  href: 'https://twitter.com/aiscern',                    label: 'Twitter/X' },
                  { Icon: Linkedin, href: 'https://linkedin.com/company/aiscern',            label: 'LinkedIn' },
                  { Icon: Github,   href: 'https://github.com/saghirahmed9067-png/DETECT-AI', label: 'GitHub' },
                ].map(({ Icon, href, label }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    title={label}
                    className="w-9 h-9 rounded-lg border border-[#1E1E1E] bg-[#141420]
                      hover:border-blue-500/40 hover:bg-[#2BEE34]/5 transition-all flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#6B6B6B]" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — form */}
          <div className="lg:col-span-3">
            {sent ? (
              <div className="rounded-xl border border-[#2BEE34]/20 bg-[#2BEE34]/5 p-10 text-center">
                <CheckCircle className="w-12 h-12 text-[#2BEE34] mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Message sent!</h2>
                <p className="text-[#6B6B6B] text-sm mb-4">We'll get back to you within 24–48 hours.</p>
                <button onClick={() => { setSent(false); setForm({ name:'', email:'', subject: SUBJECTS[0], message:'' }) }}
                  className="text-sm text-[#2BEE34] hover:underline">
                  Send another message
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-6 space-y-4">
                <h2 className="text-base font-bold text-white mb-1">Send us a message</h2>
                <p className="text-xs text-[#6B6B6B] mb-4">
                  Your message is routed to the right team automatically based on subject.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] mb-2 block">Name *</label>
                    <input value={form.name} onChange={e => set('name', e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-[#08080d] border border-[#1E1E1E] rounded-xl px-4 py-3 text-sm
                        text-white placeholder:text-[#6B6B6B] focus:outline-none
                        focus:border-[#2BEE34]/30 transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] mb-2 block">Email *</label>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      placeholder="your@email.com"
                      className="w-full bg-[#08080d] border border-[#1E1E1E] rounded-xl px-4 py-3 text-sm
                        text-white placeholder:text-[#6B6B6B] focus:outline-none
                        focus:border-[#2BEE34]/30 transition-colors" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] mb-2 block">Subject</label>
                  <select value={form.subject} onChange={e => set('subject', e.target.value)}
                    className="w-full bg-[#08080d] border border-[#1E1E1E] rounded-xl px-4 py-3 text-sm
                      text-white focus:outline-none focus:border-[#2BEE34]/30 transition-colors">
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                  {/* Show routing hint */}
                  {SUBJECT_ROUTING[form.subject] && (
                    <p className="text-[11px] text-[#6B6B6B] mt-1.5 pl-1">
                      → Will be sent to{' '}
                      <span className="text-[#2BEE34] font-medium">
                        {SUBJECT_ROUTING[form.subject] === 'security'   ? 'security@aiscern.com' :
                         SUBJECT_ROUTING[form.subject] === 'enterprise'  ? 'temah@aiscern.com'  :
                         SUBJECT_ROUTING[form.subject] === 'support'     ? 'support@aiscern.com' :
                         'contact@aiscern.com'}
                      </span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] mb-2 block">Message *</label>
                  <textarea value={form.message} onChange={e => set('message', e.target.value)}
                    placeholder="Tell us how we can help…" rows={5}
                    className="w-full bg-[#08080d] border border-[#1E1E1E] rounded-xl px-4 py-3 text-sm
                      text-white placeholder:text-[#6B6B6B] resize-none focus:outline-none
                      focus:border-[#2BEE34]/30 transition-colors" />
                </div>

                {error && <p className="text-[#FF4444] text-sm px-1">{error}</p>}

                <button onClick={submit}
                  disabled={sending || !form.name || !form.email || !form.message}
                  className="w-full btn-primary py-3.5 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                  {sending ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                  ) : (
                    <><Send className="w-4 h-4" />Send Message</>
                  )}
                </button>

                {/* Email footer */}
                <div className="pt-2 border-t border-white/[0.06]">
                  <p className="text-[11px] text-[#6B6B6B] text-center leading-relaxed">
                    Or email us directly:&nbsp;
                    <a href="mailto:contact@aiscern.com" className="text-[#2BEE34] hover:underline">contact@aiscern.com</a>
                    &nbsp;·&nbsp;
                    <a href="mailto:support@aiscern.com" className="text-[#2BEE34] hover:underline">support@aiscern.com</a>
                    &nbsp;·&nbsp;
                    <a href="mailto:security@aiscern.com" className="text-[#2BEE34] hover:underline">security@aiscern.com</a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
