'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Star, CheckCircle, Eye, EyeOff, User } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'

const TOOLS = ['AI Text Detector','Image Detector','Audio Detector','Video Detector','Batch Analyser','General']
const STAR_LABELS = ['','Terrible','Poor','Average','Good','Excellent']

interface Props {
  isOpen:         boolean
  onClose:        () => void
  toolName?:      string
  initialRating?: number
}

export function ReviewModal({ isOpen, onClose, toolName, initialRating = 0 }: Props) {
  const { user } = useAuth()
  const [rating, setRating]       = useState(initialRating)
  const [hover, setHover]         = useState(0)
  const [title, setTitle]         = useState('')
  const [body, setBody]           = useState('')
  const [tool, setTool]           = useState(toolName ?? TOOLS[0])
  const [displayName, setDisplayName] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (initialRating) setRating(initialRating) }, [initialRating])
  useEffect(() => { if (toolName) setTool(toolName) }, [toolName])
  useEffect(() => {
    if (user && !displayName) {
      setDisplayName(user.displayName || user.email?.split('@')[0] || '')
    }
  }, [user]) // eslint-disable-line

  // Lock body scroll on mobile when modal open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
    } else {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
  }, [isOpen])

  const canSubmit = rating > 0 && title.trim().length > 0 && body.trim().length >= 30

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating, title: title.trim(), body: body.trim(),
          toolUsed: tool,
          displayName: isAnonymous ? null : displayName.trim(),
          isAnonymous,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Submission failed')
      setSuccess(true)
      setTimeout(() => { setSuccess(false); onClose() }, 2500)
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.')
    }
    setSubmitting(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          {/* Modal — slides up on mobile, scales in on desktop */}
          <motion.div
            className="relative z-10 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-border bg-surface shadow-2xl flex flex-col"
            style={{ maxHeight: '92dvh' }}
            initial={{ y: '100%', scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: '100%', scale: 0.98 }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Top accent */}
            <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-primary to-amber-500 rounded-t-2xl flex-shrink-0" />

            {/* Drag handle (mobile only) */}
            <div className="flex justify-center pt-2 pb-1 sm:hidden flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-0 flex-shrink-0">
              {!success && user && (
                <div>
                  <h2 className="text-lg font-bold text-text-primary">Write a Review</h2>
                  <p className="text-xs text-text-muted">Your feedback helps others</p>
                </div>
              )}
              {(success || !user) && <div />}
              <button onClick={onClose}
                className="p-2 rounded-xl hover:bg-surface-active transition-colors ml-auto">
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>

            {/* Scrollable content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-3"
              style={{ WebkitOverflowScrolling: 'touch' }}>

              {!user ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Star className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-text-primary mb-2">Sign in to leave a review</h2>
                  <p className="text-sm text-text-muted mb-6">Share your experience to help other users.</p>
                  <Link href="/signup" className="btn-primary px-6 py-2.5 text-sm inline-flex">
                    Create free account
                  </Link>
                </div>
              ) : success ? (
                <div className="text-center py-8">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="w-16 h-16 rounded-full bg-emerald/10 border border-emerald/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald" />
                  </motion.div>
                  <h2 className="text-xl font-bold text-text-primary mb-2">Review submitted!</h2>
                  <p className="text-sm text-text-muted">Thank you for helping the community.</p>
                </div>
              ) : (
                <div className="space-y-4">

                  {/* Star rating */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">
                      Your Rating *
                    </label>
                    <div className="flex items-center gap-2">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} type="button"
                          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                          onClick={() => setRating(n)}
                          className="transition-all hover:scale-110 active:scale-95 touch-manipulation">
                          <Star className={`w-9 h-9 sm:w-10 sm:h-10 transition-colors ${n <= (hover || rating) ? 'text-amber-400 fill-amber-400' : 'text-zinc-600'}`} />
                        </button>
                      ))}
                      {(hover || rating) > 0 && (
                        <span className="ml-1 text-sm font-bold text-amber-400">{STAR_LABELS[hover || rating]}</span>
                      )}
                    </div>
                  </div>

                  {/* Tool */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">Tool Used</label>
                    <select value={tool} onChange={e => setTool(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-primary/60 transition-colors">
                      {TOOLS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* Title */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Title *</label>
                      <span className="text-xs text-text-disabled">{title.length}/100</span>
                    </div>
                    <input
                      value={title} onChange={e => setTitle(e.target.value.slice(0,100))}
                      placeholder="Summarise your experience…"
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/60 transition-colors"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Review *</label>
                      <span className={`text-xs ${body.length > 0 && body.length < 30 ? 'text-rose' : 'text-text-disabled'}`}>
                        {body.length}/1000
                      </span>
                    </div>
                    <textarea
                      value={body} onChange={e => setBody(e.target.value.slice(0,1000))}
                      placeholder="Describe your experience… (min 30 chars)"
                      rows={3}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled resize-none focus:outline-none focus:border-primary/60 transition-colors"
                    />
                    {body.length > 0 && body.length < 30 && (
                      <p className="text-xs text-rose mt-1">{30 - body.length} more characters needed</p>
                    )}
                  </div>

                  {/* Identity */}
                  <div className="p-3 rounded-xl bg-surface-active border border-border/60">
                    <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2.5 block">Your Identity</label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button type="button" onClick={() => setIsAnonymous(false)}
                        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all border ${!isAnonymous ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-surface border-border text-text-muted'}`}>
                        <User className="w-3.5 h-3.5" /> Show Name
                      </button>
                      <button type="button" onClick={() => setIsAnonymous(true)}
                        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all border ${isAnonymous ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-surface border-border text-text-muted'}`}>
                        <EyeOff className="w-3.5 h-3.5" /> Anonymous
                      </button>
                    </div>
                    {!isAnonymous ? (
                      <input value={displayName} onChange={e => setDisplayName(e.target.value.slice(0,40))}
                        placeholder="Your name (e.g. Sarah K.)"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    ) : (
                      <p className="text-xs text-text-muted flex items-center gap-1.5">
                        <EyeOff className="w-3 h-3" />
                        Shows as <strong className="text-text-secondary">Anonymous User</strong>
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="px-4 py-3 rounded-xl bg-rose/10 border border-rose/20 text-rose text-sm">
                      {error}
                    </div>
                  )}

                  <button onClick={handleSubmit}
                    disabled={submitting || !canSubmit}
                    className="w-full btn-primary py-3.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {submitting ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
                    ) : (
                      <><Star className="w-4 h-4" /> Submit Review</>
                    )}
                  </button>

                  <p className="text-center text-xs text-text-disabled">
                    Reviews are moderated before publishing.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
