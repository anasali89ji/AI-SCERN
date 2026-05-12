'use client'
import { useState, useRef } from 'react'
import { toUserError } from '@/lib/utils/user-errors'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Send, RotateCcw, AlertTriangle, CheckCircle, HelpCircle, Loader2, Copy, Download, ClipboardPaste, Upload, BookOpen, X, Share2, Info, Database } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence } from '@/lib/utils/helpers'
import { incrementGlobalScanCount } from '@/components/SignupGate'
import dynamic from 'next/dynamic'

// ── Post-scan components — loaded only after a result arrives ─────────────────
const LazyReviewSuggestion = dynamic(
  () => import('@/components/ReviewSuggestion').then(m => ({ default: m.ReviewSuggestion })),
  { ssr: false }
)
const LazyFeedbackBar = dynamic(
  () => import('@/components/FeedbackBar').then(m => ({ default: m.FeedbackBar })),
  { ssr: false }
)



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
  // Derive first name for personalized messages
  const displayName: string | null =
    currentUser?.displayName?.split(' ')[0] ||
    currentUser?.email?.split('@')[0] ||
    null
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [graphContext, setGraphContext] = useState<string | null>(null)
  const [pasteLoading, setPasteLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfMode, setPdfMode] = useState(false)
  const [paragraphScores, setParagraphScores] = useState<{text:string;confidence:number;verdict:string}[]>([])
  const [scanId, setScanId] = useState<string | null>(null)

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const charCount = text.length
  const charLimit = 50_000
  const charColor = charCount > 45_000 ? 'text-rose' : charCount > 70_000 ? 'text-amber' : 'text-text-muted'
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
      if (!data.success) throw new Error(toUserError(data.error?.code, data.error?.message))
      // PDF API returns { success, data: {...} }; text API returns { success, result: {...} }
      const payload = data.data ?? data.result
      setResult(payload)
      setScanId(data.scan_id ?? null)
      if (payload?.paragraph_scores) setParagraphScores(payload.paragraph_scores)
      incrementGlobalScanCount()
      window.dispatchEvent(new Event('aiscern:scan'))
      window.dispatchEvent(new CustomEvent('aiscern:scan-saved'))
    } catch (err: unknown) {
      setError(err instanceof Error ? toUserError(undefined, err.message) : toUserError())
    } finally { setPdfLoading(false) }
  }

  const handleDetect = async () => {
    if (!pdfMode && (!text.trim() || text.length < 50)) {
      setError('Please enter at least 50 characters for accurate detection.')
      return
    }
    setLoading(true); setError(null); setResult(null); setGraphContext(null)
    try {
      const res = await fetch('/api/detect/text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(toUserError(data.error?.code, data.error?.message))
      setResult(data.result)
      setScanId(data.scan_id ?? null)
      if (data.graph_context) setGraphContext(data.graph_context)
      incrementGlobalScanCount()
      window.dispatchEvent(new Event('aiscern:scan'))
      window.dispatchEvent(new CustomEvent('aiscern:scan-saved'))
    } catch (err: unknown) {
      setError(err instanceof Error ? toUserError(undefined, err.message) : toUserError())
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
    const out = `Aiscern Text Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verdict:    ${result.verdict === 'AI' ? 'AI GENERATED' : result.verdict === 'HUMAN' ? 'HUMAN WRITTEN' : 'UNCERTAIN'}
Confidence: ${Math.round((result.confidence <= 1 ? result.confidence * 100 : result.confidence))}%
Summary:    ${result.summary}

Detection Signals:
${result.signals.map(s => `  • ${s.name} — ${s.weight}% ${s.flagged ? '⚠ flagged' : '✓ clean'}`).join('\n')}

Engine: Aiscern Detection Engine
Analyzed: ${new Date().toLocaleString()}`
    navigator.clipboard?.writeText(out)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const exportReport = () => {
    if (!result) return
    const blob = new Blob([`Aiscern Text Analysis\n\nVerdict: ${result.verdict}\nConfidence: ${result.confidence}%\nSummary: ${result.summary}\n\nText analyzed:\n${text}`], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `aiscern-text-analysis-${Date.now()}.txt`; a.click()
  }

  const verdictStyles: Record<Verdict, string> = {
    AI: 'border-rose/30 bg-rose/5',
    HUMAN: 'border-emerald/30 bg-emerald/5',
    UNCERTAIN: 'border-amber/30 bg-amber/5',
  }

  const verdictColor: Record<Verdict, string> = {
    AI: 'text-rose', HUMAN: 'text-emerald', UNCERTAIN: 'text-amber'
  }

  const shareResult = async () => {
    if (!scanId) return
    try {
      await fetch(`/api/scan/${scanId}/share`, { method: 'POST' })
      await navigator.clipboard.writeText(`${window.location.origin}/scan/${scanId}`)
      alert('Share link copied to clipboard!')
    } catch { alert('Could not copy link. Try again.') }
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
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleDetect() } }}
              placeholder="Paste or type any text here to analyze for AI generation patterns…"
              className="input-field min-h-[180px] sm:min-h-[260px] h-56 resize-none font-mono text-sm"
            />
            <p className="text-[11px] text-text-disabled mt-1 text-right">⌘ / Ctrl + Enter to analyze</p>

            {/* PDF Upload Zone */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setPdfMode(false)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${!pdfMode ? 'bg-amber/15 text-amber border border-amber/30' : 'text-text-muted hover:text-text-secondary'}`}>
                <FileText className="w-3.5 h-3.5" /> Text Input
              </button>
              <button
                onClick={() => setPdfMode(true)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${pdfMode ? 'bg-primary/15 text-primary border border-primary/30' : 'text-text-muted hover:text-text-secondary'}`}>
                <BookOpen className="w-3.5 h-3.5" /> PDF Upload
              </button>
            </div>

            {pdfMode && (
              <div>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary/60','bg-primary/8') }}
                  onDragLeave={e => { e.currentTarget.classList.remove('border-primary/60','bg-primary/8') }}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-primary/60','bg-primary/8')
                    const f = e.dataTransfer.files?.[0]
                    if (f && (f.type === 'application/pdf' || f.name.endsWith('.pdf'))) handlePdfUpload(f)
                    else if (f) setError('Please upload a PDF file.')
                  }}
                  className={`flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl cursor-pointer transition-all mb-3
                    ${pdfFile ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-primary/5'}`}>
                  {pdfLoading ? (
                    <div className="flex flex-col items-center gap-2 w-full px-6">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-sm font-medium text-text-primary">Extracting text from PDF…</p>
                      <p className="text-xs text-text-muted">Running {pdfFile && pdfFile.size > 1024*1024*5 ? 'multi-page' : ''} analysis — this takes 10–30 seconds</p>
                      <div className="w-full max-w-xs bg-surface-active rounded-full h-1.5 mt-1 overflow-hidden">
                        <div className="h-full bg-primary rounded-full animate-pulse" style={{width:'60%'}} />
                      </div>
                    </div>
                  ) : pdfFile ? (
                    <div className="flex flex-col items-center gap-1">
                      <BookOpen className="w-8 h-8 text-primary mb-1" />
                      <p className="text-sm font-semibold text-text-primary">{pdfFile.name}</p>
                      <p className="text-xs text-text-muted">{(pdfFile.size/1024/1024).toFixed(2)} MB · Click to change</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-8 h-8 text-text-muted mb-1" />
                      <p className="text-sm font-semibold text-text-primary">Drop PDF here or click to browse</p>
                      <p className="text-xs text-text-muted mt-0.5">Academic papers, essays, reports · Up to 20MB · Multi-page supported</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.target.value = '' }} />
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
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  <div className={`h-full rounded-full transition-all ${charCount > 45_000 ? 'bg-rose' : 'bg-amber'}`} style={{ width: `${Math.min((charCount / 100_000) * 100, 100)}%` }} />
                </div>
                <p className={`text-xs mt-1 ${charCount > 45_000 ? 'text-rose' : 'text-amber'}`}>{(50_000 - charCount).toLocaleString()} chars remaining (50k limit — supports full PDFs)</p>
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
                  {/* Personalized greeting */}
                  {displayName && (
                    <div className="mb-3 text-xs font-medium text-text-muted">
                      Hey <span className="text-text-primary font-semibold">{displayName}</span>, here's what we found
                      {pdfFile ? <> for <span className="text-text-primary font-medium">"{pdfFile.name}"</span></> : text.trim() ? <> for your submitted text</> : null}:
                    </div>
                  )}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 ${verdictStyles[result.verdict]}`}>
                      {result.verdict === 'AI'
                        ? <AlertTriangle className="w-5 h-5 sm:w-7 sm:h-7 text-rose" />
                        : result.verdict === 'HUMAN'
                        ? <CheckCircle className="w-5 h-5 sm:w-7 sm:h-7 text-emerald" />
                        : <HelpCircle className="w-5 h-5 sm:w-7 sm:h-7 text-amber" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1 min-w-0">
                        <h3 className={`text-base sm:text-2xl font-black ${verdictColor[result.verdict]} leading-tight shrink min-w-0`}>
                          {displayName
                            ? result.verdict === 'AI'
                              ? `${displayName}, this is AI Generated`
                              : result.verdict === 'HUMAN'
                              ? `${displayName}, this is Human Written`
                              : `${displayName}, this is Uncertain`
                            : result.verdict === 'HUMAN' ? 'HUMAN WRITTEN' : result.verdict === 'AI' ? 'AI GENERATED' : 'UNCERTAIN'}
                        </h3>
                        <div className="text-right shrink-0">
                          <div className="text-2xl sm:text-4xl font-black gradient-text tabular-nums">{formatConfidence(result.confidence)}</div>
                          <div className="text-[10px] sm:text-xs text-text-muted">confidence</div>
                        </div>
                      </div>
                      <p className="text-text-muted text-xs sm:text-sm leading-relaxed">{result.summary}</p>
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
                  <div className="space-y-2.5 max-h-[280px] sm:max-h-none overflow-y-auto sm:overflow-visible pr-0.5 sm:pr-0">
                    {result.signals.map((signal, i) => (
                      <motion.div key={signal.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, ease: 'easeOut' }}
                        className="p-2.5 sm:p-3 rounded-xl bg-surface-active/50 border border-border/50 min-w-0">
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
                <div className="card py-3 px-4 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2">
                  <span className="text-xs text-text-muted font-mono">{result.processing_time}ms</span>
                  <div className="flex flex-wrap gap-1.5 w-full xs:w-auto">
                    <button onClick={() => { setText(''); setResult(null); setError(null); setPdfFile(null); setPdfMode(false) }}
                      className="flex items-center gap-1.5 text-xs btn-ghost px-3 py-1.5 flex-1 xs:flex-none justify-center">
                      <RotateCcw className="w-3.5 h-3.5" /> Detect Another
                    </button>
                    <button onClick={copyResult}
                      className="text-xs btn-ghost py-1.5 px-3 flex items-center gap-1.5 flex-1 xs:flex-none justify-center">
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={exportReport}
                      className="text-xs btn-ghost py-1.5 px-3 flex items-center gap-1.5 flex-1 xs:flex-none justify-center">
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
      
      {graphContext && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mx-4 mb-4 rounded-xl border border-cyan/20 bg-cyan/5 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-cyan/10 bg-cyan/5">
            <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
            <span className="text-xs font-bold text-cyan tracking-wide uppercase">Web Verification</span>
            <span className="ml-auto text-[10px] text-text-muted">Real-time Graph RAG</span>
          </div>
          <pre className="px-4 py-3 text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
            {graphContext}
          </pre>
        </motion.div>
      )}

      <LazyReviewSuggestion toolName="AI Text Detector" />
      {result && (
        <div className="px-4 pb-4 flex items-center justify-between flex-wrap gap-3">
          <LazyFeedbackBar scanId={scanId} verdict={result.verdict} />
          {scanId && (
            <button onClick={shareResult}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors border border-border/50 rounded-lg px-3 py-1.5 hover:border-primary/30">
              <Share2 className="w-3 h-3" /> Share result
            </button>
          )}
        </div>
      )}
      {result && (
        <details className="card mt-4 mx-4 mb-4">
          <summary className="cursor-pointer text-sm font-semibold text-text-secondary flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Detection Models &amp; Datasets
          </summary>
          <div className="mt-3 space-y-2 text-xs text-text-muted">
            <p><span className="text-text-secondary font-medium">Engine</span> Aiscern Detection Engine</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {[
                { name: 'HC3 Dataset', desc: 'Human ChatGPT Comparison Corpus', url: 'https://huggingface.co/datasets/Hello-SimpleAI/HC3' },
                { name: 'AI Text Detection Pile', desc: '500K+ labeled text samples', url: 'https://huggingface.co/datasets/artem9k/ai-text-detection-pile' },
                { name: 'GPT-Wiki-Intro', desc: 'GPT-generated Wikipedia intros', url: 'https://huggingface.co/datasets/aadityaubhat/GPT-wiki-intro' },
                { name: 'RAID Benchmark', desc: 'Robust AI text detection benchmark', url: 'https://huggingface.co/datasets/liamdugan/raid' },
              ].map(d => (
                <a key={d.url} href={d.url} target="_blank" rel="noreferrer"
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-surface-active transition-colors group">
                  <Database className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-text-secondary font-medium group-hover:text-primary transition-colors">{d.name}</p>
                    <p>{d.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  </>
  )
}