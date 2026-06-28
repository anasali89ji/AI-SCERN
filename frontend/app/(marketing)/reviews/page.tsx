'use client'
import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { Star, ThumbsUp, CheckCircle2, PenLine, Filter, ChevronLeft, ChevronRight, EyeOff, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/components/auth-provider'
import { SiteNav } from '@/components/SiteNav'

const ReviewModal = lazy(() => import('@/components/ReviewModal').then(m => ({ default: m.ReviewModal })))

const SORT_OPTIONS = [
  { value: 'helpful', label: 'Most Helpful' },
  { value: 'newest',  label: 'Newest First' },
  { value: 'top',     label: 'Top Rated'    },
  { value: 'lowest',  label: 'Lowest Rated' },
]

const STAR_FILTERS = [
  { value: 0, label: 'All' },
  { value: 5, label: '5 ★' },
  { value: 4, label: '4 ★' },
  { value: 3, label: '3 ★' },
  { value: 2, label: '2 ★' },
  { value: 1, label: '1 ★' },
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

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`${cls} ${i <= rating ? 'text-[#FFB800] fill-[#FFB800]' : 'text-[#3A3A3A]'}`} />
      ))}
    </div>
  )
}

function ReviewerAvatar({ name, isAnon }: { name: string; isAnon: boolean }) {
  const initials = isAnon ? '?' : name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
      isAnon ? 'bg-[#1A1A1A] border border-[#2A2A2A] text-[#6B6B6B]' : 'bg-[#2BEE34]/10 border border-[#2BEE34]/20 text-[#2BEE34]'
    }`}>
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

function ReviewBody({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = body.length > 280
  return (
    <div className="flex-1 min-w-0">
      <p className="text-sm text-[#A3A3A3] leading-relaxed">
        {isLong && !expanded ? body.slice(0, 280) + '…' : body}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-1.5 flex items-center gap-1 text-xs text-[#2BEE34] hover:underline font-medium"
        >
          {expanded
            ? <><ChevronUp className="w-3 h-3" /> Show less</>
            : <><ChevronDown className="w-3 h-3" /> Read full review</>}
        </button>
      )}
    </div>
  )
}

export default function ReviewsPage() {
  const { user }  = useAuth()
  const [reviews,     setReviews]     = useState<Review[]>([])
  const [total,       setTotal]       = useState(0)
  const [pages,       setPages]       = useState(1)
  const [loading,     setLoading]     = useState(true)
  const [page,        setPage]        = useState(1)
  const [sort,        setSort]        = useState('helpful')
  const [starFilter,  setStarFilter]  = useState(0)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [helpfulSet,  setHelpfulSet]  = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<{
    avg: string; breakdown: { n: number; count: number; pct: number }[];
    total: number; verified: number; anonymous: number; helpfulVotes: number
  } | null>(null)

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

  useEffect(() => { fetchStats() },   [fetchStats])
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
    <div className="min-h-screen bg-[#141414] text-[#E5E5E5]">
      <SiteNav />
      <main id="main-content" className="pt-24 pb-20 px-4 sm:px-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#2BEE34] mb-3">
            User Stories
          </p>
          <h1 className="text-[40px] sm:text-[52px] font-bold text-white tracking-[-0.02em] mb-4">
            User Reviews
          </h1>
          <p className="text-[#A3A3A3] text-lg max-w-xl mx-auto mb-6">
            Real feedback from real users. Every review — 1 star to 5 stars — published unfiltered.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
                       bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-semibold text-sm
                       transition-colors duration-150"
          >
            <PenLine className="w-4 h-4" /> Write a Review
          </button>
        </div>

        {/* Stats summary */}
        {displayStats.total > 0 && (
          <div className="bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl p-5 sm:p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <div className="flex items-center gap-5">
              <div className="text-center shrink-0">
                <div className="text-5xl font-black text-[#2BEE34]">{displayStats.avg}</div>
                <StarRow rating={Math.round(parseFloat(displayStats.avg))} size="md" />
                <p className="text-xs text-[#6B6B6B] mt-1">{displayStats.total} review{displayStats.total !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex-1 space-y-2">
                {displayStats.breakdown.map(b => (
                  <button
                    key={b.n}
                    onClick={() => { setStarFilter(starFilter === b.n ? 0 : b.n); setPage(1) }}
                    className={`w-full flex items-center gap-2 rounded-lg px-1 py-1 transition-all ${
                      starFilter === b.n ? 'bg-[#2BEE34]/10' : 'hover:bg-[#1A1A1A]'
                    }`}
                  >
                    <span className="text-xs text-[#6B6B6B] w-3">{b.n}</span>
                    <Star className="w-3 h-3 text-[#FFB800] fill-[#FFB800] flex-shrink-0" />
                    <div className="flex-1 bg-[#2A2A2A] rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-[#FFB800] rounded-full transition-all duration-700"
                        style={{ width: `${b.pct}%` }} />
                    </div>
                    <span className="text-xs text-[#6B6B6B] w-5 text-right">{b.count}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Verified Users', value: stats?.verified ?? '—',      color: 'text-[#2BEE34]' },
                { label: 'Anonymous',      value: stats?.anonymous ?? '—',     color: 'text-[#6B6B6B]' },
                { label: 'Helpful votes',  value: stats?.helpfulVotes ?? '—',  color: 'text-[#E5E5E5]' },
                { label: '5-star reviews', value: displayStats.breakdown.find(b => b.n === 5)?.count ?? 0, color: 'text-[#FFB800]' },
              ].map(s => (
                <div key={s.label} className="bg-[#141414] border border-[#1E1E1E] rounded-xl p-3">
                  <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-[#6B6B6B] mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="flex items-center gap-1.5 text-sm text-[#6B6B6B]">
            <Filter className="w-3.5 h-3.5" /> Sort:
          </div>
          {SORT_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => { setSort(o.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                sort === o.value
                  ? 'bg-[#2BEE34] text-[#0A0A0A]'
                  : 'bg-[#1A1A1A] border border-[#2A2A2A] text-[#6B6B6B] hover:text-white'
              }`}
            >
              {o.label}
            </button>
          ))}
          <div className="w-px h-5 bg-[#2A2A2A] mx-1 hidden sm:block" />
          {STAR_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setStarFilter(f.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                starFilter === f.value
                  ? 'bg-[#FFB800] text-[#0A0A0A]'
                  : 'bg-[#1A1A1A] border border-[#2A2A2A] text-[#6B6B6B] hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {starFilter > 0 && (
          <p className="text-xs text-[#6B6B6B] mb-4">
            Showing {total} {starFilter}-star review{total !== 1 ? 's' : ''}.{' '}
            <button onClick={() => { setStarFilter(0); setPage(1) }} className="text-[#2BEE34] hover:underline">
              Clear filter
            </button>
          </p>
        )}

        {/* Reviews grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-[#2BEE34] animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-24">
            <Star className="w-12 h-12 text-[#3A3A3A] mx-auto mb-4" />
            <p className="text-[#6B6B6B] font-medium mb-2">
              {starFilter > 0 ? `No ${starFilter}-star reviews yet` : 'No reviews yet'}
            </p>
            {starFilter > 0 ? (
              <button
                onClick={() => { setStarFilter(0); setPage(1) }}
                className="px-6 py-2.5 rounded-lg bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] text-sm font-semibold transition-colors"
              >
                Clear Filter
              </button>
            ) : (
              <>
                <p className="text-[#6B6B6B] text-sm mb-6">Be the first to share your experience.</p>
                <button
                  onClick={() => setModalOpen(true)}
                  className="px-6 py-2.5 rounded-lg bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] text-sm font-semibold transition-colors"
                >
                  Write First Review
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-8">
            {reviews.map(r => (
              <div
                key={r.id}
                className="bg-[#141414] border border-[#1E1E1E] rounded-xl p-4 sm:p-5 flex flex-col gap-3
                           hover:border-[#2A2A2A] transition-all duration-150"
              >
                <div className="flex items-start gap-3">
                  <ReviewerAvatar name={r.display_name} isAnon={r.is_anonymous} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm truncate">{r.display_name}</span>
                      {r.verified && (
                        <span className="flex items-center gap-1 text-[10px] text-[#2BEE34] bg-[#2BEE34]/10 px-1.5 py-0.5 rounded-full border border-[#2BEE34]/20 font-medium">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                        </span>
                      )}
                      {r.is_anonymous && (
                        <span className="flex items-center gap-1 text-[10px] text-[#6B6B6B] bg-[#1A1A1A] px-1.5 py-0.5 rounded-full border border-[#2A2A2A] font-medium">
                          <EyeOff className="w-2.5 h-2.5" /> Anonymous
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StarRow rating={r.rating} />
                      <span className="text-xs text-[#6B6B6B]">{timeAgo(r.created_at)}</span>
                    </div>
                  </div>
                  {r.tool_used && (
                    <span className="text-[10px] bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-1 rounded-lg text-[#6B6B6B] font-medium flex-shrink-0 hidden sm:block">
                      {r.tool_used}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm mb-1">{r.title}</h3>
                  <ReviewBody body={r.body} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#1E1E1E]">
                  <button
                    onClick={() => toggleHelpful(r.id)}
                    disabled={helpfulSet.has(r.id)}
                    className={`flex items-center gap-1.5 text-xs transition-all px-3 py-1.5 rounded-lg ${
                      helpfulSet.has(r.id)
                        ? 'text-[#2BEE34] bg-[#2BEE34]/10 border border-[#2BEE34]/20'
                        : 'text-[#6B6B6B] hover:text-white hover:bg-[#1A1A1A] border border-transparent'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    {helpfulSet.has(r.id) ? 'Helpful!' : 'Helpful'}
                    {r.helpful_count > 0 && <span className="font-bold">({r.helpful_count})</span>}
                  </button>
                  {r.tool_used && (
                    <span className="text-[10px] text-[#6B6B6B] sm:hidden">{r.tool_used}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 mb-12">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-[#2A2A2A]
                         text-sm text-[#A3A3A3] hover:text-white hover:border-[#2BEE34]/40
                         transition-all disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-[#6B6B6B]">Page {page} of {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-[#2A2A2A]
                         text-sm text-[#A3A3A3] hover:text-white hover:border-[#2BEE34]/40
                         transition-all disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* CTA */}
        <div className="text-center p-8 rounded-xl border border-[#1E1E1E] bg-[#0A0A0A]">
          <h2 className="text-2xl font-semibold text-white mb-2">Share Your Experience</h2>
          <p className="text-[#A3A3A3] mb-5 text-sm">
            Tried Aiscern? Help others by sharing your honest feedback — 1 star or 5 stars, anonymously or with your name.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg
                       bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-semibold text-sm
                       transition-colors duration-150"
          >
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
