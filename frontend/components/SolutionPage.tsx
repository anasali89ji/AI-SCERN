'use client'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UseCaseItem {
  title: string
  desc: string
}

export interface PainPoint {
  problem: string
  solution: string
}

export interface SolutionPageProps {
  /** Industry name e.g. "Education" */
  industry: string
  /** Short tagline under the headline */
  tagline: string
  /** Longer description for the hero */
  description: string
  /** Lucide icon component for fallback */
  icon: LucideIcon
  /** Primary accent color (CSS hex or rgba) */
  color: string
  /** Optional hero image path — /solutions/hero-education.jpg */
  heroImage?: string
  /** Optional product-in-action image — /solutions/action-education.jpg */
  actionImage?: string
  /** Pain point cards */
  painPoints: PainPoint[]
  /** Use case list */
  useCases: UseCaseItem[]
  /** Relevant detect tool link */
  ctaHref: string
  /** CTA button label */
  ctaLabel: string
  /** Detect tool label for the CTA */
  toolName: string
  /** Key stats to display */
  stats: Array<{ value: string; label: string }>
}

// ─── Component ───────────────────────────────────────────────────────────────
export function SolutionPage({
  industry,
  tagline,
  description,
  icon: Icon,
  color,
  heroImage,
  actionImage,
  painPoints,
  useCases,
  ctaHref,
  ctaLabel,
  toolName,
  stats,
}: SolutionPageProps) {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <SiteNav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-[600px] h-[500px] rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`, filter: 'blur(80px)' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">

            {/* Left: Copy */}
            <div className="flex-1 max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-6"
                style={{ borderColor: `${color}40`, backgroundColor: `${color}15`, color }}
              >
                <Icon className="w-3.5 h-3.5" />
                Aiscern for {industry}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl sm:text-5xl font-bold font-display leading-tight tracking-tight mb-4 text-white"
              >
                {tagline}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-text-secondary leading-relaxed mb-8"
              >
                {description}
              </motion.p>

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-wrap gap-6 mb-8"
              >
                {stats.map(s => (
                  <div key={s.label}>
                    <div className="text-2xl font-bold font-display" style={{ color }}>{s.value}</div>
                    <div className="text-xs text-text-muted">{s.label}</div>
                  </div>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <Link href={ctaHref} className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold">
                  {ctaLabel}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/pricing" className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3 font-medium">
                  View Pricing
                </Link>
              </motion.div>
            </div>

            {/* Right: Hero image or icon fallback */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="flex-shrink-0 w-full lg:w-[420px] xl:w-[480px]"
            >
              {heroImage ? (
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl opacity-30 blur-2xl"
                    style={{ background: `radial-gradient(circle, ${color}60 0%, transparent 70%)` }} />
                  <Image
                    src={heroImage}
                    alt={`AI detection for ${industry}`}
                    width={480}
                    height={360}
                    className="relative rounded-2xl border border-border/50 shadow-2xl w-full h-auto"
                    loading="eager"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              ) : (
                /* Fallback: styled icon in glass card */
                <div className="relative rounded-2xl border border-border/50 bg-surface p-12 flex items-center justify-center"
                  style={{ boxShadow: `0 0 60px ${color}20` }}>
                  <div className="w-32 h-32 rounded-3xl flex items-center justify-center"
                    style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                    <Icon className="w-16 h-16" style={{ color }} />
                  </div>
                  <div className="absolute inset-0 rounded-2xl opacity-5"
                    style={{ background: `radial-gradient(ellipse at 50% 50%, ${color} 0%, transparent 70%)` }} />
                  <div className="absolute top-4 right-4 text-xs text-text-disabled border border-border/40 px-2 py-1 rounded-lg bg-surface">
                    Image coming soon
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Pain Points ──────────────────────────────────────────────────── */}
      <section className="py-20 border-t border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-semibold font-display text-white mb-3">The Problem</h2>
            <p className="text-text-muted max-w-xl mx-auto">Real challenges {industry.toLowerCase()} professionals face with AI-generated content</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4">
            {painPoints.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="card p-6 border border-border/60 bg-surface rounded-2xl"
              >
                <div className="flex gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-rose flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary">{p.problem}</p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color }} />
                  <p className="text-sm text-text-primary font-medium">{p.solution}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product in Action ─────────────────────────────────────────────── */}
      {actionImage && (
        <section className="py-20 border-t border-border/40 bg-surface/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-center mb-10"
            >
              <h2 className="text-3xl font-semibold font-display text-white mb-3">See It in Action</h2>
              <p className="text-text-muted">{toolName} working for {industry.toLowerCase()} use cases</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Image
                src={actionImage}
                alt={`${toolName} in use for ${industry}`}
                width={1100}
                height={660}
                className="w-full h-auto rounded-2xl border border-border/50 shadow-2xl"
                loading="lazy"
                onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
              />
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Use Cases ────────────────────────────────────────────────────── */}
      <section className="py-20 border-t border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-semibold font-display text-white mb-3">Use Cases</h2>
            <p className="text-text-muted max-w-xl mx-auto">How {industry.toLowerCase()} professionals use Aiscern day to day</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {useCases.map((u, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="card p-5 border border-border/60 bg-surface rounded-2xl hover:border-primary/30 transition-colors"
              >
                <ChevronRight className="w-4 h-4 mb-3" style={{ color }} />
                <h3 className="text-sm font-semibold text-white mb-1.5">{u.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{u.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-20 border-t border-border/40 bg-surface/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl font-semibold font-display text-white mb-4">
              Ready to protect your {industry.toLowerCase()} workflow?
            </h2>
            <p className="text-text-muted mb-8">Free tier available — no credit card required. 10 scans per day.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={ctaHref} className="btn-primary inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold">
                {ctaLabel}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/pricing" className="btn-secondary inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-medium">
                See all plans
              </Link>
            </div>
            <p className="mt-4 text-xs text-text-disabled">
              Detection results are probabilistic — use alongside human judgment for high-stakes decisions.
            </p>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
