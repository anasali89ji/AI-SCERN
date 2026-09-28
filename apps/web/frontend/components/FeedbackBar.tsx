'use client'
/**
 * FeedbackBar — one-click feedback after every scan result.
 * Shows "Was this result correct?" with thumbs up/down.
 * Calls PATCH /api/scan/:id/feedback
 */
import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react'

interface Props {
  scanId:  string | null
  verdict: string
}

export function FeedbackBar({ scanId, verdict }: Props) {
  const [state, setState] = useState<'idle' | 'sent'>('idle')
  const [chosen, setChosen] = useState<'correct' | 'incorrect' | null>(null)

  if (!scanId) return null

  const send = async (feedback: 'correct' | 'incorrect') => {
    if (state === 'sent') return
    setChosen(feedback)
    setState('sent')
    try {
      await fetch(`/api/scan/${scanId}/feedback`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ feedback }),
      })
    } catch {}
  }

  if (state === 'sent') {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2BEE34]/10 border border-[#2BEE34]/20 text-[#2BEE34] text-sm font-medium">
        <Check className="w-4 h-4 flex-shrink-0" />
        {chosen === 'correct' ? 'Thanks — marked as correct!' : 'Thanks — we\'ll use this to improve.'}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#0f0f17] border border-white/[0.08]">
      <span className="text-sm text-slate-500">Was this result accurate?</span>
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={() => send('correct')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2BEE34]/10 border border-[#2BEE34]/20 text-[#2BEE34] text-xs font-semibold hover:bg-[#2BEE34]/20 transition-all"
        >
          <ThumbsUp className="w-3.5 h-3.5" /> Yes
        </button>
        <button
          onClick={() => send('incorrect')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF4444]/10 border border-[#FF4444]/20 text-[#FF4444] text-xs font-semibold hover:bg-[#FF4444]/20 transition-all"
        >
          <ThumbsDown className="w-3.5 h-3.5" /> No
        </button>
      </div>
    </div>
  )
}
