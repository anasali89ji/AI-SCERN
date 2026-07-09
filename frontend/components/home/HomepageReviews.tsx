'use client'
import { useState, useEffect, useRef, memo } from 'react'
import { motion } from 'framer-motion'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'

interface Review {
  id?: string | number
  rating?: number; stars?: number
  body?: string;   text?: string
  is_anonymous?: boolean; display_name?: string; tool_used?: string
}

const FALLBACK: Review[] = [
  { id:'f1', rating:5, body:'Caught AI-generated submissions I would have missed entirely. The sentence-level heatmap is what sets it apart from other tools.', display_name:'Dr. Sarah M.',  tool_used:'Text Attestation'       },
  { id:'f2', rating:5, body:'The deepfake attestation tool saved our editorial team from publishing a manipulated image. Essential for any newsroom doing visual verification.', display_name:'James K.',       tool_used:'Image Attestation'           },
  { id:'f3', rating:5, body:'Fast and accurate. I run every audio clip through it before broadcasting. Has saved me from voice clone disinformation twice.',             display_name:'Priya L.',       tool_used:'Audio Attestation'           },
  { id:'f4', rating:5, body:'Screening resumes for AI-polished cover letters used to be guesswork. Now it takes seconds and the confidence score is genuinely useful.', display_name:'Marcus T.',      tool_used:'Text Attestation'         },
  { id:'f5', rating:4, body:'Solid batch analyser — ran 20 student essays overnight and had a clear report by morning. Wish the free tier had a higher daily cap.',    display_name:'Anonymous',      tool_used:'Batch Content Analyser', is_anonymous:true },
  { id:'f6', rating:5, body:'The video attestation tool flagged a manipulated clip our team almost shared. Frame-by-frame breakdown made the case immediately.',               display_name:'Elena R.',       tool_used:'Video Attestation'  },
]

const ReviewCard = memo(function ReviewCard({ r, i }: { r: Review; i: number }) {
  const stars = r.rating ?? r.stars ?? 5
  const text  = r.body ?? r.text ?? ''
  const name  = r.is_anonymous ? 'Anonymous' : (r.display_name ?? 'Aiscern User')
  const init  = r.is_anonymous ? '?' : name.charAt(0).toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="snap-start shrink-0 w-[300px] sm:w-[320px] flex flex-col bg-[#141414] border border-[#1E1E1E]
                 rounded-xl p-5 card-lift hover:border-[#2A2A2A] transition-all duration-200"
    >
      <div className="flex gap-0.5 mb-3" aria-label={`${stars} out of 5 stars`}>
        {Array.from({ length: stars }).map((_,j) => (
          <Star key={j} className="w-3.5 h-3.5 text-[#FFB800] fill-[#FFB800]" aria-hidden />
        ))}
        {Array.from({ length: 5 - stars }).map((_,j) => (
          <Star key={`e${j}`} className="w-3.5 h-3.5 text-[#3A3A3A]" aria-hidden />
        ))}
      </div>
      <p className="text-sm text-[#A3A3A3] leading-relaxed flex-1 mb-4">&ldquo;{text}&rdquo;</p>
      <div className="flex items-center gap-3 pt-4 border-t border-[#1E1E1E]">
        <div className="w-9 h-9 rounded-full bg-[#2BEE34]/10 border border-[#2BEE34]/20 flex items-center justify-center text-sm font-black text-[#2BEE34] flex-shrink-0" aria-hidden>
          {init}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#E5E5E5] truncate">{name}</p>
          {r.tool_used && <p className="text-[11px] text-[#6B6B6B] truncate">{r.tool_used}</p>}
        </div>
      </div>
    </motion.div>
  )
})

export default function HomepageReviews() {
  const [reviews, setReviews] = useState<Review[]>(FALLBACK)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  useEffect(() => {
    fetch('/api/reviews?limit=9&sort=helpful')
      .then(r => r.json())
      .then(d => { if (d.data?.length >= 3) setReviews(d.data.slice(0, 9)) })
      .catch(() => {})
  }, [])

  const updateEdges = () => {
    const el = scrollerRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 4)
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 4)
  }

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * 336, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-0 top-0 bottom-2 w-10 z-10 bg-gradient-to-r from-[#141414] to-transparent transition-opacity duration-300"
        style={{ opacity: atStart ? 0 : 1 }} />
      <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 z-10 bg-gradient-to-l from-[#141414] to-transparent transition-opacity duration-300"
        style={{ opacity: atEnd ? 0 : 1 }} />

      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2
                   [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((r, i) => <ReviewCard key={String(r.id)} r={r} i={i} />)}
      </div>

      {reviews.length > 3 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => scrollByCard(-1)}
            disabled={atStart}
            aria-label="Previous"
            className="w-9 h-9 rounded-full border border-[#2A2A2A] bg-[#1A1A1A] flex items-center justify-center
                       text-[#A3A3A3] hover:text-white hover:border-[#2BEE34]/40 transition-colors
                       disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollByCard(1)}
            disabled={atEnd}
            aria-label="Next"
            className="w-9 h-9 rounded-full border border-[#2A2A2A] bg-[#1A1A1A] flex items-center justify-center
                       text-[#A3A3A3] hover:text-white hover:border-[#2BEE34]/40 transition-colors
                       disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
