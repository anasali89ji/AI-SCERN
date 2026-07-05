'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Star, CheckCircle2, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'

const TOOLS = ['AI Text Detector','Image Detector','Audio Detector','Video Detector','Batch Analyser','General']
const STAR_LABELS = ['','Terrible','Poor','Average','Good','Excellent']

interface Props {
  isOpen: boolean; onClose: () => void
  toolName?: string; initialRating?: number
}

export function ReviewModal({ isOpen, onClose, toolName, initialRating = 0 }: Props) {
  const { user } = useAuth()
  const [rating, setRating]         = useState(initialRating)
  const [hover,  setHover]          = useState(0)
  const [title,  setTitle]          = useState('')
  const [body,   setBody]           = useState('')
  const [tool,   setTool]           = useState(toolName ?? TOOLS[0])
  const [displayName, setDisplayName] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [error,       setError]       = useState('')
  const focusRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { if (initialRating) setRating(initialRating) }, [initialRating])
  useEffect(() => { if (toolName) setTool(toolName) }, [toolName])
  useEffect(() => {
    if (user && !displayName) setDisplayName(user.displayName || user.email?.split('@')[0] || '')
  }, [user]) // eslint-disable-line

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    if (isOpen) setTimeout(() => focusRef.current?.focus(), 50)
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const canSubmit = rating > 0 && title.trim().length > 0 && body.trim().length >= 30

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating, title: title.trim(), body: body.trim(), toolUsed: tool,
          displayName: isAnonymous ? null : displayName.trim(), isAnonymous,
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog" aria-modal="true" aria-label="Write a review">

      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#0A0A0A]/80" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-[#141414] border border-[#1E1E1E] rounded-t-2xl sm:rounded-xl
                      shadow-[0_8px_40px_rgba(0,0,0,0.8)] max-h-[92dvh] overflow-y-auto animate-slide-up">

        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-[#1E1E1E] bg-[#141414] z-10">
          <div>
            <h2 className="text-base font-bold text-white">Write a Review</h2>
            <p className="text-xs text-[#6B6B6B] mt-0.5">Share your honest experience with Aiscern</p>
          </div>
          <button ref={focusRef} onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B6B6B] hover:text-white hover:bg-[#1A1A1A] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {success ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-12 h-12 text-[#2BEE34] mx-auto mb-3" />
              <p className="text-lg font-bold text-white mb-1">Thank you!</p>
              <p className="text-sm text-[#A3A3A3]">Your review has been submitted.</p>
            </div>
          ) : (
            <>
              {!user && (
                <div className="p-4 rounded-xl bg-[#2BEE34]/5 border border-[#2BEE34]/20 text-sm text-[#A3A3A3]">
                  <Link href="/signup" className="text-[#2BEE34] font-semibold hover:underline">Create a free account</Link>
                  {' '}to link your review to your profile, or continue anonymously.
                </div>
              )}

              {/* Stars */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6B6B6B] block mb-2">
                  Overall Rating *
                </label>
                <div className="flex gap-1.5" role="group" aria-label="Star rating">
                  {[1,2,3,4,5].map(n => (
                    <button key={n}
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      aria-label={`${n} star${n > 1 ? 's' : ''} — ${STAR_LABELS[n]}`}
                      aria-pressed={rating === n}
                      className="p-1 transition-transform hover:scale-110 active:scale-95">
                      <Star className={`w-8 h-8 transition-colors ${
                        n <= (hover || rating) ? 'text-[#FFB800] fill-[#FFB800]' : 'text-[#3A3A3A]'
                      }`} />
                    </button>
                  ))}
                </div>
                {(hover || rating) > 0 && (
                  <p className="text-xs text-[#2BEE34] mt-1 font-medium">{STAR_LABELS[hover || rating]}</p>
                )}
              </div>

              {/* Tool */}
              <div>
                <label htmlFor="review-tool" className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6B6B6B] block mb-2">
                  Tool Used
                </label>
                <select id="review-tool" value={tool} onChange={e => setTool(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-[#E5E5E5]
                             focus:border-[#2BEE34] focus:outline-none transition-colors">
                  {TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Title */}
              <div>
                <label htmlFor="review-title" className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6B6B6B] block mb-2">
                  Review Title *
                </label>
                <input id="review-title" type="text" value={title}
                  onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Summarize your experience…"
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-[#E5E5E5]
                             placeholder-[#6B6B6B] focus:border-[#2BEE34] focus:outline-none transition-colors" />
              </div>

              {/* Body */}
              <div>
                <label htmlFor="review-body" className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6B6B6B] block mb-2">
                  Your Review * <span className="text-[#6B6B6B] normal-case font-normal">(min 30 chars)</span>
                </label>
                <textarea id="review-body" value={body} onChange={e => setBody(e.target.value)}
                  rows={4} maxLength={1500} placeholder="Tell us what you used it for, what worked, and what could improve…"
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-[#E5E5E5]
                             placeholder-[#6B6B6B] resize-none focus:border-[#2BEE34] focus:outline-none transition-colors" />
                <p className="text-[10px] text-[#6B6B6B] mt-1">{body.length}/1500 · {Math.max(0, 30 - body.length)} more needed</p>
              </div>

              {/* Display name */}
              <div className="space-y-3">
                <label htmlFor="review-anonymous" className="flex items-center gap-3 cursor-pointer w-fit">
                  <input id="review-anonymous" type="checkbox" checked={isAnonymous}
                    onChange={e => setIsAnonymous(e.target.checked)}
                    className="peer sr-only" />
                  <div aria-hidden className={`w-9 h-5 rounded-full transition-colors relative shrink-0
                    peer-focus-visible:ring-2 peer-focus-visible:ring-[#2BEE34]/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#141414]
                    ${isAnonymous ? 'bg-[#2BEE34]' : 'bg-[#2A2A2A]'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isAnonymous ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-[#A3A3A3] flex items-center gap-1.5">
                    <EyeOff className="w-3.5 h-3.5" /> Post anonymously
                  </span>
                </label>
                {!isAnonymous && (
                  <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                    placeholder="Display name (e.g. Dr. Sarah M.)" maxLength={60}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-[#E5E5E5]
                               placeholder-[#6B6B6B] focus:border-[#2BEE34] focus:outline-none transition-colors" />
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-[#FF4444] bg-[#FF4444]/5 border border-[#FF4444]/20 rounded-lg px-4 py-2.5">{error}</p>
              )}

              {/* Submit */}
              <button onClick={handleSubmit} disabled={!canSubmit || submitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg
                           bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-bold text-sm
                           transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit Review'}
              </button>
              <p className="text-[10px] text-[#6B6B6B] text-center">
                All reviews are published unfiltered — 1 star to 5 stars.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
