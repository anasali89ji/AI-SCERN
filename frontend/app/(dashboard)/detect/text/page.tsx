'use client'
export const dynamic = 'force-dynamic'
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Send, RotateCcw, AlertTriangle, CheckCircle, HelpCircle, Loader2, Copy, Download, ClipboardPaste, Upload, BookOpen, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence } from '@/lib/utils/helpers'
import { ReviewSuggestion } from '@/components/ReviewSuggestion'
import { SignupGate, incrementGlobalScanCount } from '@/components/SignupGate'



const SAMPLE_AI = `Artificial intelligence has revolutionized the way we process and analyze information in modern society. Furthermore, it has enabled unprecedented advances in machine learning algorithms and computational capabilities. Moreover, these systems demonstrate remarkable performance across various benchmarks and metrics. Additionally, the integration of AI technologies into everyday applications has fundamentally transformed human-computer interaction paradigms. The implications of such advancements are multifaceted and warrant careful consideration.`

const SAMPLE_HUMAN = `I've been thinking about this for a while now. My grandmother used to say you could tell a lot about a person by how they treat waitstaff. Honestly? She was right. Last week at the diner on Fifth, I watched this guy snap his fingers at our server three times. Three! The look on Maria's face — she's been working there twelve years — just killed me. I don't know why that stuck with me, but it did.`

function readingTime(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const mins = Math.ceil(words / 200)
  return mins < 1 ? '<1 min read' : `${mins} min read`
}

function avgSentenceLen(text: string) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  if (!sentences.length) return 0
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.round(words / sentences.length)
}

export default function TextDetectionPage() {
  const { user: currentUser } = useAuth()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pasteLoading, setPasteLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfMode, setPdfMode] = useState(false)
  const [paragraphScores, setParagraphScores] = useState<{text:string;confidence:number;verdict:string}[]>([])

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const charCount = text.length
  const charLimit = 100_000
  const charColor = charCount > 90_000 ? 'text-rose' : charCount > 70_000 ? 'text-amber' : 'text-text-muted'
  const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length
  const avgSentLen = avgSentenceLen(text)

  const handlePdfUpload = async (file: File) => {
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('PDF too large (max 20MB)')
      return
    }
    setPdfLoading(true); setPdfFile(file); setError(null); setResult(null); setParagraphScores([])
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/detect/pdf', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || 'PDF analysis failed')
      setResult(data.data)
      if (data.data.paragraph_scores) setParagraphScores(data.data.paragraph_scores)
      incrementGlobalScanCount()
      window.dispatchEvent(new Event('aiscern:scan'))
      window.dispatchEvent(new Event('aiscern:scan'))
      if (currentUser?.uid) {
        await (supabase as any).from('scans').insert({
          user_id: currentUser.uid, media_type: 'text',
          content_preview: `[PDF: ${file.name}]`,
          verdict: data.data.verdict, confidence_score: data.data.confidence,
          model_used: data.data.model_used, processing_time: data.data.processing_time, status: 'complete'
        })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'PDF analysis failed')
    } finally { setPdfLoading(false) }
  }

  const handleDetect = async () => {
    if (!pdfMode && (!text.trim() || text.length < 50)) {
      setError('Please enter at least 50 characters for accurate detection.')
      return
    }
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/detect/text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || 'Detection failed')
      setResult(data.data)
      incrementGlobalScanCount()
      window.dispatchEvent(new Event('aiscern:scan'))
      if (currentUser?.uid) {
        await (supabase as any).from('scans').insert({
          user_id: currentUser.uid, media_type: 'text',
          content_preview: text.substring(0, 200),
          verdict: data.data.verdict, confidence_score: data.data.confidence,
          signals: data.data.signals, model_used: data.data.model_used,
          processing_time: data.data.processing_time, status: 'complete'
        })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  const handlePaste = async () => {
    try {
      setPasteLoading(true)
      const text = await navigator.clipboard.readText()
      setText(text)
    } catch { setError('Clipboard access denied. Please paste manually.') }
    finally { setPasteLoading(false) }
  }

  const copyResult = () => {
    if (!result) return
    const out = `DETECTAI Text Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verdict:    ${result.verdict === 'AI' ? 'AI GENERATED' : result.verdict === 'HUMAN' ? 'HUMAN WRITTEN' : 'UNCERTAIN'}
Confidence: ${Math.round((result.confidence <= 1 ? result.confidence * 100 : result.confidence))}%
Summary:    ${result.summary}

Detection Signals:
${result.signals.map(s => `  • ${s.name} — ${s.weight}% ${s.flagged ? '⚠ flagged' : '✓ clean'}`).join('\n')}

Model: ${result.model_used}
Analyzed: ${new Date().toLocaleString()}`
    navigator.clipboard?.writeText(out)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const exportReport = () => {
    if (!result) return
    const blob = new Blob([`DETECTAI Text Analysis\n\nVerdict: ${result.verdict}\nConfidence: ${result.confidence}%\nSummary: ${result.summary}\n\nText analyzed:\n${text}`], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `detectai-text-analysis-${Date.now()}.txt`; a.click()
  }

  const verdictStyles: Record<Verdict, string> = {
    AI: 'border-rose/30 bg-rose/5',
    HUMAN: 'border-emerald/30 bg-emerald/5',
    UNCERTAIN: 'border-amber/30 bg-amber/5',
  }

  const verdictColor: Record<Verdict, string> = {
    AI: 'text-rose', HUMAN: 'text-emerald', UNCERTAIN: 'text-amber'
  }

  return (
    <>
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-amber" />
          </div>
          Text Detection
        </h1>
        <p className="text-text-muted ml-14 text-sm">Perplexity scoring · Burstiness analysis · Style fingerprinting · Neural signal analysis</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Input Panel */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-text-primary text-sm">Input Text</h2>
              <div className="flex gap-1.5">
                <button onClick={handlePaste} disabled={pasteLoading}
                  className="text-xs btn-ghost py-1.5 px-2.5 flex items-center gap-1.5 disabled:opacity-50">
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Paste
                </button>
                <button onClick={() => setText(SAMPLE_AI)} className="text-xs btn-ghost py-1.5 px-2.5">Sample AI</button>
                <button onClick={() => setText(SAMPLE_HUMAN)} className="text-xs btn-ghost py-1.5 px-2.5">Sample Human</button>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleDetect() } }}
              placeholder="Paste or type any text here to analyze for AI generation patterns…"
              className="input-field h-56 resize-none font-mono text-sm"
            />

            {/* PDF Upload Zone */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setPdfMode(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!pdfMode ? 'bg-amber/15 text-amber border border-amber/30' : 'text-text-muted hover:text-text-secondary'}`}>
                <FileText className="w-3.5 h-3.5" /> Text Input
              </button>
              <button
                onClick={() => setPdfMode(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${pdfMode ? 'bg-primary/15 text-primary border border-primary/30' : 'text-text-muted hover:text-text-secondary'}`}>
                <BookOpen className="w-3.5 h-3.5" /> PDF Upload
              </button>
            </div>

            {pdfMode && (
              <div>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-xl cursor-pointer transition-all mb-3
                    ${pdfFile ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-primary/3'}`}>
                  {pdfLoading ? (
                    <><Loader2 className="w-8 h-8 text-primary animate-spin mb-2" /><p className="text-sm text-text-muted">Extracting & analyzing PDF…</p></>
                  ) : pdfFile ? (
                    <><BookOpen className="w-8 h-8 text-primary mb-2" /><p className="text-sm font-semibold text-text-primary">{pdfFile.name}</p><p className="text-xs text-text-muted mt-1">{(pdfFile.size/1024/1024).toFixed(2)} MB · Click to change</p></>
                  ) : (
                    <><Upload className="w-8 h-8 text-text-muted mb-2" /><p className="text-sm font-semibold text-text-primary">Drop PDF here or click to browse</p><p className="text-xs text-text-muted mt-1">Academic papers, student submissions, reports · Up to 20MB</p></>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f) }} />
                {pdfFile && !pdfLoading && !result && (
                  <button onClick={() => { setPdfFile(null); setResult(null) }}
                    className="flex items-center gap-1.5 text-xs text-text-muted hover:text-rose transition-colors mb-2">
                    <X className="w-3.5 h-3.5" /> Clear PDF
                  </button>
                )}
              </div>
            )}

            {!pdfMode && (
            <>
            {/* Live stats bar */}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { label: 'Characters', value: charCount.toLocaleString() },
                { label: 'Words', value: wordCount.toLocaleString() },
                { label: 'Sentences', value: sentenceCount },
                { label: 'Avg words/sent', value: avgSentLen || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="text-center px-2 py-1.5 rounded-lg bg-surface-active/50 border border-border/50">
                  <div className="text-sm font-bold text-text-primary">{value}</div>
                  <div className="text-[10px] text-text-muted leading-tight">{label}</div>
                </div>
              ))}
            </div>

            {/* Char limit warning */}
            {charCount > 70_000 && (
              <div className="mt-2">
                <div className="h-1 bg-border rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${charCount > 90_000 ? 'bg-rose' : 'bg-amber'}`} style={{ width: `${Math.min((charCount / 100_000) * 100, 100)}%` }} />
                </div>
                <p className={`text-xs mt-1 ${charCount > 90_000 ? 'text-rose' : 'text-amber'}`}>{(100_000 - charCount).toLocaleString()} chars remaining (100k limit)</p>
              </div>
            )}
            {/* Progress to minimum */}
            {charCount < 50 && charCount > 0 && (
              <div className="mt-2">
                <div className="h-1 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-amber rounded-full transition-all" style={{ width: `${(charCount / 50) * 100}%` }} />
                </div>
                <p className="text-xs text-amber mt-1">{50 - charCount} more characters needed</p>
              </div>
            )}

            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-text-muted">
                {wordCount > 0 && <span className="text-text-disabled">{readingTime(text)}</span>}
                {charCount >= 50 && <span className="ml-2 text-emerald/70">✓ Ready to analyze</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setText(''); setResult(null); setError(null) }}
                  className="btn-ghost py-2 px-3 text-sm flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Clear
                </button>
                <button onClick={handleDetect} disabled={loading || charCount < 50}
                  className="btn-primary py-2 px-5 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {loading ? 'Analyzing…' : 'Detect'}
                </button>
              </div>
            </div>
            <p className="text-xs text-text-disabled mt-2">Ctrl+Enter to analyze</p>
            </>
            )}
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="card border-rose/30 bg-rose/5">
              <div className="flex items-center gap-2 text-rose text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            </motion.div>
          )}
        </div>

        {/* Results Panel */}
        <div>
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="card flex flex-col items-center justify-center py-16 gap-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-2 border-primary/20 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-primary" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-semibold text-text-primary">Analyzing text patterns…</p>
                  <p className="text-sm text-text-muted">Perplexity · Burstiness · Style signals</p>
                  <p className="text-xs text-text-disabled animate-pulse">Running 3-model ensemble…</p>
                </div>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Verdict Banner */}
                <div className={`card border ${verdictStyles[result.verdict]}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${verdictStyles[result.verdict]}`}>
                      {result.verdict === 'AI'
                        ? <AlertTriangle className="w-7 h-7 text-rose" />
                        : result.verdict === 'HUMAN'
                        ? <CheckCircle className="w-7 h-7 text-emerald" />
                        : <HelpCircle className="w-7 h-7 text-amber" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-2xl font-black ${verdictColor[result.verdict]} mb-1`}>
                        {result.verdict === 'HUMAN' ? 'HUMAN WRITTEN' : result.verdict === 'AI' ? 'AI GENERATED' : 'UNCERTAIN'}
                      </h3>
                      <p className="text-text-muted text-sm leading-relaxed">{result.summary}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-4xl font-black gradient-text">{formatConfidence(result.confidence)}</div>
                      <div className="text-xs text-text-muted">confidence</div>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-text-muted mb-1.5">
                      <span>Human ←</span>
                      <span>→ AI</span>
                    </div>
                    <div className="h-2.5 bg-border rounded-full overflow-hidden relative">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${result.verdict === 'AI' ? 'bg-gradient-to-r from-amber to-rose' : result.verdict === 'HUMAN' ? 'bg-gradient-to-r from-emerald/50 to-emerald' : 'bg-gradient-to-r from-amber/50 to-amber'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Signals */}
                <div className="card">
                  <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    Detection Signals ({result.signals.length})
                  </h3>
                  <div className="space-y-3">
                    {result.signals.map((signal, i) => (
                      <motion.div key={signal.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="p-3 rounded-xl bg-surface-active/50 border border-border/50">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${signal.flagged ? 'bg-rose' : 'bg-emerald'}`} />
                          <span className="text-sm text-text-secondary flex-1 font-medium">{signal.name}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${signal.flagged ? 'bg-rose/15 text-rose' : 'bg-emerald/15 text-emerald'}`}>
                            {signal.weight}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden ml-5">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${signal.weight}%` }}
                            transition={{ delay: i * 0.08 + 0.3, duration: 0.5 }}
                            className={`h-full rounded-full ${signal.flagged ? 'bg-rose' : 'bg-emerald'}`}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Paragraph-level scores */}
                {paragraphScores.length > 0 && (
                  <div className="card">
                    <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-rose" />
                      Top AI-Probable Paragraphs
                    </h3>
                    <div className="space-y-3">
                      {paragraphScores.map((p, i) => (
                        <div key={i} className={`p-3 rounded-xl border text-xs ${p.verdict === 'AI' ? 'border-rose/20 bg-rose/5' : 'border-border/50 bg-surface-active/30'}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${p.verdict === 'AI' ? 'bg-rose/15 text-rose' : 'bg-emerald/15 text-emerald'}`}>{p.confidence}% AI</span>
                          </div>
                          <p className="text-text-muted leading-relaxed line-clamp-3">{p.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Actions footer */}
                <div className="card py-3 px-4 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs text-text-muted font-mono truncate">{result.model_used} · {result.processing_time}ms</span>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={copyResult}
                      className="text-xs btn-ghost py-1.5 px-3 flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={exportReport}
                      className="text-xs btn-ghost py-1.5 px-3 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5" />
                      Export
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {!result && !loading && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="card flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-2xl bg-amber/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-amber" />
                </div>
                <h3 className="font-semibold text-text-primary mb-2">Ready to Analyze</h3>
                <p className="text-text-muted text-sm max-w-xs">
                  Enter text on the left and click Detect. Minimum 50 characters for accurate results.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-text-muted w-full max-w-xs">
                  {['Perplexity scoring', 'Style fingerprinting', 'Burstiness analysis', 'Neural signal analysis'].map(f => (
                    <div key={f} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-active/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />{f}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
    <div className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto pb-6">
      
      <ReviewSuggestion toolName="AI Text Detector" />
    </div>
  </>
  )
}