'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react'

interface Professional {
  label: string
  icon: LucideIcon
  blurb: string
}

const BLURBS: Record<string, string> = {
  Journalists:      'Verify sources and flag AI-generated submissions before publishing.',
  Educators:        'Check student submissions for AI-written content in seconds.',
  'HR Teams':       'Screen resumes and cover letters for AI-polished exaggerations.',
  'Legal Pros':     'Authenticate evidence and correspondence for AI tampering.',
  'Security Teams': 'Detect deepfakes and synthetic media in incident response.',
  Researchers:      'Validate datasets and citations for AI-generated contamination.',
  'Content Creators': 'Prove authenticity of your work to platforms and audiences.',
  'Marketing Teams': 'Keep brand voice human — catch AI drafts before they ship.',
  Healthcare:       'Verify patient-submitted documents and records for integrity.',
}

export function WhoNeedsCarousel({ items }: { items: { label: string; icon: LucideIcon }[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const updateEdges = () => {
    const el = scrollerRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 4)
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 4)
  }

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * 260, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      {/* Edge fade masks */}
      <div className={`pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-r from-[#141414] to-transparent transition-opacity duration-300 ${atStart ? 'opacity-0' : 'opacity-100'}`} />
      <div className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-l from-[#141414] to-transparent transition-opacity duration-300 ${atEnd ? 'opacity-0' : 'opacity-100'}`} />

      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2
                   [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map(({ label, icon: Icon }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="snap-start shrink-0 w-[220px] card-lift
                       flex flex-col gap-3 p-4 rounded-xl border border-[#1E1E1E] bg-[#141414]
                       hover:border-[#2BEE34]/30"
          >
            <div className="w-9 h-9 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center">
              <Icon className="w-4 h-4 text-[#2BEE34]" strokeWidth={1.8} />
            </div>
            <h4 className="text-sm font-semibold text-white">{label}</h4>
            <p className="text-xs text-[#A3A3A3] leading-relaxed">{BLURBS[label] ?? 'Verify content authenticity in seconds.'}</p>
          </motion.div>
        ))}
      </div>

      {/* Nav arrows */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          onClick={() => scrollByCard(-1)}
          disabled={atStart}
          aria-label="Previous"
          className="w-8 h-8 rounded-full border border-[#2A2A2A] bg-[#1A1A1A] flex items-center justify-center
                     text-[#A3A3A3] hover:text-white hover:border-[#2BEE34]/40 transition-colors
                     disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => scrollByCard(1)}
          disabled={atEnd}
          aria-label="Next"
          className="w-8 h-8 rounded-full border border-[#2A2A2A] bg-[#1A1A1A] flex items-center justify-center
                     text-[#A3A3A3] hover:text-white hover:border-[#2BEE34]/40 transition-colors
                     disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
