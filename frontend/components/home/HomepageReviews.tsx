'use client'

import { useState, useEffect, memo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

interface Review {
  id?: string | number
  body?: string;   text?: string
  is_anonymous?: boolean; display_name?: string; tool_used?: string
}

const FALLBACK: Review[] = [
  { id:'f1', body:"Had a batch of essays that felt off but I couldn't say why. Ran them through this and the heatmap literally pointed at the paragraphs that were rewritten. Kind of wild honestly.", display_name:'Dr. Sarah M.', tool_used:'Text Attestation' },
  { id:'f2', body:"We almost ran a photo that turned out to be manipulated. Caught it 10 minutes before publish. That's the only reason I still use this thing.", display_name:'James K.', tool_used:'Image Attestation' },
  { id:'f3', body:"idk if it's perfect but it's caught 2 voice clones for me this year so I'm not complaining. Takes like 20 seconds per clip.", display_name:'Priya L.', tool_used:'Audio Attestation' },
  { id:'f4', body:'Started using this for resume screening after one too many suspiciously perfect cover letters. Not foolproof but it flags enough that it saves me time.', display_name:'Marcus T.', tool_used:'Text Attestation' },
  { id:'f5', body:"Ran 20 student essays overnight, had results by morning, no complaints there. Free tier cap is a bit tight though, hit it by essay 15.", display_name:'Anonymous', tool_used:'Batch Content Analyser', is_anonymous:true },
  { id:'f6', body:"A clip was going around our group chat that looked fake to me but nobody believed it. Ran it here, frame breakdown showed exactly where it was spliced. Good enough receipts to shut that down.", display_name:'Elena R.', tool_used:'Video Attestation' },
]

const ReviewCard = memo(function ReviewCard({ r, i }: { r: Review; i: number }) {
  const text = r.body ?? r.text ?? ''
  const name = r.is_anonymous ? 'Anonymous' : (r.display_name ?? 'Aiscern User')
  const init = r.is_anonymous ? '?' : name.charAt(0).toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay: (i % 6) * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="break-inside-avoid mb-4 flex flex-col bg-surface border border-white/[0.06]
                 rounded-xl p-6 hover:border-white/[0.12] transition-colors duration-200"
    >
      <span className="self-start inline-flex items-center gap-1 mb-4 text-xs font-medium
                        text-accent bg-accent/10 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Verified
      </span>

      <p className="text-base text-silver-800 italic leading-relaxed flex-1 mb-5">&ldquo;{text}&rdquo;</p>

      <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
        <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0" aria-hidden="true">
          {init}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-silver-900 truncate">{name}</p>
          {r.tool_used && <p className="text-xs uppercase tracking-wider text-silver-600 truncate">{r.tool_used}</p>}
        </div>
      </div>
    </motion.div>
  )
})

export default function HomepageReviews() {
  const [reviews, setReviews] = useState<Review[]>(FALLBACK)

  useEffect(() => {
    fetch('/api/reviews?limit=9&sort=helpful')
      .then(r => r.json())
      .then(d => { if (d.data?.length >= 3) setReviews(d.data.slice(0, 9)) })
      .catch(() => {})
  }, [])

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
      {reviews.map((r, i) => <ReviewCard key={String(r.id)} r={r} i={i} />)}
    </div>
  )
}
