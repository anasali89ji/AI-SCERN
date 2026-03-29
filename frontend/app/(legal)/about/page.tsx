'use client'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield, ArrowLeft, Brain, Cpu, Zap, Users, Globe, Lock, CheckCircle, Target, Award, Mail, Linkedin } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'

const STATS = [
  { label: 'Training Samples',    value: '413K+', icon: Award,  color: 'text-primary bg-primary/10' },
  { label: 'Media Modalities',    value: '4',     icon: Cpu,    color: 'text-cyan bg-cyan/10' },
  { label: 'Source Datasets',     value: '87',    icon: Zap,    color: 'text-amber bg-amber/10' },
  { label: 'Detection Models',    value: '6',     icon: Users,  color: 'text-emerald bg-emerald/10' },
]

const VALUES = [
  { icon: Target, title: 'Accuracy First',   desc: 'We prioritize detection precision above all. Every model update is benchmarked against independent test sets to ensure reliable, bias-free results.' },
  { icon: Lock,   title: 'Privacy by Design', desc: 'Your data is never stored beyond what is needed for analysis. Scans are ephemeral, results belong to you, and we never sell your data.' },
  { icon: Globe,  title: 'Universal Access',  desc: 'AI-generated media disinformation is a global problem. Aiscern is built to be accessible to journalists, researchers, and everyday users worldwide.' },
  { icon: Brain,  title: 'AI-Powered',        desc: 'Our detection system combines advanced vision models, linguistic analysis, and proprietary signal extractors across all content types.' },
]

const TIMELINE = [
  { year: '2023', event: 'Research phase — studying detection gaps in commercial tools' },
  { year: 'Early 2024', event: 'First prototype: text-only detection using RoBERTa-based classification' },
  { year: 'Mid-Late 2024', event: 'Multi-modal expansion — added image, audio, and video detection with multi-model ensemble approach' },
  { year: 'December 2025', event: 'Aiscern founded — automated data pipeline deployed with 15 Cloudflare Workers collecting and labeling samples across 87 datasets' },
  { year: 'March 2026', event: 'Official public launch at aiscern.com — 413,000+ labeled samples · Text, image, audio & video detection · Free for everyone' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Aiscern" className="w-8 h-auto object-contain" />
            <span className="font-black gradient-text">Aiscern</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="py-24 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
                <Shield className="w-4 h-4" /> About Aiscern
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6">
                Defending Truth in the<br /><span className="gradient-text">Age of Synthetic Media</span>
              </h1>
              <p className="text-text-muted text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto">
                Aiscern is an enterprise-grade, multi-modal AI content detection platform.
                We help organizations, journalists, and individuals verify the authenticity
                of media before it spreads.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 px-4 bg-surface/20 border-y border-border">
          <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STATS.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="card text-center py-6">
                <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mx-auto mb-3`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black gradient-text mb-1">{s.value}</div>
                <div className="text-xs text-text-muted">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Team */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-black mb-3">Meet the <span className="gradient-text">Team</span></h2>
              <p className="text-text-muted text-base max-w-xl mx-auto">The people building the future of AI content verification.</p>
            </motion.div>

            <div className="grid grid-cols-1 gap-6 max-w-2xl mx-auto">
              {/* Founder Card */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="card border-primary/20 overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 sm:p-8">
                  <div className="relative flex-shrink-0">
                    <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden ring-4 ring-primary/20 shadow-xl shadow-primary/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/anas-ali.jpg"
                        alt="Anas Ali — Founder & CEO of Aiscern"
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <div className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">Founder & CEO</div>
                    <h2 className="text-xl sm:text-2xl font-black text-text-primary mb-0.5">Anas Ali</h2>
                    <p className="text-text-muted text-xs mb-3">Mandi Bahauddin, Pakistan · AI Engineer & Full-Stack Developer</p>
                    <p className="text-text-muted text-sm leading-relaxed mb-4">
                      Self-taught developer and founder of Aiscern. Architected the entire detection system —
                      from the 413K-sample training pipeline to the multi-modal inference engine — with a single goal:
                      make enterprise-grade AI detection accessible to everyone.
                    </p>
                    <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start mb-4">
                      {['Python', 'TypeScript', 'Next.js', 'Computer Vision', 'ML Systems', 'PyTorch'].map(s => (
                        <span key={s} className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">{s}</span>
                      ))}
                    </div>
                    <a href="mailto:anas@aiscern.com"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border hover:border-primary/50 text-sm font-medium transition-all">
                      <Mail className="w-4 h-4" /> Contact
                    </a>
                  </div>
                </div>
              </motion.div>

              {/* Project Manager Card */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="card border-cyan/20 overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 sm:p-8">
                  <div className="relative flex-shrink-0">
                    <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden ring-4 ring-cyan/20 shadow-xl shadow-cyan/10 bg-gradient-to-br from-cyan/20 to-primary/20 flex items-center justify-center">
                      <div className="text-4xl font-black text-cyan/60 select-none">TN</div>
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-xl bg-gradient-to-br from-cyan to-secondary flex items-center justify-center shadow-lg">
                      <Users className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <div className="text-xs text-cyan font-semibold uppercase tracking-wider mb-1">Project Manager</div>
                    <h2 className="text-xl sm:text-2xl font-black text-text-primary mb-0.5">Temah Nyanchama</h2>
                    <p className="text-text-muted text-xs mb-3">Nairobi, Kenya · AI Workflow & Operations Lead</p>
                    <p className="text-text-muted text-sm leading-relaxed mb-4">
                      AI-focused Project Manager with hands-on experience managing and delivering projects from
                      concept to completion. Skilled in structuring AI-driven workflows, coordinating teams, and
                      reducing execution risk — ensuring every Aiscern milestone ships on time and aligned with user needs.
                    </p>
                    <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start mb-4">
                      {['AI Workflow Design', 'Project Execution', 'Team Coordination', 'Risk Management', 'Graphic Design'].map(s => (
                        <span key={s} className="px-2.5 py-1 rounded-full bg-cyan/10 border border-cyan/20 text-xs font-medium text-cyan">{s}</span>
                      ))}
                    </div>
                    <a href="mailto:temah@aiscern.com"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border hover:border-cyan/50 text-sm font-medium transition-all">
                      <Mail className="w-4 h-4" /> Contact
                    </a>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="py-16 px-4 bg-surface/20 border-y border-border">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl font-black mb-6">Our <span className="gradient-text">Mission</span></h2>
              <p className="text-text-muted text-base leading-relaxed mb-4">
                The internet is drowning in AI-generated content — synthetic news articles, deepfake videos,
                voice-cloned audio, and AI-generated photographs that are indistinguishable from real ones.
                The tools to create this content are becoming faster and cheaper every month.
              </p>
              <p className="text-text-muted text-base leading-relaxed">
                Aiscern was founded to fight back. We build the most accurate, fastest, and most accessible
                multi-modal AI detection platform on the market — and we make it free for individuals, students,
                and journalists who need it most.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-black text-center mb-10">What We <span className="gradient-text">Stand For</span></h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {VALUES.map((v, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="card hover:border-primary/20 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <v.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-text-primary mb-2">{v.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{v.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-16 px-4 bg-surface/20 border-y border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-black text-center mb-10">Our <span className="gradient-text">Journey</span></h2>
            <div className="space-y-0">
              {TIMELINE.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                  className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    {i < TIMELINE.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                  </div>
                  <div className={`pb-6 ${i === TIMELINE.length - 1 ? '' : ''}`}>
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">{t.year}</span>
                    <p className="text-sm text-text-muted mt-1">{t.event}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-black mb-4">Start <span className="gradient-text">Detecting</span></h2>
              <p className="text-text-muted mb-8 max-w-xl mx-auto">
                Trusted by journalists, researchers, and organizations worldwide.
                Verify media authenticity in seconds — free, no signup required.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/signup" className="btn-primary inline-flex items-center gap-2 px-7 py-3 text-base">
                  Get Started Free
                </Link>
                <Link href="/contact" className="inline-flex items-center gap-2 px-7 py-3 rounded-xl border border-border hover:border-primary/40 text-sm font-medium transition-all">
                  <Mail className="w-4 h-4" /> Contact Sales
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
