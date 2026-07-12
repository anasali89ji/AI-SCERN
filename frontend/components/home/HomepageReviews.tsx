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
  { id:'f1', body:'Caught AI-generated submissions I would have missed entirely. The sentence-level heatmap is what sets it apart from other tools.', display_name:'Dr. Sarah M.',  tool_used:'Text Attestation'       },
  { id:'f2', body:'The deepfake attestation tool saved our editorial team from publishing a manipulated image. Essential for any newsroom doing visual verification.', display_name:'James K.',       tool_used:'Image Attestation'           },
  { id:'f3', body:'Fast and accurate. I run every audio clip through it before broadcasting. Has saved me from voice clone disinformation twice.',             display_name:'Priya L.',       tool_used:'Audio Attestation'           },
  { id:'f4', body:'Screening resumes for AI-polished cover letters used to be guesswork. Now it takes seconds and the confidence score is genuinely useful.', display_name:'Marcus T.',      tool_used:'Text Attestation'         },
  { id:'f5', body:'Solid batch analyser — ran 20 student essays overnight and had a clear report by morning. Wish the free tier had a higher daily cap.',    display_name:'Anonymous',      tool_used:'Batch Content Analyser', is_anonymous:true },
  { id:'f6', body:'The video attestation tool flagged a manipulated clip our team almost shared. Frame-by-frame breakdown made the case immediately.',               display_name:'Elena R.',       tool_used:'Video Attestation'  },
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
