'use client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MobileResultSheet } from '@/components/MobileResultSheet'
import { useState, useCallback } from 'react'
import { toUserError } from '@/lib/utils/user-errors'
import { useDropzone } from 'react-dropzone'
import { uploadToR2WithProgress } from '@/lib/storage/upload-with-progress'
import { motion, AnimatePresence } from 'framer-motion'
import { Image as ImageIcon, Upload, X, AlertTriangle, Loader2, RotateCcw, Download, ZoomIn, Info, Share2, Database, Microscope } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence, formatFileSize, normalizeConfidence } from '@/lib/utils/helpers'
import dynamic from 'next/dynamic'
import { verdictConfig as baseVerdictConfig } from '@/lib/ui/verdict-config'
import { IMAGE_MAX_SIZE_BYTES } from '@/lib/constants'

// ── Post-scan components — loaded only after a result arrives ─────────────────
const LazyReviewSuggestion = dynamic(
  () => import('@/components/ReviewSuggestion').then(m => ({ default: m.ReviewSuggestion })),
  { ssr: false }
)
const LazyFeedbackBar = dynamic(
  () => import('@/components/FeedbackBar').then(m => ({ default: m.FeedbackBar })),
  { ssr: false }
)



const verdictConfig = {
  AI:        { ...baseVerdictConfig.AI,        label: 'AI GENERATED' },
  HUMAN:     { ...baseVerdictConfig.HUMAN,     label: 'HUMAN CREATED' },
  UNCERTAIN: { ...baseVerdictConfig.UNCERTAIN },
}

function ImageDetectionPage() {
  const { user: currentUser } = useAuth()
  const displayName: string | null =
    currentUser?.displayName?.split(' ')[0] ||
    currentUser?.email?.split('@')[0] ||
    null
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [showMobileResult, setShowMobileResult] = useState(false)
  const [graphContext, setGraphContext] = useState<string | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [forensicScanId, setForensicScanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoomed, setZoomed] = useState(false)
  const [imgDims, setImgDims] = useState<{w:number,h:number}|null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]; if (!f) return
    setFile(f); setResult(null); setError(null)
    const url = URL.createObjectURL(f)
    setPreview(url)
    // Get natural dimensions
    const img = new window.Image()
    img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'] },
    maxSize: IMAGE_MAX_SIZE_BYTES, multiple: false,
    onDropRejected: (files) => {
      const err = files[0]?.errors[0]
      setError(err?.code === 'file-too-large' ? 'File exceeds 10MB limit' : 'Invalid file type. Use JPG, PNG, WEBP, GIF or BMP.')
    }
  })

  const handleDetect = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null); setForensicScanId(null)
    try {
      let r2Key: string | null = null

      // Try R2 presigned upload first (bypasses Vercel 4.5MB body limit)
      try {
        const presignRes = await fetch('/api/upload', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size, mediaType: 'image' }),
        })
        const presignData = await presignRes.json()
        if (presignData.success && presignData.uploadUrl) {
          setUploadProgress(0)
          await uploadToR2WithProgress(presignData.uploadUrl, file, setUploadProgress)
          r2Key = presignData.key
        }
      } catch { /* fallback to direct upload */ }

      let res: Response
      if (r2Key) {
        res = await fetch('/api/detect/image', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ r2Key, fileName: file.name, fileSize: file.size, mimeType: file.type }),
        })
      } else {
        const formData = new FormData(); formData.append('file', file)
        res = await fetch('/api/detect/image', { method: 'POST', body: formData })
      }

      const data = await res.json()
      if (!data.success) throw new Error(toUserError(data.error?.code, data.error?.message))
      setResult(data.result); setShowMobileResult(true)
      setScanId(data.scan_id ?? null)
      setForensicScanId(data.forensic_scan_id ?? null)
      if (data.graph_context) setGraphContext(data.graph_context)
      // Notify dashboard/history pages to refresh scan list
      window.dispatchEvent(new CustomEvent('aiscern:scan-saved'))
    } catch (e: unknown) {
      setError(e instanceof Error ? toUserError(undefined, e.message) : toUserError())
    } finally { setLoading(false) }
  }

  const exportReport = () => {
    if (!result || !file) return
    const text = `Aiscern Image Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File:       ${file.name}
Size:       ${formatFileSize(file.size)}
${imgDims ? `Dimensions: ${imgDims.w} × ${imgDims.h}px\n` : ''}
Verdict:    ${result.verdict}
Confidence: ${formatConfidence(result.confidence)}
Summary:    ${result.summary}

Detection Signals:
${result.signals.map((s: any) => `  • ${s.name} — ${s.weight}% ${s.flagged ? '⚠ flagged' : '✓ clean'}\n    ${s.description}`).join('\n')}

Engine: Aiscern Detection Engine · ${result.processing_time}ms
Analyzed: ${new Date().toLocaleString()}`
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `aiscern-image-${Date.now()}.txt`; a.click()
  }

  const shareResult = async () => {
    if (!scanId) return
    try {
      await fetch(`/api/scan/${scanId}/share`, { method: 'POST' })
      await navigator.clipboard.writeText(`${window.location.origin}/scan/${scanId}`)
      alert('Share link copied to clipboard!')
    } catch { alert('Could not copy link. Try again.') }
  }

  const reset = () => { setFile(null); setPreview(null); setResult(null); setGraphContext(null); setError(null); setImgDims(null); setZoomed(false); setUploadProgress(0) }
  const cfg = result ? verdictConfig[result.verdict as Verdict] : null

  return (
    <>
    {/* Screen reader announcement of analysis results */}
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {result && `Analysis complete. Verdict: ${verdictConfig[result.verdict as Verdict]?.label ?? result.verdict}. Confidence: ${formatConfidence(result.confidence)}.`}
    </div>
    <div className="p-4 sm:p-4 lg:p-8 2xl:p-10 max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto">
      {/* Zoom modal */}
      {zoomed && preview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomed(false)}>
          <div className="relative max-w-full max-h-full">
            <img src={preview} alt="Zoomed" className="max-w-full max-h-[90vh] object-contain rounded-xl" />
            <button onClick={() => setZoomed(false)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2BEE34]/10 flex items-center justify-center shrink-0">
            <ImageIcon className="w-6 h-6 text-[#2BEE34]" />
          </div>
          Image Detection
        </h1>
        <p className="text-[#6B6B6B] ml-14 text-sm">GAN artifacts · Diffusion fingerprints · Pixel forensics · Metadata analysis</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Upload Panel */}
        <div className="space-y-4">
          {!file ? (
            // Fix 4.2: On touch devices, show a large tap-to-capture button with camera access
            // On desktop, keep the drag-and-drop zone
            typeof window !== 'undefined' && 'ontouchstart' in window ? (
              <div className="space-y-3">
                <label className="flex flex-col items-center gap-3 card border-2 border-dashed border-[#2BEE34]/20 bg-[#2BEE34]/5 rounded-xl py-10 cursor-pointer  transition-transform min-h-[180px] justify-center">
                  <div className="w-16 h-16 rounded-xl bg-[#2BEE34]/10 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-[#2BEE34]" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-[#2BEE34] text-base">Tap to Take Photo or Choose File</p>
                    <p className="text-xs text-[#6B6B6B] mt-1">JPG · PNG · WEBP · GIF · BMP · Max 10MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) onDrop([f]) }}
                  />
                </label>
              </div>
            ) : (
            <div {...getRootProps()}
              className={`card border-2 border-dashed cursor-pointer transition-all duration-200 min-h-[200px] sm:min-h-[280px] flex flex-col items-center justify-center gap-4
                ${isDragActive ? 'border-blue-500 bg-[#2BEE34]/5 ' : 'border-[#1E1E1E] hover:border-blue-500/50 hover:bg-[#141414]/30'}`}>
              <input {...getInputProps()} />
              <motion.div animate={isDragActive ? { scale: 1.2 } : { scale: 1 }}
                className="w-20 h-20 rounded-xl bg-[#2BEE34]/10 flex items-center justify-center">
                <Upload className={`w-10 h-10 ${isDragActive ? 'text-[#2BEE34]' : 'text-[#6B6B6B]'}`} />
              </motion.div>
              <div className="text-center">
                <p className="font-semibold text-white mb-1">
                  {isDragActive ? 'Drop image here' : 'Drag & drop an image'}
                </p>
                <p className="text-sm text-[#6B6B6B]">or click to browse</p>
                <p className="text-xs text-[#6B6B6B] mt-2">JPG · PNG · WEBP · GIF · BMP · Max 10MB</p>
              </div>
            </div>
            )
          ) : (
            <div className="card space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-[#141414] group">
                <img src={preview!} alt="Preview" className="w-full max-h-72 object-contain" />
                <button onClick={() => setZoomed(true)}
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                  <ZoomIn className="w-8 h-8 text-white drop-shadow" />
                </button>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mt-3 w-full">
                    <div className="flex justify-between text-xs text-[#6B6B6B] mb-1">
                      <span>Uploading…</span><span>{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-[#141414] rounded-full overflow-hidden">
                      <div className="h-full bg-[#2BEE34] rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#A3A3A3] font-medium truncate">{file.name}</p>
                  <p className="text-xs text-[#6B6B6B]">
                    {formatFileSize(file.size)}
                    {imgDims && ` · ${imgDims.w} × ${imgDims.h}px`}
                    {imgDims && ` · ${(imgDims.w / (imgDims.h || 1)).toFixed(2)}:1 ratio`}
                  </p>
                </div>
                <button onClick={reset}
              title="Detect Another" className="text-[#6B6B6B] hover:text-rose-400-400 transition-colors p-2 rounded-lg hover:bg-rose-500-500-500/10 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-3">
                <button onClick={reset} className="btn-ghost flex-1 py-2.5 flex items-center justify-center gap-2 text-sm">
                  <RotateCcw className="w-4 h-4" /> New Image
                </button>
                <button onClick={handleDetect} disabled={loading}
                  className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  {loading ? 'Scanning…' : 'Detect'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="card border-rose-500/30 bg-rose-500-500-500/5 flex items-center gap-2 text-rose-400-400-500 text-sm py-3">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </motion.div>
          )}

          {/* Info card */}
          <div className="card py-3 px-4 border-[#1E1E1E]">
            <div className="flex items-start gap-2 text-xs text-[#6B6B6B]">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#2BEE34]/60" />
              <span>For best results, use uncompressed or lightly compressed images. Heavy JPEG compression may reduce detection accuracy.</span>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <AnimatePresence>
          {result && cfg ? (
            <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-4 w-full min-w-0">
              <div className={`card border ${cfg.border} ${cfg.bg} w-full min-w-0`}>
                {displayName && (
                  <div className="mb-3 text-xs font-medium text-[#6B6B6B]">
                    Hey <span className="text-white font-semibold">{displayName}</span>, here's what we found
                    {file ? <> for <span className="text-white font-medium">"{file.name}"</span></> : null}:
                  </div>
                )}
                <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
                    <cfg.icon className={`w-5 h-5 sm:w-7 sm:h-7 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-lg sm:text-2xl font-black ${cfg.color} mb-1 leading-tight`}>
                      {displayName
                        ? result.verdict === 'AI' ? `${displayName}, this image is AI Generated`
                          : result.verdict === 'HUMAN' ? `${displayName}, this image is Human Created`
                          : `${displayName}, this image is Uncertain`
                        : cfg.label}
                    </h3>
                    <p className="text-[#6B6B6B] text-xs sm:text-sm leading-relaxed">{result.summary}</p>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-[#6B6B6B] mb-2 gap-2">
                    <span className="shrink-0">Confidence Score</span>
                    <span className={`font-black text-base sm:text-xl ${cfg.color} tabular-nums shrink-0`}>{formatConfidence(result.confidence)}</span>
                  </div>
                  <div className="h-3 bg-white/[0.08] rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${normalizeConfidence(result.confidence)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full bg-blue-500" />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#2BEE34]" />
                  Detection Signals ({result.signals.length})
                </h3>
                <div className="space-y-2.5 max-h-[300px] sm:max-h-none overflow-y-auto sm:overflow-visible pr-0.5 sm:pr-0">
                  {result.signals.map((s, i) => (
                    <motion.div key={s.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, ease: 'easeOut' }}
                      className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-[#141414]/50 border border-[#1E1E1E] min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.flagged ? 'bg-rose-500-500' : 'bg-emerald-500-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-[#A3A3A3] font-medium truncate">{s.name}</span>
                          <span className={`text-xs font-bold ml-2 px-1.5 py-0.5 rounded-full ${s.flagged ? 'bg-rose-500-500-500/15 text-rose-400-400-500' : 'bg-emerald-500-500-500/15 text-emerald-400-400-400'}`}>{s.weight}%</span>
                        </div>
                        <p className="text-xs text-[#6B6B6B] truncate">{s.description}</p>
                        <div className="h-1 bg-white/[0.08] rounded-full mt-1.5 overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${s.weight}%` }}
                            transition={{ delay: i * 0.06 + 0.3, duration: 0.5 }}
                            className={`h-full rounded-full ${s.flagged ? 'bg-rose-500-500' : 'bg-emerald-500-500'}`} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="card py-3 px-4 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-[#6B6B6B] font-mono truncate">{result.processing_time}ms</span>
                <div className="flex items-center gap-2">
                  {forensicScanId && (
                    <motion.a
                      href={`/forensic/${forensicScanId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2BEE34]/10 border border-[#2BEE34]/30 text-[#2BEE34] hover:bg-[#1A8F1F]/20 transition-colors font-medium"
                    >
                      <Microscope className="w-3.5 h-3.5" />
                      Deep Forensic Analysis
                    </motion.a>
                  )}
                  <button onClick={exportReport} className="text-xs btn-ghost py-1.5 px-3 flex items-center gap-1.5 shrink-0">
                    <Download className="w-3.5 h-3.5" /> Export Report
                  </button>
                </div>
              </div>
            </motion.div>
          ) : loading && !result ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="card flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-2 border-[#2BEE34]/20 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-[#2BEE34]" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-white">Analyzing image…</p>
                <p className="text-sm text-[#6B6B6B]">GAN fingerprints · Pixel forensics · Neural ensemble</p>
                <p className="text-xs text-[#6B6B6B]">Running 3-model ensemble + 6 pixel signals…</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="card flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-xl bg-[#2BEE34]/10 flex items-center justify-center mx-auto mb-4 ">
                <ImageIcon className="w-10 h-10 text-[#2BEE34]" />
              </div>
              <h3 className="font-semibold text-white mb-2">Upload an Image</h3>
              <p className="text-[#6B6B6B] text-sm max-w-xs">Drop any image to scan for GAN artifacts, metadata anomalies, and AI generation patterns</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#6B6B6B] w-full">
                {['GAN fingerprinting', 'Metadata analysis', 'Pixel forensics', 'Lighting consistency'].map(f => (
                  <div key={f} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#141414]/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />{f}
                  </div>
                ))}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
    <div className="px-4 sm:px-6 lg:px-8 2xl:px-10 max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto pb-6">
      
      {graphContext && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mb-4 rounded-xl border border-[#2BEE34]/20 bg-[#2BEE34]/5 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-500/10 bg-[#2BEE34]/5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-bold text-[#2BEE34] tracking-wide uppercase">Web Verification</span>
            <span className="ml-auto text-[10px] text-[#6B6B6B]">Real-time Graph RAG</span>
          </div>
          <pre className="px-4 py-3 text-[11px] text-[#A3A3A3] leading-relaxed whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
            {graphContext}
          </pre>
        </div>
      )}

      <LazyReviewSuggestion toolName="Image Detector" />
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
        <details className="card mt-2 mx-4 mb-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#A3A3A3] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#2BEE34]" />
            Detection Models &amp; Datasets
          </summary>
          <div className="mt-3 space-y-2 text-xs text-[#6B6B6B]">
            <p><span className="text-[#A3A3A3] font-medium">Engine</span> Aiscern Detection Engine</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {[
                { name: 'AIorNot Dataset', desc: 'Kaggle AI image competition dataset', url: 'https://huggingface.co/datasets/competitions/aiornot' },
                { name: 'FAKE-images', desc: 'elsaEU synthetic image dataset', url: 'https://huggingface.co/datasets/elsaEU/FAKE-images' },
                { name: 'AI and Real Art', desc: 'daviddvd AI vs real artwork dataset', url: 'https://huggingface.co/datasets/daviddvd/ai-and-real-art' },
                { name: 'AI Image Detector Dataset', desc: 'haywoodsloan ViT training data', url: 'https://huggingface.co/datasets/haywoodsloan/ai-image-detector-dataset' },
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
          <div className={`card border ${result.verdict === 'AI' ? 'border-amber-500/30 bg-amber-500-500-500/5' : result.verdict === 'HUMAN' ? 'border-emerald-500/30 bg-emerald-500-500-500/5' : 'border-amber-500/20 bg-amber-500-500-500/5'} p-4 rounded-xl`}>
            <p className="font-black text-xl">{result.verdict === 'AI' ? '🤖 AI Generated' : result.verdict === 'HUMAN' ? '✅ Human' : '⚠️ Uncertain'}</p>
            <p className="text-[#6B6B6B] text-sm mt-1">{formatConfidence(result.confidence)} confidence</p>
            {result.summary && <p className="text-sm mt-2 text-[#A3A3A3]">{result.summary}</p>}
          </div>
        </div>
      )}
    </MobileResultSheet>
  </>
  )
}
export default function ImageDetectionPageWrapper() {
  return <ErrorBoundary><ImageDetectionPage /></ErrorBoundary>
}
