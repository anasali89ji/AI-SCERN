'use client'
/**
 * HomepageReviews — lazy-loaded chunk
 * Extracted from app/page.tsx for route-based code splitting.
 * Fetches /api/reviews only after the component mounts (below-fold).
 * 
 * Fixes: TypeScript interfaces (Module 8.4), React.memo (Module 8.3)
 */
import { useState, useEffect, memo } from 'react'
import { motion } from 'framer-motion'

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

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#7c3aed,#2563eb)',
  'linear-gradient(135deg,#0ea5e9,#06b6d4)',
  'linear-gradient(135deg,#10b981,#16a34a)',
  'linear-gradient(135deg,#f43f5e,#dc2626)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#8b5cf6,#6d28d9)',
]

const ReviewCard = memo(function ReviewCard({ r, i }: { r: Review; i: number }) {
  const starCount = r.rating ?? r.stars ?? 5
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ delay: i * 0.1 }}
      className="card border-border/30 hover:border-primary/20 transition-colors"
    >
      <div className="flex gap-0.5 mb-4" aria-label={`${starCount} out of 5 stars`}>
        {Array.from({ length: starCount }).map((_, j) => (
          <span key={j} className="text-amber text-sm" aria-hidden="true">★</span>
        ))}
      </div>
      <p className="text-text-secondary text-sm leading-relaxed mb-4">
        &ldquo;{r.body ?? r.text}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }}
          aria-hidden="true"
        >
          {r.is_anonymous ? '?' : (r.display_name?.charAt(0) ?? 'U').toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-semibold text-text-primary">
            {r.is_anonymous ? 'Anonymous' : (r.display_name ?? 'Aiscern User')}
          </div>
          <div className="text-xs text-text-muted">{r.tool_used ?? 'Aiscern User'}</div>
        </div>
      </div>
    </motion.div>
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
    <div className="grid sm:grid-cols-3 gap-4 sm:gap-6" aria-busy="true" aria-label="Loading reviews">
      {[0, 1, 2].map(i => (
        <div key={i} className="card border-border/50 h-40 animate-pulse bg-surface/60 rounded-2xl" />
      ))}
    </div>
  )

  const FALLBACK_REVIEWS: Review[] = [
    { id: 'f1', rating: 5, body: 'Aiscern caught AI-generated content in my student submissions that I would have missed. The accuracy is impressive.', display_name: 'Dr. Sarah M.', tool_used: 'AI Text Detector' },
    { id: 'f2', rating: 5, body: 'The deepfake detector saved our editorial team from publishing manipulated images. An essential tool for any newsroom.', display_name: 'James K.', tool_used: 'Deepfake Image Detector' },
    { id: 'f3', rating: 5, body: 'Fast, accurate, and easy to use. I use it daily to verify audio authenticity in my investigative work.', display_name: 'Priya L.', tool_used: 'AI Audio Detector' },
  ]

  const displayReviews = reviews.length ? reviews : FALLBACK_REVIEWS

  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
      {displayReviews.map((r, i) => (
        <ReviewCard key={r.id ?? i} r={r} i={i} />
      ))}
    </div>
  )
}
