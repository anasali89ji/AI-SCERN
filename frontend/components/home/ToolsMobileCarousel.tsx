"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowRight, Music, Video, MessageSquare, Layers } from "lucide-react"

const SUPPORTING_TOOLS = [
  { href: '/detect/audio', icon: Music, label: 'AI Audio & Voice Clone Detector', desc: 'Synthetic speech, voice clones, and AI-generated audio', accuracy: '~91%', accent: '#06b6d4' },
  { href: '/detect/video', icon: Video, label: 'Deepfake Video Detector', desc: 'Face-swap, lip-sync, and synthetic video detection', accuracy: '~88%', accent: '#8b5cf6' },
  { href: '/chat', icon: MessageSquare, label: 'AI Detection Assistant', desc: 'Ask anything about AI detection — get expert answers in real time', accuracy: 'New', accent: '#2BEE34' },
  { href: '/batch', icon: Layers, label: 'Batch AI Content Analyser', desc: 'Process up to 20 files simultaneously across all media types', accuracy: '20×', accent: '#f43f5e' },
]

export function ToolsMobileCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    if (!card) return
    const gap = 16 // gap-4 = 16px
    const step = card.offsetWidth + gap
    const idx = Math.max(0, Math.min(SUPPORTING_TOOLS.length - 1, Math.round(el.scrollLeft / step)))
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

  const scrollerPadding = "max(1rem, calc(50% - 40vw))"

  return (
    <div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4"
        style={{ paddingLeft: scrollerPadding, paddingRight: scrollerPadding }}
      >
        {SUPPORTING_TOOLS.map((tool, i) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="snap-center shrink-0 w-[80vw] max-w-[340px] active:scale-[0.98] group relative rounded-xl border border-white/[0.06] bg-surface p-5
                         min-h-[180px] flex flex-col
                         hover:border-[color:var(--accent)]/40 focus-visible:border-[color:var(--accent)]/40
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                         transition-all duration-300"
              style={{ '--accent': tool.accent } as React.CSSProperties}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-elevated border transition-all duration-200 group-hover:scale-[1.08]"
                  style={{ borderColor: `${tool.accent}30` }}
                >
                  <Icon className="w-5 h-5" style={{ color: tool.accent }} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-elevated border"
                  style={{ borderColor: `${tool.accent}30`, color: tool.accent }}
                >
                  {tool.accuracy}
                </span>
              </div>
              <h3 className="text-base font-semibold text-silver-900 mb-2">{tool.label}</h3>
              <p className="text-sm text-silver-600 leading-relaxed line-clamp-2 flex-grow">{tool.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-silver-600 group-hover:gap-2 transition-all duration-200">
                <span className="group-hover:text-[color:var(--accent)] transition-colors duration-200">Try now</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" style={{ color: tool.accent }} aria-hidden="true" />
              </div>
            </Link>
          )
        })}
      </div>
      <div className="flex justify-center gap-2 mt-4" aria-label="Choose detection tool">
        {SUPPORTING_TOOLS.map((tool, i) => (
          <button
            key={tool.href}
            onClick={() => scrollToCard(i)}
            aria-label={tool.label}
            aria-current={i === activeIdx ? "true" : undefined}
            className="p-2 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <span className={`block w-2 h-2 rounded-full transition-colors duration-200 ${i === activeIdx ? "bg-accent" : "bg-silver-600/40"}`} />
          </button>
        ))}
      </div>
    </div>
  )
}
