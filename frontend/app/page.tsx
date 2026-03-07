'use client'
export const dynamic = 'force-dynamic'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Shield, Brain, Eye, Mic, FileText, Globe, Zap, BarChart3, ChevronRight, Check } from 'lucide-react'

const features = [
  { icon: Eye, title: 'Image Detection', desc: 'GAN artifacts, pixel forensics, metadata analysis', color: 'text-primary', bg: 'bg-primary/10' },
  { icon: Zap, title: 'Video Analysis', desc: 'Frame-by-frame deepfake and temporal analysis', color: 'text-secondary', bg: 'bg-secondary/10' },
  { icon: Mic, title: 'Audio Detection', desc: 'Voice synthesis, TTS artifacts, spectral analysis', color: 'text-cyan', bg: 'bg-cyan/10' },
  { icon: FileText, title: 'Text Analysis', desc: 'Perplexity scoring, style fingerprinting, burstiness', color: 'text-emerald', bg: 'bg-emerald/10' },
  { icon: Globe, title: 'Web Scraper', desc: 'Full-page intelligence, extract and analyze any URL', color: 'text-amber', bg: 'bg-amber/10' },
  { icon: BarChart3, title: 'Analytics', desc: 'Real-time dashboard, trends, model accuracy metrics', color: 'text-rose', bg: 'bg-rose/10' },
]

const steps = [
  { n: '01', title: 'Upload Content', desc: 'Drop any image, video, audio file or paste text/URL' },
  { n: '02', title: 'AI Analysis', desc: 'Fine-tuned models scan for 20+ detection signals' },
  { n: '03', title: 'Get Verdict', desc: 'Confidence score, signal breakdown, full report' },
  { n: '04', title: 'Export & Share', desc: 'Download PDF report or share results instantly' },
]

const stats = [
  { value: '99K+', label: 'Scans Processed' },
  { value: '92%', label: 'Accuracy Rate' },
  { value: '4', label: 'Media Types' },
  { value: '0$', label: 'Monthly Cost' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* NAV */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">DETECTAI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-text-muted">
            <a href="#features" className="hover:text-text-primary transition-colors">Features</a>
            <a href="#how" className="hover:text-text-primary transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-text-primary transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm py-2">Sign In</Link>
            <Link href="/signup" className="btn-primary text-sm py-2">Get Started Free</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-40 pb-32 px-6">
        {/* Animated grid background */}
        <div className="absolute inset-0 bg-cyber-grid bg-grid opacity-40" />
        <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent" />

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-medium mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            AI Content Detection Platform
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-8xl font-black mb-6 leading-none tracking-tight"
          >
            <span className="gradient-text">Unmask</span>
            <br />
            <span className="text-text-primary">the Machine.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-text-muted max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Detect AI-generated images, videos, audio, and text with fine-tuned ML models.
            Zero cost. Real-time. Professional-grade accuracy.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/signup" className="btn-primary text-base px-8 py-3 flex items-center gap-2">
              Start Detecting Free <ChevronRight className="w-4 h-4" />
            </Link>
            <Link href="/dashboard" className="btn-ghost text-base px-8 py-3">
              View Demo Dashboard
            </Link>
          </motion.div>

          {/* Trust bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 flex items-center justify-center gap-8 text-sm text-text-muted"
          >
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold gradient-text">{s.value}</div>
                <div className="text-xs">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-text-primary mb-4">Everything You Need</h2>
            <p className="text-text-muted text-lg max-w-2xl mx-auto">
              Multi-modal detection across every content type with ML models trained specifically for AI detection
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card group cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">{f.title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 px-6 bg-surface/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-text-primary mb-4">How It Works</h2>
            <p className="text-text-muted text-lg">Four simple steps to unmask AI-generated content</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-black gradient-text">{s.n}</span>
                </div>
                <h3 className="font-semibold text-text-primary mb-2">{s.title}</h3>
                <p className="text-text-muted text-sm">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-text-primary mb-4">Simple Pricing</h2>
            <p className="text-text-muted text-lg">Start free, upgrade when you need more</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Free */}
            <div className="card">
              <h3 className="text-xl font-bold text-text-primary mb-1">Free</h3>
              <div className="text-4xl font-black text-text-primary mb-6">$0<span className="text-lg text-text-muted font-normal">/mo</span></div>
              <ul className="space-y-3 mb-8">
                {['50 scans/month', 'Image + Text detection', 'Basic reports', 'Email support'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-text-secondary text-sm">
                    <Check className="w-4 h-4 text-emerald flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn-ghost w-full text-center block py-3">Get Started</Link>
            </div>
            {/* Pro */}
            <div className="card cyber-border bg-gradient-to-br from-primary/5 to-secondary/5">
              <div className="inline-flex items-center gap-1 bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded-full mb-3">⭐ Most Popular</div>
              <h3 className="text-xl font-bold text-text-primary mb-1">Pro</h3>
              <div className="text-4xl font-black gradient-text mb-6">$19<span className="text-lg text-text-muted font-normal">/mo</span></div>
              <ul className="space-y-3 mb-8">
                {['Unlimited scans', 'All media types', 'Web scraper', 'Batch processing', 'PDF exports', 'Priority support'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-text-secondary text-sm">
                    <Check className="w-4 h-4 text-emerald flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn-primary w-full text-center block py-3">Start Pro Trial</Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="card cyber-border bg-gradient-to-br from-primary/10 to-secondary/10"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6 animate-float">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl font-bold text-text-primary mb-4">Ready to Unmask AI?</h2>
            <p className="text-text-muted mb-8 text-lg">Join thousands of researchers and journalists using DETECTAI</p>
            <Link href="/signup" className="btn-primary text-lg px-10 py-4 inline-flex items-center gap-2">
              Start Free Today <ChevronRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold gradient-text">DETECTAI</span>
          </div>
          <p className="text-text-muted text-sm">© 2026 DETECTAI. Built for truth.</p>
        </div>
      </footer>
    </div>
  )
}
