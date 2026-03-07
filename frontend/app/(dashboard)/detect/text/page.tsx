'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Send, RotateCcw, AlertTriangle, CheckCircle, HelpCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence } from '@/lib/utils/helpers'

const SAMPLE_AI_TEXT = `Artificial intelligence has revolutionized the way we process and analyze information in modern society. Furthermore, it has enabled unprecedented advances in machine learning algorithms and computational capabilities. Moreover, these systems demonstrate remarkable performance across various benchmarks and metrics. Additionally, the integration of AI technologies into everyday applications has fundamentally transformed human-computer interaction paradigms.`

const SAMPLE_HUMAN_TEXT = `I've been thinking about this for a while now. My grandmother used to say you could tell a lot about a person by how they treat waitstaff. Honestly? She was right. Last week at the diner on Fifth, I watched this guy snap his fingers at our server three times. Three! The look on Maria's face - she's been working there twelve years - just killed me.`

export default function TextDetectionPage() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleDetect = async () => {
    if (!text.trim() || text.length < 50) {
      setError('Please enter at least 50 characters for accurate detection.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/detect/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error?.message || 'Detection failed')
      setResult(data.data)

      // Save to Supabase
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('scans').insert({
          user_id: user.id,
          media_type: 'text',
          content_preview: text.substring(0, 200),
          verdict: data.data.verdict,
          confidence_score: data.data.confidence,
          signals: data.data.signals,
          model_used: data.data.model_used,
          processing_time: data.data.processing_time,
          status: 'complete'
        })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const VerdictIcon = ({ verdict }: { verdict: Verdict }) => {
    if (verdict === 'AI') return <AlertTriangle className="w-8 h-8 text-rose" />
    if (verdict === 'HUMAN') return <CheckCircle className="w-8 h-8 text-emerald" />
    return <HelpCircle className="w-8 h-8 text-amber" />
  }

  const verdictStyles: Record<Verdict, string> = {
    AI: 'border-rose/30 bg-rose/5',
    HUMAN: 'border-emerald/30 bg-emerald/5',
    UNCERTAIN: 'border-amber/30 bg-amber/5',
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-amber" />
          </div>
          Text Detection
        </h1>
        <p className="text-text-muted ml-14">Analyze text for AI-generated patterns, perplexity scoring, and style fingerprinting</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Input Panel */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-text-primary">Input Text</h2>
              <div className="flex gap-2">
                <button onClick={() => setText(SAMPLE_AI_TEXT)} className="text-xs btn-ghost py-1.5 px-3">Sample AI Text</button>
                <button onClick={() => setText(SAMPLE_HUMAN_TEXT)} className="text-xs btn-ghost py-1.5 px-3">Sample Human Text</button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste or type any text here to analyze for AI generation patterns..."
              className="input-field h-64 resize-none font-mono text-sm"
            />
            <div className="flex items-center justify-between mt-3">
              <span className={`text-xs ${text.length < 50 ? 'text-amber' : 'text-text-muted'}`}>
                {text.length} chars {text.length < 50 && '(min 50)'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setText(''); setResult(null); setError(null) }}
                  className="btn-ghost py-2 px-4 text-sm flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Clear
                </button>
                <button
                  onClick={handleDetect}
                  disabled={loading || text.length < 50}
                  className="btn-primary py-2 px-6 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {loading ? 'Analyzing...' : 'Detect'}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="card border-rose/30 bg-rose/5"
            >
              <div className="flex items-center gap-2 text-rose text-sm">
                <AlertTriangle className="w-4 h-4" /> {error}
              </div>
            </motion.div>
          )}
        </div>

        {/* Results Panel */}
        <div>
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="card h-full flex flex-col items-center justify-center py-16 gap-4"
              >
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-2 border-primary/20 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-primary" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-text-primary mb-1">Analyzing text patterns...</p>
                  <p className="text-sm text-text-muted">Checking perplexity, burstiness, style signals</p>
                </div>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Verdict Banner */}
                <div className={`card border ${verdictStyles[result.verdict]}`}>
                  <div className="flex items-center gap-4">
                    <VerdictIcon verdict={result.verdict} />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-2xl font-black text-text-primary">{result.verdict} GENERATED</h3>
                      </div>
                      <p className="text-text-muted text-sm">{result.summary}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black gradient-text">{formatConfidence(result.confidence)}</div>
                      <div className="text-xs text-text-muted">confidence</div>
                    </div>
                  </div>
                  {/* Confidence bar */}
                  <div className="mt-4">
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${result.confidence}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                      />
                    </div>
                  </div>
                </div>

                {/* Signals */}
                <div className="card">
                  <h3 className="font-semibold text-text-primary mb-4">Detection Signals</h3>
                  <div className="space-y-3">
                    {result.signals.map((signal, i) => (
                      <motion.div
                        key={signal.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-center gap-3"
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${signal.flagged ? 'bg-rose' : 'bg-emerald'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-text-secondary truncate">{signal.name}</span>
                            <span className="text-xs text-text-muted ml-2">{signal.weight}%</span>
                          </div>
                          <div className="h-1 bg-border rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${signal.weight}%` }}
                              transition={{ delay: i * 0.08 + 0.3, duration: 0.5 }}
                              className={`h-full rounded-full ${signal.flagged ? 'bg-rose' : 'bg-emerald'}`}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Model info */}
                <div className="card py-3 px-4 flex items-center justify-between">
                  <span className="text-xs text-text-muted">Model</span>
                  <span className="text-xs font-mono text-primary">{result.model_used}</span>
                </div>
              </motion.div>
            )}

            {!result && !loading && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="card h-full flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-20 h-20 rounded-2xl bg-amber/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-amber" />
                </div>
                <h3 className="font-semibold text-text-primary mb-2">Ready to Analyze</h3>
                <p className="text-text-muted text-sm max-w-xs">
                  Enter your text on the left and click Detect to analyze for AI generation patterns
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
