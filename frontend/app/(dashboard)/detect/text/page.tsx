'use client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MobileResultSheet } from '@/components/MobileResultSheet'
import { useState, useRef, useEffect } from 'react'
import { toUserError } from '@/lib/utils/user-errors'
import { FileText, Send, RotateCcw, AlertTriangle, CheckCircle, HelpCircle, Loader2, Copy, Download, ClipboardPaste, Upload, BookOpen, X, Share2, Info, Database } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence, normalizeConfidence } from '@/lib/utils/helpers'
import { incrementGlobalScanCount } from '@/components/SignupGate'
import { ConfidenceRing } from '@/components/ConfidenceRing'
import { verdictConfig } from '@/lib/ui/verdict-config'
import dynamic from 'next/dynamic'
import { TEXT_MAX_CHARS, TEXT_MIN_CHARS, TEXT_WARN_CHARS, PDF_MAX_SIZE_BYTES } from '@/lib/constants'

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

function ResultDetails({
  result, paragraphScores, verdictStyles, verdictColor, displayName, pdfFile, text,
  copyResult, exportReport, copied, onReset,
}: {
  result: DetectionResult
  paragraphScores: { text: string; confidence: number; verdict: string }[]
  verdictStyles: Record<Verdict, string>
  verdictColor: Record<Verdict, string>
  displayName: string | null
  pdfFile: File | null
  text: string
  copyResult: () => void
  exportReport: () => void
  copied: boolean
  onReset: () => void
}) {
  return (
    <div className="space-y-4">
      {/* Verdict Banner */}
      <div className={`card border ${verdictStyles[result.verdict]}`}>
        {displayName && (
          <div className="mb-3 text-xs font-medium text-silver-600">
            Hey <span className="text-white font-semibold">{displayName}</span>, here's what we found
            {pdfFile ? <> for <span className="text-white font-medium">"{pdfFile.name}"</span></> : text.trim() ? <> for your submitted text</> : null}:
          </div>
        )}
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 ${verdictStyles[result.verdict]}`}>
            {result.verdict === 'AI'
              ? <AlertTriangle className="w-5 h-5 sm:w-7 sm:h-7 text-error" />
              : result.verdict === 'HUMAN'
              ? <CheckCircle className="w-5 h-5 sm:w-7 sm:h-7 text-accent" />
              : <HelpCircle className="w-5 h-5 sm:w-7 sm:h-7 text-warning" />}
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
                  : result.verdict === 'HUMAN' ? 'AUTHENTIC' : result.verdict === 'AI' ? 'SYNTHESIZED' : 'UNCERTAIN'}
              </h3>
              <div className="shrink-0">
                <ConfidenceRing
                  confidence={result.confidence <= 1 ? result.confidence * 100 : result.confidence}
                  color={verdictConfig[result.verdict]?.hex ?? verdictConfig.UNCERTAIN.hex}
                  size={64}
                  strokeWidth={6}
                />
              </div>
            </div>
            <p className="text-silver-600 text-xs sm:text-sm leading-relaxed">{result.summary}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-silver-600 mb-1.5">
            <span>Human ←</span>
            <span>→ AI</span>
          </div>
          <div className="h-2.5 bg-surface-elevated rounded-full overflow-hidden relative">
            <div className={`h-full rounded-full ${result.verdict === 'AI' ? 'bg-gradient-to-r from-warning to-error' : result.verdict === 'HUMAN' ? 'bg-gradient-to-r from-accent/50 to-accent' : 'bg-gradient-to-r from-warning/50 to-warning'}`} style={{ width: `${result.confidence <= 1 ? Math.round(result.confidence * 100) : Math.round(result.confidence)}%` }} />
          </div>
        </div>
      </div>

      {/* Signals */}
      <div className="card">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent" />
          Forensic Signals ({result.signals.length})
        </h3>
        <div className="space-y-2.5 max-h-[280px] sm:max-h-none overflow-y-auto sm:overflow-visible pr-0.5 sm:pr-0">
          {result.signals.map((signal, i) => (
            <div key={i} className="p-2.5 sm:p-3 rounded-xl bg-surface/50 border border-silver-300 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${signal.flagged ? 'bg-error' : 'bg-accent'}`} />
                <span className="text-sm text-silver-700 flex-1 font-medium">{signal.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${signal.flagged ? 'bg-error/15 text-error' : 'bg-accent/15 text-accent'}`}>
                  {signal.weight}%
                </span>
              </div>
              <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden ml-5">
                <div className={`h-full rounded-full ${signal.flagged ? 'bg-error' : 'bg-accent'}`} style={{ width: `${Math.round((signal.value ?? signal.weight ?? 0) <= 1 ? (signal.value ?? signal.weight ?? 0) * 100 : (signal.value ?? signal.weight ?? 0))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sentence-level AI probability heatmap */}
      {paragraphScores.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-white mb-1 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-error" />
            Sentence Heatmap
            <span className="text-xs font-normal text-silver-600 ml-1">— red = AI-likely, green = human-likely</span>
          </h3>
          <div className="text-sm text-silver-800 mb-3 leading-8 whitespace-pre-wrap break-words">
            {paragraphScores.map((s, i) => {
              const pct = s.confidence
              const bg =
                pct >= 80 ? 'bg-error/30 text-error' :
                pct >= 60 ? 'bg-warning/20 text-warning' :
                pct >= 40 ? 'bg-yellow-900/20 text-silver-700' :
                            'bg-accent/10 text-accent'
              return (
                <span key={i} title={`${pct}% AI probability`}
                  className={`${bg} rounded-md px-1 py-0.5 cursor-help transition-colors`}>
                  {s.text.trim()}
                </span>
              )
            }).reduce((acc: React.ReactNode[], el, i) => {
              if (i > 0) acc.push(' ')
              acc.push(el)
              return acc
            }, [])}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {[['bg-accent/10 text-accent','< 40% AI'],['bg-yellow-900/20 text-silver-700','40–59%'],['bg-warning/20 text-warning','60–79%'],['bg-error/30 text-error','≥ 80%']].map(([cls, label]) => (
              <span key={label} className={`text-xs px-2 py-0.5 rounded ${cls}`}>{label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Actions footer */}
      <div className="card py-3 px-4 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2">
        <span className="text-xs text-silver-600 font-mono">{result.processing_time}ms</span>
        <div className="flex flex-wrap gap-1.5 w-full xs:w-auto">
          <button onClick={onReset}
            className="flex items-center gap-1.5 text-xs btn-ghost px-3 py-1.5 flex-1 xs:flex-none justify-center">
            <RotateCcw className="w-3.5 h-3.5" /> Attest Another
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
    </div>
  )
}

function TextDetectionPage() {
  const { user: currentUser } = useAuth()
  // Derive first name for personalized messages
  const displayName: string | null =
    currentUser?.displayName?.split(' ')[0] ||
    currentUser?.email?.split('@')[0] ||
    null
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [showMobileResult, setShowMobileResult] = useState(false)
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
  // Module 7.1 Focus Mode: dim everything but the textarea + action bar while typing
  const [focusMode, setFocusMode] = useState(false)

  useEffect(() => {
    if (!focusMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { textareaRef.current?.blur(); setFocusMode(false) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [focusMode])

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const charCount = text.length
  const charLimit = TEXT_MAX_CHARS
  const charColor = charCount > TEXT_WARN_CHARS ? 'text-error' : charCount > 70_000 ? 'text-warning' : 'text-silver-600'
  const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length
  const avgSentLen = avgSentenceLen(text)

  const handlePdfUpload = async (file: File) => {
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }
    if (file.size > PDF_MAX_SIZE_BYTES) {
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
      setResult(payload); setShowMobileResult(true)
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
      setError('Please enter at least 50 characters for accurate attestation.')
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
      setResult(data.result); setShowMobileResult(true)
      setScanId(data.scan_id ?? null)
      if (data.graph_context) setGraphContext(data.graph_context)
      // FIX B.6: Map sentence_scores from hf-analyze into paragraphScores for heatmap
      if (data.result?.sentence_scores?.length) {
        setParagraphScores(
          data.result.sentence_scores.map((s: { text: string; ai_score: number }) => ({
            text:       s.text,
            confidence: Math.round(s.ai_score * 100),
            verdict:    s.ai_score >= 0.55 ? 'AI' : 'HUMAN',
          }))
        )
      }
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
Verdict:    ${result.verdict === 'AI' ? 'SYNTHESIZED' : result.verdict === 'HUMAN' ? 'AUTHENTIC' : 'UNCERTAIN'}
Confidence: ${formatConfidence(result.confidence)}
Summary:    ${result.summary}

Forensic Signals:
${result.signals.map(s => `  • ${s.name} — ${s.weight}% ${s.flagged ? '⚠ flagged' : '✓ clean'}`).join('\n')}

Engine: Aiscern Attestation Engine
Analyzed: ${new Date().toLocaleString()}`
    navigator.clipboard?.writeText(out)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const exportReport = () => {
    if (!result) return
    const blob = new Blob([`Aiscern Text Analysis\n\nVerdict: ${result.verdict}\nConfidence: ${formatConfidence(result.confidence)}\nSummary: ${result.summary}\n\nText analyzed:\n${text}`], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `aiscern-text-analysis-${Date.now()}.txt`; a.click()
  }

  const verdictStyles: Record<Verdict, string> = {
    AI: 'border-error/30 bg-error/5',
    HUMAN: 'border-accent/30 bg-accent/5',
    UNCERTAIN: 'border-warning/30 bg-warning/5',
  }

  const verdictColor: Record<Verdict, string> = {
    AI: 'text-error', HUMAN: 'text-accent', UNCERTAIN: 'text-warning'
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
    {/* Screen reader announcement of analysis results */}
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {result && `Analysis complete. Verdict: ${result.verdict === 'AI' ? 'SYNTHESIZED' : result.verdict === 'HUMAN' ? 'AUTHENTIC' : 'UNCERTAIN'}. Confidence: ${formatConfidence(result.confidence)}.`}
    </div>
    <div className="p-2 sm:p-4 lg:p-8 2xl:p-10 max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto relative">
      {/* Module 7.1 Focus Mode overlay — dims sidebar/header (everything outside this
          page's own stacking context), textarea + action bar stay elevated above it. */}
      {focusMode && (
        <div className="fixed inset-0 z-40 bg-surface-deep/80 transition-opacity duration-300" aria-hidden />
      )}
      <div className={focusMode ? 'relative z-50' : 'relative'}>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-warning" />
          </div>
          Text Attestation
        </h1>
        <p className="text-silver-600 ml-14 text-sm">Perplexity scoring · Burstiness analysis · Style fingerprinting · Neural signal analysis</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Input Panel */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white text-sm">Input Text</h2>
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
              onFocus={() => setFocusMode(true)}
              onBlur={() => setFocusMode(false)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleDetect() } }}
              placeholder="Paste or type any text here to analyze for AI generation patterns…"
              className="input-field min-h-[180px] sm:min-h-[260px] h-56 resize-none font-mono text-sm relative z-50"
            />
            <p className="text-[11px] text-silver-600 mt-1 text-right">⌘ / Ctrl + Enter to analyze</p>

            {/* PDF Upload Zone */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setPdfMode(false)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${!pdfMode ? 'bg-warning/15 text-warning border border-warning/30' : 'text-silver-600 hover:text-silver-700'}`}>
                <FileText className="w-3.5 h-3.5" /> Text Input
              </button>
              <button
                onClick={() => setPdfMode(true)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${pdfMode ? 'bg-accent/10 text-accent border border-accent/20' : 'text-silver-600 hover:text-silver-700'}`}>
                <BookOpen className="w-3.5 h-3.5" /> PDF Upload
              </button>
            </div>

            {pdfMode && (
              <div className="mt-3">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-accent/30','bg-accent/10') }}
                  onDragLeave={e => { e.currentTarget.classList.remove('border-accent/30','bg-accent/10') }}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-accent/30','bg-accent/10')
                    const f = e.dataTransfer.files?.[0]
                    if (f && (f.type === 'application/pdf' || f.name.endsWith('.pdf'))) handlePdfUpload(f)
                    else if (f) setError('Please upload a PDF file.')
                  }}
                  className={`flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl cursor-pointer transition-all mb-3
                    ${pdfFile ? 'border-accent/30 bg-accent/5' : 'border-silver-300 hover:border-accent/30 hover:bg-accent-hover/5'}`}>
                  {pdfLoading ? (
                    <div className="flex flex-col items-center gap-2 w-full px-6">
                      <Loader2 className="w-8 h-8 text-accent animate-spin" />
                      <p className="text-sm font-medium text-white">Extracting text from PDF…</p>
                      <p className="text-xs text-silver-600">Running {pdfFile && pdfFile.size > 1024*1024*5 ? 'multi-page' : ''} analysis — this takes 10–30 seconds</p>
                      <div className="w-full max-w-xs bg-surface rounded-full h-1.5 mt-1 overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{width:'45%'}} />
                      </div>
                    </div>
                  ) : pdfFile ? (
                    <div className="flex flex-col items-center gap-1">
                      <BookOpen className="w-8 h-8 text-accent mb-1" />
                      <p className="text-sm font-semibold text-white">{pdfFile.name}</p>
                      <p className="text-xs text-silver-600">{(pdfFile.size/1024/1024).toFixed(2)} MB · Click to change</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-8 h-8 text-silver-600 mb-1" />
                      <p className="text-sm font-semibold text-white">Drop PDF here or click to browse</p>
                      <p className="text-xs text-silver-600 mt-0.5">Academic papers, essays, reports · Up to 20MB · Multi-page supported</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.target.value = '' }} />
                {pdfFile && !pdfLoading && !result && (
                  <button onClick={() => { setPdfFile(null); setResult(null) }}
                    className="flex items-center gap-1.5 text-xs text-silver-600 hover:text-error transition-colors mb-2">
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
                <div key={label} className="text-center px-2 py-1.5 rounded-lg bg-surface/50 border border-silver-300">
                  <div className="text-sm font-bold text-white">{value}</div>
                  <div className="text-[10px] text-silver-600 leading-tight">{label}</div>
                </div>
              ))}
            </div>

            {/* Char limit warning */}
            {charCount > 70_000 && (
              <div className="mt-2">
                <div className="h-1 bg-surface-elevated rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${charCount > TEXT_WARN_CHARS ? 'bg-error' : 'bg-warning'}`} style={{ width: `${Math.min((charCount / 100_000) * 100, 100)}%` }} />
                </div>
                <p className={`text-xs mt-1 ${charCount > TEXT_WARN_CHARS ? 'text-error' : 'text-warning'}`}>{(TEXT_MAX_CHARS - charCount).toLocaleString()} chars remaining (50k limit — supports full PDFs)</p>
              </div>
            )}
            {/* Progress to minimum */}
            {charCount < 50 && charCount > 0 && (
              <div className="mt-2">
                <div className="h-1 bg-surface-elevated rounded-full overflow-hidden">
                  <div className="h-full bg-warning rounded-full transition-all" style={{ width: `${(charCount / 50) * 100}%` }} />
                </div>
                <p className="text-xs text-warning mt-1">{50 - charCount} more characters needed</p>
              </div>
            )}

            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-silver-600">
                {wordCount > 0 && <span className="text-silver-600">{readingTime(text)}</span>}
                {charCount >= 50 && <span className="ml-2 text-accent/70">✓ Ready to analyze</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setText(''); setResult(null); setError(null) }}
                  className="btn-ghost py-2 px-3 text-sm flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Clear
                </button>
                <button onClick={handleDetect} disabled={loading || charCount < 50}
                  className="btn-primary py-2 px-5 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {loading ? 'Examining…' : 'Attest'}
                </button>
              </div>
            </div>
            <p className="text-xs text-silver-600 mt-2">Ctrl+Enter to analyze</p>
            </>
            )}
          </div>

          {error && (
            <div className="card border-error/30 bg-error/5">
              <div className="flex items-center gap-2 text-error text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="flex-1 min-w-0">
          
            {loading && (
              <div className="card flex flex-col items-center justify-center py-16 gap-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-2 border-accent/20 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-accent" />
                  </div>
                  
                </div>
                <div className="text-center space-y-1">
                  <p className="font-semibold text-white">Analyzing text patterns…</p>
                  <p className="text-sm text-silver-600">Perplexity · Burstiness · Style signals</p>
                  <p className="text-xs text-silver-600">Running 3-model ensemble…</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="hidden lg:block">
                <ResultDetails
                  result={result}
                  paragraphScores={paragraphScores}
                  verdictStyles={verdictStyles}
                  verdictColor={verdictColor}
                  displayName={displayName}
                  pdfFile={pdfFile}
                  text={text}
                  copyResult={copyResult}
                  exportReport={exportReport}
                  copied={copied}
                  onReset={() => { setText(''); setResult(null); setError(null); setPdfFile(null); setPdfMode(false) }}
                />
              </div>
            )}

            {!result && !loading && (
              <div className="card flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-xl bg-warning/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-warning" />
                </div>
                <h3 className="font-semibold text-white mb-2">Ready to Analyze</h3>
                <p className="text-silver-600 text-sm max-w-xs">
                  Enter text on the left and click Attest. Minimum 50 characters for accurate results.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-silver-600 w-full">
                  {['Perplexity scoring', 'Style fingerprinting', 'Burstiness analysis', 'Neural signal analysis'].map(f => (
                    <div key={f} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent/60 shrink-0" />{f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          
        </div>
      </div>
      </div>
    </div>
    <div className="px-4 sm:px-6 lg:px-8 2xl:px-10 max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto pb-6">
      
      {graphContext && (
        <div className="mx-4 mb-4 rounded-xl border border-accent/20 bg-accent/5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-accent/10 bg-accent/5">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-xs font-bold text-accent tracking-wide uppercase">Web Verification</span>
            <span className="ml-auto text-[10px] text-silver-600">Real-time Graph RAG</span>
          </div>
          <pre className="px-4 py-3 text-[11px] text-silver-700 leading-relaxed whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
            {graphContext}
          </pre>
        </div>
      )}

      <LazyReviewSuggestion toolName="Text Attestation" />
      {result && (
        <div className="px-4 pb-4 flex items-center justify-between flex-wrap gap-3">
          <LazyFeedbackBar scanId={scanId} verdict={result.verdict} />
          {scanId && (
            <button onClick={shareResult}
              className="flex items-center gap-1.5 text-xs text-silver-600 hover:text-white transition-colors border border-silver-300 rounded-lg px-3 py-1.5 hover:border-white/[0.12]">
              <Share2 className="w-3 h-3" /> Share result
            </button>
          )}
        </div>
      )}
      {result && (
        <details className="card mt-4 mx-4 mb-4">
          <summary className="cursor-pointer text-sm font-semibold text-silver-700 flex items-center gap-2">
            <Info className="w-4 h-4 text-accent" />
            Forensic Engines &amp; Datasets
          </summary>
          <div className="mt-3 space-y-2 text-xs text-silver-600">
            <p><span className="text-silver-700 font-medium">Engine</span> Aiscern Attestation Engine</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {[
                { name: 'HC3 Dataset', desc: 'Human ChatGPT Comparison Corpus', url: 'https://huggingface.co/datasets/Hello-SimpleAI/HC3' },
                { name: 'AI Text Detection Pile', desc: '500K+ labeled text samples', url: 'https://huggingface.co/datasets/artem9k/ai-text-detection-pile' },
                { name: 'GPT-Wiki-Intro', desc: 'GPT-generated Wikipedia intros', url: 'https://huggingface.co/datasets/aadityaubhat/GPT-wiki-intro' },
                { name: 'RAID Benchmark', desc: 'Robust AI text detection benchmark', url: 'https://huggingface.co/datasets/liamdugan/raid' },
              ].map(d => (
                <a key={d.url} href={d.url} target="_blank" rel="noreferrer"
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-surface transition-colors group">
                  <Database className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-silver-700 font-medium group-hover:text-white transition-colors">{d.name}</p>
                    <p>{d.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
    {/* Mobile results — full parity with the desktop inline panel via ResultDetails,
        so mobile isn't a stripped-down experience and nothing is duplicated. */}
    <MobileResultSheet isOpen={showMobileResult} onClose={() => setShowMobileResult(false)} title="Attestation Result">
      {result && (
        <ResultDetails
          result={result}
          paragraphScores={paragraphScores}
          verdictStyles={verdictStyles}
          verdictColor={verdictColor}
          displayName={displayName}
          pdfFile={pdfFile}
          text={text}
          copyResult={copyResult}
          exportReport={exportReport}
          copied={copied}
          onReset={() => {
            setText(''); setResult(null); setError(null); setPdfFile(null); setPdfMode(false); setShowMobileResult(false)
          }}
        />
      )}
    </MobileResultSheet>
  </>
  )
}
export default function TextDetectionPageWrapper() {
  return <ErrorBoundary><TextDetectionPage /></ErrorBoundary>
}
