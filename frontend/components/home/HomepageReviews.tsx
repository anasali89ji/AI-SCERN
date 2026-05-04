'use client'
/**
 * HomepageReviews — lazy-loaded chunk
 * Extracted from app/page.tsx for route-based code splitting.
 * Fetches /api/reviews only after the component mounts (below-fold).
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#7c3aed,#2563eb)',
  'linear-gradient(135deg,#0ea5e9,#06b6d4)',
  'linear-gradient(135deg,#10b981,#16a34a)',
  'linear-gradient(135deg,#f43f5e,#dc2626)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#8b5cf6,#6d28d9)',
]

export default function HomepageReviews() {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reviews?page=1&sort=top&limit=3')
      .then(r => r.json())
      .then(d => { if (d.data?.length) setReviews(d.data.slice(0, 3)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
      {[0, 1, 2].map(i => (
        <div key={i} className="card border-border/50 h-40 animate-pulse bg-surface/60 rounded-2xl" />
      ))}
    </div>
  )

  if (!reviews.length) return null

  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
      {reviews.map((r: any, i: number) => (
        <motion.div key={r.id || i}
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ delay: i * 0.1 }}
          className="card border-border/30 hover:border-primary/20 transition-colors">
          <div className="flex gap-0.5 mb-4">
            {Array.from({ length: r.rating || r.stars || 5 }).map((_: unknown, j: number) => (
              <span key={j} className="text-amber text-sm">★</span>
            ))}
          </div>
          <p className="text-text-secondary text-sm leading-relaxed mb-4">
            &ldquo;{r.body || r.text}&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }}
            >
              {r.is_anonymous ? '?' : (r.display_name?.charAt(0) || 'U').toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary">
                {r.is_anonymous ? 'Anonymous' : (r.display_name || 'Aiscern User')}
              </div>
              <div className="text-xs text-text-muted">{r.tool_used || 'Aiscern User'}</div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
