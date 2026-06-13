'use client'
import { useState, useEffect } from 'react'
import { Star, X } from 'lucide-react'
import { ReviewModal } from '@/components/ReviewModal'
import { useAuth } from '@/components/auth-provider'

interface Props { toolName: string }

const DISMISS_KEY = (tool: string) => `aiscern_review_dismissed_${tool}`
const REVIEWED_KEY = (tool: string) => `aiscern_reviewed_${tool}`
const DISMISS_DAYS = 7

export function ReviewSuggestion({ toolName }: Props) {
  const { user } = useAuth()
  const [visible, setVisible]         = useState(false)
  const [modalOpen, setModalOpen]     = useState(false)
  const [preRating, setPreRating]     = useState(0)
  const [alreadyReviewed, setAlready] = useState(false)
  const [hover, setHover]             = useState(0)

  useEffect(() => {
    const dismissed   = localStorage.getItem(DISMISS_KEY(toolName))
    const reviewed    = localStorage.getItem(REVIEWED_KEY(toolName))
    if (reviewed)    { setAlready(true); setVisible(true); return }
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      const age = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
      if (age < DISMISS_DAYS) return
    }
    setVisible(true)
  }, [toolName])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY(toolName), String(Date.now()))
    setVisible(false)
  }

  const handleStarClick = (n: number) => {
    setPreRating(n)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    localStorage.setItem(REVIEWED_KEY(toolName), '1')
    setAlready(true)
  }

  if (!visible) return null

  return (
    <>
      <div className="mt-6 rounded-xl border border-white/[0.08] bg-surface/60 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        {alreadyReviewed ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>You reviewed {toolName} —</span>
            <button onClick={() => setModalOpen(true)} className="text-primary hover:underline font-medium">Edit review</button>
          </div>
        ) : (
          <>
            <span className="text-sm text-slate-400 font-medium">How was {toolName}?</span>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n}
                  onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                  onClick={() => handleStarClick(n)}
                  className="transition-transform">
                  <Star className={`w-6 h-6 transition-colors ${n <= (hover || preRating) ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`} />
                </button>
              ))}
            </div>
            <button onClick={dismiss} className="p-1 rounded-lg hover:bg-[#141420] text-slate-600 hover:text-slate-500 transition-colors ml-auto">
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
      <ReviewModal isOpen={modalOpen} onClose={handleModalClose} toolName={toolName} initialRating={preRating} />
    </>
  )
}
