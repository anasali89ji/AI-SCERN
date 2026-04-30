'use client'
import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Star, ThumbsUp, CheckCircle, PenLine, Filter, ChevronLeft, ChevronRight, EyeOff, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/components/auth-provider'
import { SiteNav } from '@/components/SiteNav'

// Lazy-load the modal — heavy framer-motion dialog, only needed on user action
const ReviewModal = lazy(() => import('@/components/ReviewModal').then(m => ({ default: m.ReviewModal })))

const SORT_OPTIONS = [
  { value: 'helpful', label: 'Most Helpful' },
  { value: 'newest',  label: 'Newest First' },
  { value: 'top',     label: 'Top Rated'    },
  { value: 'lowest',  label: 'Lowest Rated' },
]

const STAR_FILTERS = [
  { value: 0,  label: 'All Stars' },
  { value: 5,  label: '5 ★' },
  { value: 4,  label: '4 ★' },
  { value: 3,  label: '3 ★' },
  { value: 2,  label: '2 ★' },
  { value: 1,  label: '1 ★' },
]

interface Review {
  id:            string
  display_name:  string
  is_anonymous:  boolean
  rating:        number
  title:         string
  body:          string
  tool_used:     string | null
  helpful_count: number
  verified:      boolean
  created_at:    string
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`${cls} ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`} />
      ))}
    </div>
  )
}

function ReviewerAvatar({ name, isAnon }: { name: string; isAnon: boolean }) {
  const initials = isAnon ? '?' : name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
  const colors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#f43f5e']
  const color = isAnon ? '#64748b' : colors[name.charCodeAt(0) % colors.length]
  return (
    <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
      style={{ background: isAnon ? 'linear-gradient(135deg,#374151,#1f2937)' : `linear-gradient(135deg,${color},${color}99)` }}>
      {isAnon ? <EyeOff className="w-4 h-4" /> : initials}
    </div>
  )
}

function timeAgo(ts: string) {
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30)  return `${days} days ago`
  if (days < 365) return `${Math.floor(days/30)} months ago`
  return `${Math.floor(days/365)} years ago`
}

// Expandable review body — shows full text with "Show more/less"
function ReviewBody({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = body.length > 280

  return (
    <div>
      <p className="text-sm text-text-muted leading-relaxed">
        {isLong && !expanded ? body.slice(0, 280) + '…' : body}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline font-medium"
        >
          {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Read full review</>}
        </button>
      )}
    </div>
  )
}

export default function ReviewsPage() {
  const { user }  = useAuth()
  const [reviews, setReviews]         = useState<Review[]>([])
  const [total,   setTotal]           = useState(0)
  const [pages,   setPages]           = useState(1)
  const [loading, setLoading]         = useState(true)
  const [page,    setPage]            = useState(1)
  const [sort,    setSort]            = useState('helpful')
  const [starFilter, setStarFilter]   = useState(0)
  const [modalOpen, setModalOpen]     = useState(false)
  const [helpfulSet, setHelpfulSet]   = useState<Set<string>>(new Set())

  // Real aggregate stats fetched separately (not computed from current page)
  const [stats, setStats] = useState<{ avg: string; breakdown: { n: number; count: number; pct: number }[]; total: number } | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/reviews/stats')
      if (res.ok) setStats(await res.json())
    } catch {}
  }, [])

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), sort })
      if (starFilter > 0) params.set('rating', String(starFilter))
      const res = await fetch(`/api/reviews?${params}`)
      const d   = await res.json()
      setReviews(d.data ?? [])
      setTotal(d.total ?? 0)
      setPages(d.pages ?? 1)
    } catch {}
    setLoading(false)
  }, [page, sort, starFilter])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchReviews() }, [fetchReviews])

  const toggleHelpful = async (id: string) => {
    if (helpfulSet.has(id)) return
    setHelpfulSet(prev => new Set([...prev, id]))
    setReviews(prev => prev.map(r => r.id === id ? { ...r, helpful_count: r.helpful_count + 1 } : r))
    await fetch(`/api/reviews/${id}/helpful`, { method: 'POST' }).catch(() => {})
  }

  const displayStats = stats ?? {
    avg: reviews.length > 0 ? (reviews.reduce((s,r) => s + r.rating, 0) / reviews.length).toFixed(1) : '5.0',
    total,
    breakdown: [5,4,3,2,1].map(n => ({
      n, count: reviews.filter(r => r.rating === n).length,
      pct: reviews.length > 0 ? Math.round(reviews.filter(r => r.rating === n).length / reviews.length * 100) : 0
    }))
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <SiteNav />

      <main className="pt-20 sm:pt-24 pb-20 px-4 max-w-6xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            User <span className="gradient-text">Reviews</span>
          </h1>
          <p className="text-text-muted text-lg max-w-xl mx-auto mb-6">
            Real feedback from real users. Every review — 1 star to 5 stars — published unfiltered.
          </p>
          <button onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 btn-primary px-6 py-3 text-sm font-bold">
            <PenLine className="w-4 h-4" /> Write a Review
          </button>
        </motion.div>

        {/* Stats summary */}
        {displayStats.total > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-surface border border-border rounded-2xl p-4 sm:p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="flex items-center gap-5">
              <div className="text-center">
                <div className="text-6xl font-black gradient-text">{displayStats.avg}</div>
                <StarRow rating={Math.round(parseFloat(displayStats.avg))} size="md" />
                <p className="text-xs text-text-muted mt-1">{displayStats.total} review{displayStats.total !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {displayStats.breakdown.map(b => (
                  <button key={b.n}
                    onClick={() => { setStarFilter(starFilter === b.n ? 0 : b.n); setPage(1) }}
                    className={`w-full flex items-center gap-2 rounded-lg px-1 py-0.5 transition-all ${starFilter === b.n ? 'bg-primary/10' : 'hover:bg-surface-active'}`}>
                    <span className="text-xs text-text-muted w-3">{b.n}</span>
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                    <div className="flex-1 bg-border rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
                        style={{ width: `${b.pct}%` }} />
                    </div>
                    <span className="text-xs text-text-disabled w-6 text-right">{b.count}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              {[
                { label: 'Verified Users',  value: stats?.verified ?? '—', icon: CheckCircle, color: 'text-emerald' },
                { label: 'Anonymous',       value: stats?.anonymous ?? '—', icon: EyeOff, color: 'text-text-muted' },
                { label: 'Helpful votes',   value: stats?.helpfulVotes ?? '—', icon: ThumbsUp, color: 'text-primary' },
                { label: '5-star reviews',  value: displayStats.breakdown.find(b => b.n === 5)?.count ?? 0, icon: Star, color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="bg-surface-active rounded-xl p-3 flex items-center gap-2.5">
                  <s.icon className={`w-5 h-5 flex-shrink-0 ${s.color}`} />
                  <div>
                    <div className="text-lg font-black text-text-primary">{s.value}</div>
                    <div className="text-[10px] text-text-muted">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Filter className="w-4 h-4" /> Sort:
          </div>
          {SORT_OPTIONS.map(o => (
            <button key={o.value} onClick={() => { setSort(o.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${sort === o.value ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:text-text-primary'}`}>
              {o.label}
            </button>
          ))}
          <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
          {STAR_FILTERS.map(f => (
            <button key={f.value} onClick={() => { setStarFilter(f.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${starFilter === f.value ? 'bg-amber-400 text-black' : 'bg-surface border border-border text-text-muted hover:text-text-primary'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {starFilter > 0 && (
          <p className="text-xs text-text-muted mb-4">
            Showing {total} {starFilter}-star review{total !== 1 ? 's' : ''}.{' '}
            <button onClick={() => { setStarFilter(0); setPage(1) }} className="text-primary hover:underline">Clear filter</button>
          </p>
        )}

        {/* Reviews grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-24">
            <Star className="w-12 h-12 text-text-disabled mx-auto mb-4" />
            <p className="text-text-muted font-medium mb-2">{starFilter > 0 ? `No ${starFilter}-star reviews yet` : 'No reviews yet'}</p>
            {starFilter > 0 ? (
              <button onClick={() => { setStarFilter(0); setPage(1) }} className="btn-primary px-6 py-2.5 text-sm">
                Clear Filter
              </button>
            ) : (
              <>
                <p className="text-text-disabled text-sm mb-6">Be the first to share your experience.</p>
                <button onClick={() => setModalOpen(true)} className="btn-primary px-6 py-2.5 text-sm">
                  Write First Review
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-8">
            <AnimatePresence mode="wait">
              {reviews.map((r, i) => (
                <motion.div key={r.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-surface border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col gap-3 hover:border-primary/30 transition-all">

                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <ReviewerAvatar name={r.display_name} isAnon={r.is_anonymous} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-text-primary text-sm truncate">
                          {r.display_name}
                        </span>
                        {r.verified && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald bg-emerald/10 px-1.5 py-0.5 rounded-full border border-emerald/20 font-medium">
                            <CheckCircle className="w-2.5 h-2.5" /> Verified
                          </span>
                        )}
                        {r.is_anonymous && (
                          <span className="flex items-center gap-1 text-[10px] text-text-muted bg-surface-active px-1.5 py-0.5 rounded-full border border-border font-medium">
                            <EyeOff className="w-2.5 h-2.5" /> Anonymous
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRow rating={r.rating} />
                        <span className="text-xs text-text-disabled">{timeAgo(r.created_at)}</span>
                      </div>
                    </div>
                    {r.tool_used && (
                      <span className="text-[10px] bg-surface-active border border-border px-2 py-1 rounded-lg text-text-muted font-medium flex-shrink-0 hidden sm:block">
                        {r.tool_used}
                      </span>
                    )}
                  </div>

                  {/* Content — full text, expandable if long */}
                  <div>
                    <h3 className="font-bold text-text-primary text-sm mb-1">{r.title}</h3>
                    <ReviewBody body={r.body} />
                  </div>

                  {/* Helpful */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <button onClick={() => toggleHelpful(r.id)}
                      disabled={helpfulSet.has(r.id)}
                      className={`flex items-center gap-1.5 text-xs transition-all px-3 py-1.5 rounded-lg ${helpfulSet.has(r.id) ? 'text-primary bg-primary/10 border border-primary/20' : 'text-text-muted hover:text-text-primary hover:bg-surface-active border border-transparent'}`}>
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {helpfulSet.has(r.id) ? 'Helpful!' : 'Helpful'}
                      {r.helpful_count > 0 && <span className="font-bold">({r.helpful_count})</span>}
                    </button>
                    {r.tool_used && (
                      <span className="text-[10px] text-text-disabled sm:hidden">{r.tool_used}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page === 1}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border text-sm text-text-muted hover:text-text-primary hover:border-primary/40 transition-all disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-text-muted">Page {page} of {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages,p+1))} disabled={page === pages}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border text-sm text-text-muted hover:text-text-primary hover:border-primary/40 transition-all disabled:opacity-40">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-16 p-8 rounded-2xl border border-border bg-surface/40">
          <h2 className="text-2xl font-black text-text-primary mb-2">Share Your Experience</h2>
          <p className="text-text-muted mb-5">
            Tried Aiscern? Help others by sharing your honest feedback — 1 star or 5 stars, anonymously or with your name.
          </p>
          <button onClick={() => setModalOpen(true)}
            className="btn-primary px-8 py-3 font-bold inline-flex items-center gap-2">
            <Star className="w-4 h-4" /> Write a Review
          </button>
        </div>
      </main>

      <SiteFooter />

      <Suspense fallback={null}>
        <ReviewModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); fetchReviews(); fetchStats() }}
        />
      </Suspense>
    </div>
  )
}
