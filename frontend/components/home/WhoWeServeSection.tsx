"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import Link from "next/link"

// Motion-enabled Link: framer-motion props (initial/whileInView) on a Next Link
const MotionLink = motion.create(Link)
import Image from "next/image"
import {
  PenTool, Newspaper, GraduationCap, Users, Scale, ShieldCheck,
  Microscope, Megaphone, HeartPulse
} from "lucide-react"

/* ── Data ─────────────────────────────────────────────────────────────── */

const WHO_NEEDS = [
  {
    role: "Content Creators",
    icon: PenTool,
    accent: "#2BEE34",
    stat: "94%",
    statLabel: "text accuracy",
    desc: "Verify authenticity before publishing. Protect your reputation and audience trust with forensic-grade detection.",
    large: true,
    image: null as string | null,
    placeholderLabel: "Creator workflow",
    href: "/detect/text",
  },
  {
    role: "Content Creators",
    icon: PenTool,
    accent: "#2BEE34",
    stat: "94%",
    statLabel: "text accuracy",
    desc: "Verify authenticity before publishing. Protect your reputation and audience trust with forensic-grade detection.",
    large: true,
    image: null as string | null,
    placeholderLabel: "Creator workflow",
  },
  {
    role: "Journalists",
    icon: Newspaper,
    accent: "#2563eb",
    stat: "98%",
    statLabel: "image detection",
    desc: "Source verification and image authenticity for newsroom standards.",
    large: false,
    image: null,
    placeholderLabel: "Newsroom workflow",
    href: "/detect/image",
  },
  {
    role: "Educators",
    icon: GraduationCap,
    accent: "#f59e0b",
    stat: "94%",
    statLabel: "text detection",
    desc: "Maintain academic integrity with AI-generated content detection.",
    large: false,
    image: null,
    placeholderLabel: "Classroom workflow",
    href: "/detect/text",
  },
  {
    role: "HR Teams",
    icon: Users,
    accent: "#06b6d4",
    stat: "20×",
    statLabel: "faster screening",
    desc: "Screen candidate submissions for AI-generated resumes and portfolios.",
    large: false,
    image: null,
    placeholderLabel: "HR screening workflow",
    href: "/detect/document",
  },
  {
    role: "Legal Professionals",
    icon: Scale,
    accent: "#8b5cf6",
    stat: "<3s",
    statLabel: "per document",
    desc: "Forensic evidence for digital document authenticity in legal proceedings.",
    large: false,
    image: null,
    placeholderLabel: "Legal review workflow",
    href: "/detect/document",
  },
  {
    role: "Security Teams",
    icon: ShieldCheck,
    accent: "#f43f5e",
    stat: "88%",
    statLabel: "video detection",
    desc: "Detect synthetic media in security footage and communications.",
    large: false,
    image: null,
    placeholderLabel: "Security ops workflow",
    href: "/detect/video",
  },
  {
    role: "Researchers",
    icon: Microscope,
    accent: "#10b981",
    stat: "20+",
    statLabel: "forensic signals",
    desc: "Deep-dive into content provenance with signal-level transparency.",
    large: false,
    image: null,
    placeholderLabel: "Research workflow",
    href: "/detect/image",
  },
  {
    role: "Marketing Teams",
    icon: Megaphone,
    accent: "#f97316",
    stat: "Batch",
    statLabel: "20× throughput",
    desc: "Verify campaign assets and influencer content at scale.",
    large: false,
    image: null,
    placeholderLabel: "Marketing workflow",
    href: "/batch",
  },
  {
    role: "Healthcare",
    icon: HeartPulse,
    accent: "#0ea5e9",
    stat: "HIPAA",
    statLabel: "compliant",
    desc: "Ensure medical imaging and documentation integrity.",
    large: false,
    image: null,
    placeholderLabel: "Healthcare workflow",
    href: "/detect/document",
  },
]

/* ── Card sub-component ───────────────────────────────────────────────── */

function PersonaCard({
  persona,
  index,
}: {
  persona: (typeof WHO_NEEDS)[0]
  index: number
}) {
  const reduced = useReducedMotion()
  const Icon = persona.icon
  const isLarge = persona.large

  return (
    <MotionLink
      href={persona.href || "/detect/text"}
      className={`group relative rounded-xl border border-white/[0.06] bg-surface block
        transition-all duration-300 ease-out
        hover:-translate-y-0.5 hover:shadow-lift
        focus-visible:-translate-y-0.5 focus-visible:shadow-lift
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
        ${isLarge ? "sm:col-span-2 sm:row-span-2" : ""}
      `}
      style={{ "--accent": persona.accent } as React.CSSProperties}
      initial={reduced ? {} : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Radial wash on hover */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-[0.08] group-focus-within:opacity-[0.08] transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(200px 200px at 20% 20%, var(--accent), transparent 70%)`,
        }}
      />

      <div className={`relative p-5 sm:p-6 flex flex-col h-full ${isLarge ? "lg:p-8" : ""}`}>
        {/* Image placeholder slot */}
        <div
          className={`
            w-full rounded-lg overflow-hidden mb-4 border border-white/[0.06]
            ${isLarge ? "aspect-[16/11]" : "aspect-[16/10]"}
          `}
        >
          {persona.image ? (
            <Image
              src={persona.image}
              alt={`${persona.role} workflow`}
              fill
              sizes="(max-width:640px) 80vw, (max-width:1024px) 50vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-surface-elevated via-surface to-surface-deep flex flex-col items-center justify-center gap-2">
              <Icon
                className="transition-all duration-200 group-hover:scale-110 group-focus-within:scale-110"
                style={{ color: persona.accent, opacity: 0.3, width: 32, height: 32 }}
              />
              <span className="text-[10px] uppercase tracking-[0.12em] text-silver-600">
                {persona.placeholderLabel}
              </span>
            </div>
          )}
        </div>

        {/* Icon + title row */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-elevated border transition-colors duration-200"
            style={{ borderColor: `${persona.accent}20` }}
          >
            <Icon
              className="w-[18px] h-[18px] transition-colors duration-200 group-hover:text-[color:var(--accent)] group-focus-within:text-[color:var(--accent)]"
              style={{ color: "#A3A3A3" }}
            />
          </div>
          <h3 className="text-base font-semibold text-silver-900">{persona.role}</h3>
        </div>

        {/* Description */}
        <p className="text-sm text-silver-600 leading-relaxed flex-grow">{persona.desc}</p>

        {/* Stat footer */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-baseline gap-1.5">
          <span
            className="text-lg font-bold tabular-nums transition-colors duration-200 group-hover:text-[color:var(--accent)] group-focus-within:text-[color:var(--accent)]"
            style={{ color: "#FFFFFF" }}
          >
            {persona.stat}
          </span>
          <span className="text-xs text-silver-600">{persona.statLabel}</span>
        </div>
      </div>
    </MotionLink>
  )
}

/* ── Mobile carousel ──────────────────────────────────────────────────── */

function MobileCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    if (!card) return
    const gap = 14 // gap-3.5 = 14px
    const step = card.offsetWidth + gap
    const idx = Math.max(0, Math.min(WHO_NEEDS.length - 1, Math.round(el.scrollLeft / step)))
    setActiveIdx(idx)
  }, [])

  const scrollToCard = (idx: number) => {
    const el = scrollRef.current
    if (!el) return
    const card = el.children[idx] as HTMLElement | null
    if (!card) return
    card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  // Symmetric padding: half of remaining viewport after card width
  // card = 80vw max 340px. At 375px: card=300px, remaining=75px, padding=37.5px
  const scrollerPadding = "max(1rem, calc(50% - 40vw))"

  return (
    <div>
      <div
        ref={scrollRef}
        className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4"
        style={{ paddingLeft: scrollerPadding, paddingRight: scrollerPadding }}
      >
        {WHO_NEEDS.map((persona, i) => (
          <div
            key={persona.role}
            className="snap-center shrink-0 w-[80vw] max-w-[340px] active:scale-[0.98] transition-transform duration-150"
          >
            <PersonaCard persona={persona} index={i} />
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-4" aria-label="Choose your role">
        {WHO_NEEDS.map((persona, i) => (
          <button
            key={persona.role}
            onClick={() => scrollToCard(i)}
            aria-label={persona.role}
            aria-current={i === activeIdx ? "true" : undefined}
            className="p-2 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <span
              className={`block w-2 h-2 rounded-full transition-colors duration-200 ${
                i === activeIdx ? "bg-accent" : "bg-silver-600/40"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Section ──────────────────────────────────────────────────────────── */

export function WhoWeServeSection() {
  const reduced = useReducedMotion()

  return (
    <section id="who-we-serve" className="section">
      <div className="container-page">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <motion.span
            className="inline-block text-xs font-semibold uppercase tracking-[0.08em] text-accent mb-3"
            initial={reduced ? {} : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            Trusted across industries
          </motion.span>
          <motion.h2
            className="font-heading font-bold text-headline text-silver-900 tracking-tight"
            initial={reduced ? {} : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            Who Uses Aiscern
          </motion.h2>
          <motion.p
            className="mt-3 text-lead text-silver-600 max-w-xl mx-auto"
            initial={reduced ? {} : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            From solo creators to enterprise security teams — Aiscern adapts to your workflow.
          </motion.p>
        </div>

        {/* Desktop bento grid */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {WHO_NEEDS.map((persona, i) => (
            <PersonaCard key={persona.role} persona={persona} index={i} />
          ))}
        </div>

        {/* Mobile carousel */}
        <div className="sm:hidden">
          <MobileCarousel />
        </div>
      </div>
    </section>
  )
}
