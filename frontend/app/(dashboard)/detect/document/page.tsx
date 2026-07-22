'use client'
import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileSearch, Upload, X, AlertTriangle, CheckCircle, HelpCircle,
  Image as ImageIcon, FileText, Copy, Atom, ChevronDown, ChevronUp,
  Download, Info, FileWarning,
} from 'lucide-react'
import { toUserError } from '@/lib/utils/user-errors'
import { VerifyDocSequenceLoader } from '@/components/VerifyDocSequenceLoader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { formatFileSize } from '@/lib/utils/helpers'

const MAX_SIZE = 25 * 1024 * 1024
const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
}

interface ImageAnalysis {
  index: number
  status: string
  verdict?: 'AI' | 'HUMAN' | 'UNCERTAIN'
  confidence?: number
  [key: string]: any
}

interface TextAnalysis {
  status: string
  verdict?: 'AI' | 'HUMAN' | 'UNCERTAIN'
  confidence?: number
  summary?: string
  [key: string]: any
}

interface PlagiarismAnalysis {
  status: string
  risk_score: number
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN'
  signals?: Record<string, any>
  summary?: string
  note?: string
}

interface VerifyDocResult {
  document_type: string
  units_analyzed: number
  has_text: boolean
  has_images: boolean
  image_count: number
  text_analysis: TextAnalysis | null
  image_analyses: ImageAnalysis[]
  plagiarism_analysis: PlagiarismAnalysis | null
  composite_verdict: 'CLEAN' | 'FLAGGED' | 'NO_CONTENT'
  composite_summary: string
  processing_time_ms: number
  r2_key?: string | null
}

const verdictConfig: Record<string, { icon: any; color: string; border: string; bg: string; label: string }> = {
  AI:        { icon: AlertTriangle, color: 'text-rose',    border: 'border-rose/30',    bg: 'bg-rose/5',    label: 'AI GENERATED' },
  HUMAN:     { icon: CheckCircle,  color: 'text-emerald', border: 'border-emerald/30', bg: 'bg-emerald/5', label: 'HUMAN / ORIGINAL' },
  UNCERTAIN: { icon: HelpCircle,   color: 'text-amber',   border: 'border-amber/30',   bg: 'bg-amber/5',   label: 'UNCERTAIN' },
}

const compositeConfig: Record<string, { icon: any; color: string; border: string; bg: string; label: string }> = {
  CLEAN:      { icon: CheckCircle,  color: 'text-emerald', border: 'border-emerald/30', bg: 'bg-emerald/5', label: 'NO ISSUES FOUND' },
  FLAGGED:    { icon: AlertTriangle, color: 'text-rose',    border: 'border-rose/30',    bg: 'bg-rose/5',    label: 'ISSUES FLAGGED' },
  NO_CONTENT: { icon: HelpCircle,   color: 'text-amber',   border: 'border-amber/30',   bg: 'bg-amber/5',   label: 'NO CONTENT FOUND' },
}

function VerifyDocPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<VerifyDocResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedImages, setExpandedImages] = useState(false)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]; if (!f) return
    setFile(f); setResult(null); setError(null); setUploadProgress(0)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: loading,
    onDropRejected: (rejections) => {
      const r = rejections[0]
      if (r?.errors?.[0]?.code === 'file-too-large') setError('Document must be under 25MB')
      else setError('Only PDF, DOCX, and PPTX files are supported')
    },
  })

  const reset = () => {
    setFile(null); setResult(null); setError(null); setUploadProgress(0)
  }

  const handleScan = () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null); setUploadProgress(0)

    const form = new FormData()
    form.append('file', file)

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      setLoading(false)
      try {
        const json = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && json.success) {
          setResult(json.data)
        } else {
          setError(toUserError(json?.error?.code, json?.error?.message))
        }
      } catch {
        setError('Something went wrong reading the response. Please try again.')
      }
    })
    xhr.addEventListener('error', () => { setLoading(false); setError('Network error — please try again.') })
    xhr.addEventListener('abort', () => { setLoading(false) })
    xhr.open('POST', '/api/detect/document')
    xhr.send(form)
  }

  const cancelScan = () => {
    xhrRef.current?.abort()
    setLoading(false)
    setUploadProgress(0)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">VerifyDoc</h1>
        </div>
        <p className="text-sm text-text-muted max-w-2xl">
          Upload a PDF, Word, or PowerPoint file. VerifyDoc extracts every embedded image and every
          paragraph of text, then scans both <span className="text-text-primary font-medium">in parallel</span> —
          images get the full AI-generation + physical-consistency forensics pipeline, text gets the
          full AI-writing pipeline, and the whole document gets an originality-risk pass.
        </p>
      </div>

      {/* ── Upload zone ── */}
      {!file && (
        <div
          {...getRootProps()}
          className={`card border-2 border-dashed cursor-pointer transition-all py-14 flex flex-col items-center justify-center gap-3 text-center
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
        >
          <input {...getInputProps()} />
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Upload className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-text-primary">Drop a document here, or click to browse</p>
            <p className="text-xs text-text-muted mt-1">PDF, DOCX, or PPTX — up to 25MB</p>
          </div>
        </div>
      )}

      {/* ── Selected file / scan trigger ── */}
      {file && !result && (
        <div className="card p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{file.name}</p>
            <p className="text-xs text-text-muted">{formatFileSize(file.size)}</p>
          </div>
          {!loading && (
            <>
              <button onClick={reset} className="p-2 rounded-lg hover:bg-white/5 text-text-muted">
                <X className="w-4 h-4" />
              </button>
              <button onClick={handleScan} className="btn-primary px-5 py-2 text-sm font-semibold rounded-xl">
                Scan document
              </button>
            </>
          )}
          {loading && (
            <button onClick={cancelScan} className="px-4 py-2 text-sm font-medium rounded-xl border border-border hover:bg-white/5">
              Cancel
            </button>
          )}
        </div>
      )}

      {/* ── Animated progress ── */}
      <AnimatePresence>
        {loading && (
          <VerifyDocSequenceLoader
            loading={loading}
            uploadProgress={uploadProgress}
            hasImages={true}
            hasText={true}
          />
        )}
      </AnimatePresence>

      {/* ── Error ── */}
      {error && !loading && (
        <div className="card border border-rose/30 bg-rose/5 p-4 flex items-start gap-3">
          <FileWarning className="w-5 h-5 text-rose shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose">{error}</p>
          </div>
          <button onClick={reset} className="text-xs font-medium text-text-muted hover:text-text-primary">
            Try again
          </button>
        </div>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          {/* Composite verdict banner */}
          {(() => {
            const cfg = compositeConfig[result.composite_verdict] || compositeConfig.NO_CONTENT
            const Icon = cfg.icon
            return (
              <div className={`card border ${cfg.border} ${cfg.bg} p-5 flex items-start gap-4`}>
                <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Icon className={`w-6 h-6 ${cfg.color}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-xs font-bold uppercase tracking-widest ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-sm text-text-primary mt-1">{result.composite_summary}</p>
                  <p className="text-xs text-text-muted mt-2">
                    {result.document_type.toUpperCase()} · {result.units_analyzed} {result.document_type === 'pptx' ? 'slide(s)' : 'page(s)'} ·{' '}
                    {result.image_count} image(s) analyzed · {Math.round(result.processing_time_ms)}ms
                  </p>
                </div>
              </div>
            )
          })()}

          {/* Text analysis */}
          {result.text_analysis && result.has_text && (() => {
            const t = result.text_analysis
            const cfg = verdictConfig[t.verdict || 'UNCERTAIN']
            const Icon = cfg?.icon || HelpCircle
            return (
              <div className={`card border ${cfg?.border} p-5`}>
                <div className="flex items-center gap-2.5 mb-2">
                  <FileText className="w-4 h-4 text-text-muted" />
                  <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Document text</p>
                </div>
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${cfg?.color}`} />
                  <p className={`text-sm font-bold ${cfg?.color}`}>{cfg?.label}</p>
                  {typeof t.confidence === 'number' && (
                    <span className="text-xs text-text-muted ml-auto">{Math.round(t.confidence)}% confidence</span>
                  )}
                </div>
                {t.summary && <p className="text-xs text-text-muted mt-2">{t.summary}</p>}
              </div>
            )
          })()}

          {/* Plagiarism / originality */}
          {result.plagiarism_analysis && result.plagiarism_analysis.status === 'ok' && (() => {
            const p = result.plagiarism_analysis
            const riskColor = p.risk_level === 'HIGH' ? 'text-rose' : p.risk_level === 'MODERATE' ? 'text-amber' : 'text-emerald'
            const riskBorder = p.risk_level === 'HIGH' ? 'border-rose/30' : p.risk_level === 'MODERATE' ? 'border-amber/30' : 'border-emerald/30'
            return (
              <div className={`card border ${riskBorder} p-5`}>
                <div className="flex items-center gap-2.5 mb-2">
                  <Copy className="w-4 h-4 text-text-muted" />
                  <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Originality risk</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${riskColor}`}>{p.risk_level} RISK</span>
                  <span className="text-xs text-text-muted ml-auto">{p.risk_score}/100</span>
                </div>
                <p className="text-xs text-text-muted mt-2">{p.summary}</p>
                {(p.signals?.duplicated_snippet_examples?.length ?? 0) > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[11px] font-semibold text-text-muted">Repeated passages found:</p>
                    {p.signals!.duplicated_snippet_examples.map((s: string, i: number) => (
                      <p key={i} className="text-[11px] text-text-disabled italic truncate">"{s}"</p>
                    ))}
                  </div>
                )}
                <p className="text-[10.5px] text-text-disabled mt-3 flex items-center gap-1">
                  <Info className="w-3 h-3" /> {p.note}
                </p>
              </div>
            )
          })()}

          {/* Images */}
          {result.image_analyses && result.image_analyses.length > 0 && (
            <div className="card p-5">
              <button
                onClick={() => setExpandedImages(v => !v)}
                className="w-full flex items-center gap-2.5 mb-2"
              >
                <ImageIcon className="w-4 h-4 text-text-muted" />
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
                  Embedded images ({result.image_analyses.length})
                </p>
                <span className="ml-auto text-text-muted">
                  {expandedImages ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>
              <div className="flex items-center gap-3 flex-wrap">
                {result.image_analyses.slice(0, expandedImages ? undefined : 6).map((img) => {
                  const cfg = verdictConfig[img.verdict || 'UNCERTAIN']
                  const Icon = cfg?.icon || HelpCircle
                  return (
                    <div key={img.index} className={`px-3 py-2 rounded-xl border ${cfg?.border} flex items-center gap-2`}>
                      <Icon className={`w-3.5 h-3.5 ${cfg?.color}`} />
                      <span className="text-xs font-medium text-text-primary">Image {img.index + 1}</span>
                      <span className={`text-xs font-bold ${cfg?.color}`}>
                        {img.verdict || 'N/A'}{typeof img.confidence === 'number' ? ` · ${Math.round(img.confidence)}%` : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10.5px] text-text-disabled">
                <Atom className="w-3 h-3" />
                Each image was checked with the full physical-consistency forensic stack (illumination, shadow & reflection physics), same as a standalone image scan.
              </div>
            </div>
          )}

          {/* No content fallback */}
          {result.composite_verdict === 'NO_CONTENT' && (
            <div className="card border border-amber/30 bg-amber/5 p-5 text-sm text-text-muted">
              We couldn't find extractable text or images in this document. If it's a scanned document,
              try our <a href="/detect/image" className="text-primary underline">image detector</a> on individual pages instead.
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={reset} className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-border hover:bg-white/5">
              Scan another document
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Full knowledge / how it works ── */}
      {!file && (
        <div className="card p-6 space-y-5 mt-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">How VerifyDoc works</h2>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-text-primary">Image detection</p>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Every embedded image is extracted and run through Aiscern's full image pipeline: GAN
                fingerprint analysis, diffusion-model inversion/snapback checks, frequency-domain and
                noise-pattern forensics, and physical-consistency layers (PAFRA, BDIS, SSWDP, QESM) that
                check whether shadows, reflections, and illumination in the image are physically
                plausible — a signal that survives compression and resizing better than pixel-level
                artifacts alone.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-text-primary">Text detection</p>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                All extracted body text (paragraphs, table cells, slide text boxes) is analyzed with
                perplexity scoring, burstiness analysis, stylometric fingerprinting, and repetition
                detection — the same ensemble used in Aiscern's standalone AI text detector.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-text-primary">Originality / plagiarism risk</p>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                An offline originality pass flags internal duplication (copy-pasted or "mosaic"
                sections), low lexical diversity, common essay-mill boilerplate phrasing, and citation
                density. This is a risk signal, not a web-crawl match — it won't tell you which website
                a sentence came from, only whether the document shows the patterns that correlate with
                unoriginal writing.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Atom className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-text-primary">Why parallel matters</p>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Image and text detection run concurrently, not sequentially — a document with 10 images
                and a long body of text is scanned in roughly the time of whichever branch is slower,
                not the sum of both. If a document has no images, the image branch is skipped entirely
                (and vice versa), so you're never waiting on empty work.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VerifyDocPageWrapper() {
  return (
    <ErrorBoundary>
      <VerifyDocPage />
    </ErrorBoundary>
  )
}
