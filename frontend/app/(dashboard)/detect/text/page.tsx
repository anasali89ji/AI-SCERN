'use client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MobileResultSheet } from '@/components/MobileResultSheet'
import { useState, useRef } from 'react'
import { toUserError } from '@/lib/utils/user-errors'
import { FileText, Send, RotateCcw, AlertTriangle, CheckCircle, HelpCircle, Loader2, Copy, Download, ClipboardPaste, Upload, BookOpen, X, Share2, Info, Database } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence, normalizeConfidence } from '@/lib/utils/helpers'
import { incrementGlobalScanCount } from '@/components/SignupGate'
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

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const charCount = text.length
  const charLimit = TEXT_MAX_CHARS
  const charColor = charCount > TEXT_WARN_CHARS ? 'text-[#FF4444]' : charCount > 70_000 ? 'text-[#FFB800]' : 'text-[#6B6B6B]'
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
Verdict:    ${result.verdict === 'AI' ? 'AI GENERATED' : result.verdict === 'HUMAN' ? 'HUMAN WRITTEN' : 'UNCERTAIN'}
Confidence: ${formatConfidence(result.confidence)}
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
    const blob = new Blob([`Aiscern Text Analysis\n\nVerdict: ${result.verdict}\nConfidence: ${formatConfidence(result.confidence)}\nSummary: ${result.summary}\n\nText analyzed:\n${text}`], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `aiscern-text-analysis-${Date.now()}.txt`; a.click()
  }

  const verdictStyles: Record<Verdict, string> = {
    AI: 'border-[#FF4444]/30 bg-[#FF4444]/5',
    HUMAN: 'border-[#2BEE34]/30 bg-[#2BEE34]/5',
    UNCERTAIN: 'border-[#FFB800]/30 bg-[#FFB800]/5',
  }

  const verdictColor: Record<Verdict, string> = {
    AI: 'text-[#FF4444]', HUMAN: 'text-[#2BEE34]', UNCERTAIN: 'text-[#FFB800]'
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
      {result && `Analysis complete. Verdict: ${result.verdict === 'AI' ? 'AI GENERATED' : result.verdict === 'HUMAN' ? 'HUMAN WRITTEN' : 'UNCERTAIN'}. Confidence: ${formatConfidence(result.confidence)}.`}
    </div>
    <div className="p-2 sm:p-4 lg:p-8 2xl:p-10 max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFB800]/10 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-[#FFB800]" />
          </div>
          Text Detection
        </h1>
        <p className="text-[#6B6B6B] ml-14 text-sm">Perplexity scoring · Burstiness analysis · Style fingerprinting · Neural signal analysis</p>
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
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleDetect() } }}
              placeholder="Paste or type any text here to analyze for AI generation patterns…"
              className="input-field min-h-[180px] sm:min-h-[260px] h-56 resize-none font-mono text-sm"
            />
            <p className="text-[11px] text-[#6B6B6B] mt-1 text-right">⌘ / Ctrl + Enter to analyze</p>

            {/* PDF Upload Zone */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setPdfMode(false)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${!pdfMode ? 'bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/30' : 'text-[#6B6B6B] hover:text-[#A3A3A3]'}`}>
                <FileText className="w-3.5 h-3.5" /> Text Input
              </button>
              <button
                onClick={() => setPdfMode(true)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${pdfMode ? 'bg-[#2BEE34]/10 text-[#2BEE34] border border-[#2BEE34]/20' : 'text-[#6B6B6B] hover:text-[#A3A3A3]'}`}>
                <BookOpen className="w-3.5 h-3.5" /> PDF Upload
              </button>
            </div>

            {pdfMode && (
              <div>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-[#2BEE34]/30','bg-[#2BEE34]/10') }}
                  onDragLeave={e => { e.currentTarget.classList.remove('border-[#2BEE34]/30','bg-[#2BEE34]/10') }}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-[#2BEE34]/30','bg-[#2BEE34]/10')
                    const f = e.dataTransfer.files?.[0]
                    if (f && (f.type === 'application/pdf' || f.name.endsWith('.pdf'))) handlePdfUpload(f)
                    else if (f) setError('Please upload a PDF file.')
                  }}
                  className={`flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl cursor-pointer transition-all mb-3
                    ${pdfFile ? 'border-[#2BEE34]/30 bg-[#2BEE34]/5' : 'border-[#1E1E1E] hover:border-[#2BEE34]/30 hover:bg-[#1A8F1F]/5'}`}>
                  {pdfLoading ? (
                    <div className="flex flex-col items-center gap-2 w-full px-6">
                      <Loader2 className="w-8 h-8 text-[#2BEE34] animate-spin" />
                      <p className="text-sm font-medium text-white">Extracting text from PDF…</p>
                      <p className="text-xs text-[#6B6B6B]">Running {pdfFile && pdfFile.size > 1024*1024*5 ? 'multi-page' : ''} analysis — this takes 10–30 seconds</p>
                      <div className="w-full max-w-xs bg-[#141414] rounded-full h-1.5 mt-1 overflow-hidden">
                        <div className="h-full bg-[#2BEE34] rounded-full" style={{width:'45%'}} />
                      </div>
                    </div>
                  ) : pdfFile ? (
                    <div className="flex flex-col items-center gap-1">
                      <BookOpen className="w-8 h-8 text-[#2BEE34] mb-1" />
                      <p className="text-sm font-semibold text-white">{pdfFile.name}</p>
                      <p className="text-xs text-[#6B6B6B]">{(pdfFile.size/1024/1024).toFixed(2)} MB · Click to change</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-8 h-8 text-[#6B6B6B] mb-1" />
                      <p className="text-sm font-semibold text-white">Drop PDF here or click to browse</p>
                      <p className="text-xs text-[#6B6B6B] mt-0.5">Academic papers, essays, reports · Up to 20MB · Multi-page supported</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.target.value = '' }} />
                {pdfFile && !pdfLoading && !result && (
                  <button onClick={() => { setPdfFile(null); setResult(null) }}
                    className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#FF4444] transition-colors mb-2">
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
                <div key={label} className="text-center px-2 py-1.5 rounded-lg bg-[#141414]/50 border border-[#1E1E1E]">
                  <div className="text-sm font-bold text-white">{value}</div>
                  <div className="text-[10px] text-[#6B6B6B] leading-tight">{label}</div>
                </div>
              ))}
            </div>

            {/* Char limit warning */}
            {charCount > 70_000 && (
              <div className="mt-2">
                <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${charCount > TEXT_WARN_CHARS ? 'bg-[#FF4444]' : 'bg-[#FFB800]'}`} style={{ width: `${Math.min((charCount / 100_000) * 100, 100)}%` }} />
                </div>
                <p className={`text-xs mt-1 ${charCount > TEXT_WARN_CHARS ? 'text-[#FF4444]' : 'text-[#FFB800]'}`}>{(TEXT_MAX_CHARS - charCount).toLocaleString()} chars remaining (50k limit — supports full PDFs)</p>
              </div>
            )}
            {/* Progress to minimum */}
            {charCount < 50 && charCount > 0 && (
              <div className="mt-2">
                <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div className="h-full bg-[#FFB800] rounded-full transition-all" style={{ width: `${(charCount / 50) * 100}%` }} />
                </div>
                <p className="text-xs text-[#FFB800] mt-1">{50 - charCount} more characters needed</p>
              </div>
            )}

            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-[#6B6B6B]">
                {wordCount > 0 && <span className="text-[#6B6B6B]">{readingTime(text)}</span>}
                {charCount >= 50 && <span className="ml-2 text-[#2BEE34]/70">✓ Ready to analyze</span>}
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
            <p className="text-xs text-[#6B6B6B] mt-2">Ctrl+Enter to analyze</p>
            </>
            )}
          </div>

          {error && (
            <div className="card border-[#FF4444]/30 bg-[#FF4444]/5">
              <div className="flex items-center gap-2 text-[#FF4444] text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div>
          
            {loading && (
              <div className="card flex flex-col items-center justify-center py-16 gap-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-2 border-[#2BEE34]/20 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-[#2BEE34]" />
                  </div>
                  
                </div>
                <div className="text-center space-y-1">
                  <p className="font-semibold text-white">Analyzing text patterns…</p>
                  <p className="text-sm text-[#6B6B6B]">Perplexity · Burstiness · Style signals</p>
                  <p className="text-xs text-[#6B6B6B]">Running 3-model ensemble…</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-4">
                {/* Verdict Banner */}
                <div className={`card border ${verdictStyles[result.verdict]}`}>
                  {/* Personalized greeting */}
                  {displayName && (
                    <div className="mb-3 text-xs font-medium text-[#6B6B6B]">
                      Hey <span className="text-white font-semibold">{displayName}</span>, here's what we found
                      {pdfFile ? <> for <span className="text-white font-medium">"{pdfFile.name}"</span></> : text.trim() ? <> for your submitted text</> : null}:
                    </div>
                  )}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 ${verdictStyles[result.verdict]}`}>
                      {result.verdict === 'AI'
                        ? <AlertTriangle className="w-5 h-5 sm:w-7 sm:h-7 text-[#FF4444]" />
                        : result.verdict === 'HUMAN'
                        ? <CheckCircle className="w-5 h-5 sm:w-7 sm:h-7 text-[#2BEE34]" />
                        : <HelpCircle className="w-5 h-5 sm:w-7 sm:h-7 text-[#FFB800]" />}
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
                          <div className="text-2xl sm:text-4xl font-black text-[#2BEE34] tabular-nums">{formatConfidence(result.confidence)}</div>
                          <div className="text-[10px] sm:text-xs text-[#6B6B6B]">confidence</div>
                        </div>
                      </div>
                      <p className="text-[#6B6B6B] text-xs sm:text-sm leading-relaxed">{result.summary}</p>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-[#6B6B6B] mb-1.5">
                      <span>Human ←</span>
                      <span>→ AI</span>
                    </div>
                    <div className="h-2.5 bg-[#1A1A1A] rounded-full overflow-hidden relative">
                      <div className={`h-full rounded-full ${result.verdict === 'AI' ? 'bg-gradient-to-r from-[#FFB800] to-[#FF4444]' : result.verdict === 'HUMAN' ? 'bg-gradient-to-r from-[#2BEE34]/50 to-[#2BEE34]' : 'bg-gradient-to-r from-[#FFB800]/50 to-[#FFB800]'}>
                    </div>
                  </div>
                </div>

                {/* Signals */}
                <div className="card">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#2BEE34]" />
                    Detection Signals ({result.signals.length})
                  </h3>
                  <div className="space-y-2.5 max-h-[280px] sm:max-h-none overflow-y-auto sm:overflow-visible pr-0.5 sm:pr-0">
                    {result.signals.map((signal, i) => (
                      <div className="p-2.5 sm:p-3 rounded-xl bg-[#141414]/50 border border-[#1E1E1E] min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${signal.flagged ? 'bg-[#FF4444]' : 'bg-[#2BEE34]'}`} />
                          <span className="text-sm text-[#A3A3A3] flex-1 font-medium">{signal.name}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${signal.flagged ? 'bg-[#FF4444]/15 text-[#FF4444]' : 'bg-[#2BEE34]/15 text-[#2BEE34]'}`}>
                            {signal.weight}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden ml-5">
                          <div className={`h-full rounded-full ${signal.flagged ? 'bg-[#FF4444]' : 'bg-[#2BEE34]'}>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FIX B.6: Sentence-level AI probability heatmap */}
                {paragraphScores.length > 0 && (
                  <div className="card">
                    <h3 className="font-semibold text-white mb-1 flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-[#FF4444]" />
                      Sentence Heatmap
                      <span className="text-xs font-normal text-[#6B6B6B] ml-1">— red = AI-likely, green = human-likely</span>
                    </h3>
                    <p className="text-xs text-[#6B6B6B] mb-3 leading-relaxed">
                      {paragraphScores.map((s, i) => {
                        const pct = s.confidence
                        const bg =
                          pct >= 80 ? 'bg-[#FF4444]/30 text-[#FF4444]' :
                          pct >= 60 ? 'bg-[#FFB800]/20 text-[#FFB800]' :
                          pct >= 40 ? 'bg-yellow-900/20 text-[#A3A3A3]' :
                                      'bg-[#2BEE34]/10 text-[#2BEE34]'
                        return (
                          <span key={i} title={`${pct}% AI probability`}
                            className={`${bg} rounded px-0.5 mr-0.5 cursor-help transition-colors`}>
                            {s.text}
                          </span>
                        )
                      })}
                    </p>
                    {/* Legend */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {[['bg-[#2BEE34]/10 text-[#2BEE34]','< 40% AI'],['bg-yellow-900/20 text-[#A3A3A3]','40–59%'],['bg-[#FFB800]/20 text-[#FFB800]','60–79%'],['bg-[#FF4444]/30 text-[#FF4444]','≥ 80%']].map(([cls, label]) => (
                        <span key={label} className={`text-xs px-2 py-0.5 rounded ${cls}`}>{label}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Actions footer */}
                <div className="card py-3 px-4 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2">
                  <span className="text-xs text-[#6B6B6B] font-mono">{result.processing_time}ms</span>
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
              </div>
            )}

            {!result && !loading && (
              <div className="card flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-xl bg-[#FFB800]/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-[#FFB800]" />
                </div>
                <h3 className="font-semibold text-white mb-2">Ready to Analyze</h3>
                <p className="text-[#6B6B6B] text-sm max-w-xs">
                  Enter text on the left and click Detect. Minimum 50 characters for accurate results.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#6B6B6B] w-full">
                  {['Perplexity scoring', 'Style fingerprinting', 'Burstiness analysis', 'Neural signal analysis'].map(f => (
                    <div key={f} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#141414]/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2BEE34]/60 shrink-0" />{f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          
        </div>
      </div>
    </div>
    <div className="px-4 sm:px-6 lg:px-8 2xl:px-10 max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto pb-6">
      
      {graphContext && (
        <div className="mx-4 mb-4 rounded-xl border border-[#2BEE34]/20 bg-[#2BEE34]/5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#2BEE34]/10 bg-[#2BEE34]/5">
            <span className="w-2 h-2 rounded-full bg-[#2BEE34]" />
            <span className="text-xs font-bold text-[#2BEE34] tracking-wide uppercase">Web Verification</span>
            <span className="ml-auto text-[10px] text-[#6B6B6B]">Real-time Graph RAG</span>
          </div>
          <pre className="px-4 py-3 text-[11px] text-[#A3A3A3] leading-relaxed whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
            {graphContext}
          </pre>
        </div>
      )}

      <LazyReviewSuggestion toolName="AI Text Detector" />
      {result && (
        <div className="px-4 pb-4 flex items-center justify-between flex-wrap gap-3">
          <LazyFeedbackBar scanId={scanId} verdict={result.verdict} />
          {scanId && (
            <button onClick={shareResult}
              className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-white transition-colors border border-[#1E1E1E] rounded-lg px-3 py-1.5 hover:border-white/[0.12]">
              <Share2 className="w-3 h-3" /> Share result
            </button>
          )}
        </div>
      )}
      {result && (
        <details className="card mt-4 mx-4 mb-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#A3A3A3] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#2BEE34]" />
            Detection Models &amp; Datasets
          </summary>
          <div className="mt-3 space-y-2 text-xs text-[#6B6B6B]">
            <p><span className="text-[#A3A3A3] font-medium">Engine</span> Aiscern Detection Engine</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {[
                { name: 'HC3 Dataset', desc: 'Human ChatGPT Comparison Corpus', url: 'https://huggingface.co/datasets/Hello-SimpleAI/HC3' },
                { name: 'AI Text Detection Pile', desc: '500K+ labeled text samples', url: 'https://huggingface.co/datasets/artem9k/ai-text-detection-pile' },
                { name: 'GPT-Wiki-Intro', desc: 'GPT-generated Wikipedia intros', url: 'https://huggingface.co/datasets/aadityaubhat/GPT-wiki-intro' },
                { name: 'RAID Benchmark', desc: 'Robust AI text detection benchmark', url: 'https://huggingface.co/datasets/liamdugan/raid' },
              ].map(d => (
                <a key={d.url} href={d.url} target="_blank" rel="noreferrer"
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-[#141414] transition-colors group">
                  <Database className="w-3.5 h-3.5 text-[#2BEE34] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[#A3A3A3] font-medium group-hover:text-white transition-colors">{d.name}</p>
                    <p>{d.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
    {/* FIX B.3: MobileResultSheet — bottom sheet for detection result on mobile */}
    <MobileResultSheet isOpen={showMobileResult} onClose={() => setShowMobileResult(false)} title="Detection Result">
      {result && (
        <div className="space-y-4 pb-4">
          <div className={`card border ${result.verdict === 'AI' ? 'border-[#FFB800]/30 bg-[#FFB800]/5' : result.verdict === 'HUMAN' ? 'border-[#2BEE34]/30 bg-[#2BEE34]/5' : 'border-[#FFB800]/20 bg-[#FFB800]/5'} p-4 rounded-xl`}>
            <p className="font-black text-xl">{result.verdict === 'AI' ? '🤖 AI Generated' : result.verdict === 'HUMAN' ? '✅ Human Written' : '⚠️ Uncertain'}</p>
            <p className="text-[#6B6B6B] text-sm mt-1">{formatConfidence(result.confidence)} confidence</p>
            {result.summary && <p className="text-sm mt-2 text-[#A3A3A3]">{result.summary}</p>}
          </div>
        </div>
      )}
    </MobileResultSheet>
  </>
  )
}
export default function TextDetectionPageWrapper() {
  return <ErrorBoundary><TextDetectionPage /></ErrorBoundary>
}
