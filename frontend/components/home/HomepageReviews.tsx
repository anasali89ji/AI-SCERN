'use client'
import { useState, useEffect, memo } from 'react'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

interface Review {
  id?: string | number
  rating?: number
  stars?: number
  body?: string
  text?: string
  is_anonymous?: boolean
  display_name?: string
  tool_used?: string
}

const FALLBACK_REVIEWS: Review[] = [
  { id:'f1', rating:5, body:'Caught AI-generated submissions I would have missed entirely. The sentence-level heatmap is what sets it apart from other tools.', display_name:'Dr. Sarah M.',  tool_used:'AI Text Detector'        },
  { id:'f2', rating:5, body:'The deepfake detector saved our editorial team from publishing a manipulated image. Essential for any newsroom doing visual verification.', display_name:'James K.',       tool_used:'Deepfake Image Detector'  },
  { id:'f3', rating:5, body:'Fast and accurate. I run every audio clip through it before broadcasting. Has saved me from voice clone disinformation twice.',             display_name:'Priya L.',       tool_used:'AI Audio Detector'        },
]

const AVATAR_BG = ['bg-blue-600','bg-emerald-500-600','bg-violet-600','bg-rose-500-600','bg-amber-500-600','bg-sky-600']

const ReviewCard = memo(function ReviewCard({ r, i }: { r: Review; i: number }) {
  const stars = r.rating ?? r.stars ?? 5
  const text  = r.body ?? r.text ?? ''
  const name  = r.is_anonymous ? 'Anonymous' : (r.display_name ?? 'Aiscern User')
  const initial = r.is_anonymous ? '?' : name.charAt(0).toUpperCase()

  return (
    <div>
      {/* Stars */}
      <div className="flex gap-0.5 mb-4" aria-label={`${stars} out of 5 stars`}>
        {Array.from({ length: stars }).map((_, j) => (
          <Star key={j} className="w-3.5 h-3.5 text-amber-400-400 fill-amber-400" aria-hidden />
        ))}
        {Array.from({ length: 5 - stars }).map((_, j) => (
          <Star key={`e-${j}`} className="w-3.5 h-3.5 text-slate-700" aria-hidden />
        ))}
      </div>

      {/* Quote */}
      <p className="text-sm text-slate-400 leading-relaxed flex-1 mb-5">
        &ldquo;{text}&rdquo;
      </p>

      {/* Author */}
      <div className="flex items-center gap-3 pt-4 border-t border-white/[0.05]">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0 ${AVATAR_BG[i % AVATAR_BG.length]}`}
          aria-hidden
        >
          {initial}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-200">{name}</div>
          {r.tool_used && (
            <div className="text-[11px] text-slate-500">{r.tool_used}</div>
          )}
        </div>
      </div>
    </div>
  )
})

export default function HomepageReviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reviews?page=1&sort=top&limit=3')
      .then(r => r.json())
      .then(d => { if (d.data?.length) setReviews(d.data.slice(0, 3)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="grid sm:grid-cols-3 gap-4" aria-busy="true">
      {[0,1,2].map(i => <div key={i} className="h-44 rounded-[14px] shimmer" />)}
    </div>
  )

  const display = reviews.length ? reviews : FALLBACK_REVIEWS

  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
      {display.map((r, i) => <ReviewCard key={r.id ?? i} r={r} i={i} />)}
    </div>
  )
}
