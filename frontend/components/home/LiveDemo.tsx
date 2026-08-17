'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatVerdictConfidence } from '@/lib/utils/helpers'
import {
  Brain, Loader2, XCircle, CheckCircle, HelpCircle, ArrowRight,
} from 'lucide-react'

export function LiveDemo({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const analyze = async () => {
    if (text.length < 50) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/detect/text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, user_id: null }),
      })
      if (res.status === 401) { router.push('/signup'); setLoading(false); return }
      const d = await res.json()
      if (d.success) { setResult(d.result) }
      else setResult({ verdict: 'UNCERTAIN', summary: d.error?.message || 'Try signing in for full results.' })
    } catch { setResult({ verdict: 'UNCERTAIN', summary: 'Analysis unavailable. Sign in for full access.' }) }
    setLoading(false)
  }
  const examples = [
    { label: 'AI text',    text: 'The intersection of artificial intelligence and human creativity presents a fascinating paradox in contemporary discourse. As machine learning models become increasingly sophisticated in generating coherent, contextually appropriate text, the boundaries between human and algorithmic authorship continue to blur in unprecedented ways.' },
    { label: 'Human text', text: "I spent all weekend trying to fix my leaky faucet and honestly I have no idea what I'm doing. Watched like 6 YouTube videos and still made it worse. Water is now shooting sideways. My neighbor thinks it's hilarious. Calling a plumber tomorrow. RIP my bank account." },
  ]
  return (
    <div className="relative">
      <div className="rounded-2xl border border-primary/20 bg-surface p-4 sm:p-5 shadow-2xl shadow-primary/5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald" />
            </span>
            <span className="text-sm font-bold text-text-primary">Live AI Verification</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald/10 text-emerald font-semibold border border-emerald/20">Free</span>
          </div>
          <div className="flex gap-2">
            {examples.map(ex => (
              <button key={ex.label} onClick={() => setText(ex.text)}
                className="text-xs px-2.5 py-1 rounded-lg border border-border hover:border-primary/40 text-text-muted hover:text-primary transition-all min-h-0">
                {ex.label}
              </button>
            ))}
          </div>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste any text to verify if it's AI-generated… (min 50 characters)"
          className="w-full min-w-0 h-24 sm:h-28 bg-background/80 border border-border rounded-xl px-3 sm:px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all" />
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <span className="text-xs text-text-muted">{text.length} chars {text.length < 50 ? `· need ${50 - text.length} more` : '· ready ✓'}</span>
          <button onClick={analyze} disabled={loading || text.length < 50}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-40 flex items-center gap-2 min-h-[36px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {loading ? 'Scanning…' : 'Verify Content'}
          </button>
        </div>
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
              <div className={`rounded-xl border p-4 ${result.verdict === 'AI' ? 'bg-rose/5 border-rose/20' : result.verdict === 'HUMAN' ? 'bg-emerald/5 border-emerald/20' : 'bg-amber/5 border-amber/20'}`}>
                <div className="flex items-center justify-between mb-3 gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {result.verdict === 'AI' ? <XCircle className="w-5 h-5 text-rose shrink-0" /> : result.verdict === 'HUMAN' ? <CheckCircle className="w-5 h-5 text-emerald shrink-0" /> : <HelpCircle className="w-5 h-5 text-amber shrink-0" />}
                    <span className={`font-bold text-base leading-tight ${result.verdict === 'AI' ? 'text-rose' : result.verdict === 'HUMAN' ? 'text-emerald' : 'text-amber'}`}>
                      {result.verdict === 'AI' ? 'AI Generated' : result.verdict === 'HUMAN' ? 'Human Written' : 'Uncertain'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-text-primary tabular-nums">{formatVerdictConfidence(result.confidence || 0, result.verdict)}</div>
                    <div className="text-[10px] text-text-muted">confidence</div>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-background overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence <= 1 ? result.confidence * 100 : result.confidence}%` }}
                    transition={{ duration: 1.0, ease: 'easeOut' }}
                    className={`h-full rounded-full ${result.verdict === 'AI' ? 'bg-gradient-to-r from-rose to-pink-400' : result.verdict === 'HUMAN' ? 'bg-gradient-to-r from-emerald to-teal-400' : 'bg-gradient-to-r from-amber to-yellow-400'}`} />
                </div>
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-text-muted">✓ Free · Sign in to save trust verification reports</p>
                  <Link href="/detect/text" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                    Full AI text verification <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
