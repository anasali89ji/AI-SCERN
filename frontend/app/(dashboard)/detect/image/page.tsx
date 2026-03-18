'use client'
export const dynamic = 'force-dynamic'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Image as ImageIcon, Upload, X, AlertTriangle, CheckCircle, HelpCircle, Loader2, RotateCcw, Download, ZoomIn, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence, formatFileSize } from '@/lib/utils/helpers'
import { SignupGate, incrementGlobalScanCount } from '@/components/SignupGate'
import { ReviewSuggestion } from '@/components/ReviewSuggestion'



const verdictConfig = {
  AI:        { icon: AlertTriangle, color: 'text-rose',    border: 'border-rose/30',    bg: 'bg-rose/5',    label: 'AI GENERATED' },
  HUMAN:     { icon: CheckCircle,  color: 'text-emerald', border: 'border-emerald/30', bg: 'bg-emerald/5', label: 'HUMAN CREATED' },
  UNCERTAIN: { icon: HelpCircle,   color: 'text-amber',   border: 'border-amber/30',   bg: 'bg-amber/5',   label: 'UNCERTAIN' },
}

export default function ImageDetectionPage() {
  const { user: currentUser } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoomed, setZoomed] = useState(false)
  const [imgDims, setImgDims] = useState<{w:number,h:number}|null>(null)
  const supabase = createClient()

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
    maxSize: 10 * 1024 * 1024, multiple: false,
    onDropRejected: (files) => {
      const err = files[0]?.errors[0]
      setError(err?.code === 'file-too-large' ? 'File exceeds 10MB limit' : 'Invalid file type. Use JPG, PNG, WEBP, GIF or BMP.')
    }
  })

  const handleDetect = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    try {
      const formData = new FormData(); formData.append('file', file)
      const res = await fetch('/api/detect/image', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || 'Detection failed')
      setResult(data.data)
      if (currentUser?.uid) {
        await (supabase as any).from('scans').insert({
          user_id: currentUser.uid, media_type: 'image', file_name: file.name,
          file_size: file.size, verdict: data.data.verdict,
          confidence_score: data.data.confidence, signals: data.data.signals,
          model_used: data.data.model_used, status: 'complete'
        })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Detection failed')
    } finally { setLoading(false) }
  }

  const exportReport = () => {
    if (!result || !file) return
    const text = `DETECTAI Image Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File:       ${file.name}
Size:       ${formatFileSize(file.size)}
${imgDims ? `Dimensions: ${imgDims.w} × ${imgDims.h}px\n` : ''}
Verdict:    ${result.verdict}
Confidence: ${result.confidence}%
Summary:    ${result.summary}

Detection Signals:
${result.signals.map((s: any) => `  • ${s.name} — ${s.weight}% ${s.flagged ? '⚠ flagged' : '✓ clean'}\n    ${s.description}`).join('\n')}

Model: ${result.model_used} · ${result.processing_time}ms
Analyzed: ${new Date().toLocaleString()}`
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `detectai-image-${Date.now()}.txt`; a.click()
  }

  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(null); setImgDims(null); setZoomed(false) }
  const cfg = result ? verdictConfig[result.verdict as Verdict] : null

  return (
    <>
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Zoom modal */}
      {zoomed && preview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomed(false)}>
          <div className="relative max-w-full max-h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Zoomed" className="max-w-full max-h-[90vh] object-contain rounded-xl" />
            <button onClick={() => setZoomed(false)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ImageIcon className="w-6 h-6 text-primary" />
          </div>
          Image Detection
        </h1>
        <p className="text-text-muted ml-14 text-sm">GAN artifacts · Diffusion fingerprints · Pixel forensics · Metadata analysis</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Upload Panel */}
        <div className="space-y-4">
          {!file ? (
            <div {...getRootProps()}
              className={`card border-2 border-dashed cursor-pointer transition-all duration-300 min-h-64 flex flex-col items-center justify-center gap-4
                ${isDragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-primary/50 hover:bg-surface-hover/30'}`}>
              <input {...getInputProps()} />
              <motion.div animate={isDragActive ? { scale: 1.2 } : { scale: 1 }}
                className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className={`w-10 h-10 ${isDragActive ? 'text-primary' : 'text-text-muted'}`} />
              </motion.div>
              <div className="text-center">
                <p className="font-semibold text-text-primary mb-1">
                  {isDragActive ? 'Drop image here' : 'Drag & drop an image'}
                </p>
                <p className="text-sm text-text-muted">or click to browse</p>
                <p className="text-xs text-text-disabled mt-2">JPG · PNG · WEBP · GIF · BMP · Max 10MB</p>
              </div>
            </div>
          ) : (
            <div className="card space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-surface-active group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview!} alt="Preview" className="w-full max-h-72 object-contain" />
                <button onClick={() => setZoomed(true)}
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                  <ZoomIn className="w-8 h-8 text-white drop-shadow" />
                </button>
                {loading && (
                  <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-3">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
                      <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                    <motion.div animate={{ y: ['0%', '100%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />
                    <p className="text-sm text-primary font-medium">Scanning image…</p>
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-secondary font-medium truncate">{file.name}</p>
                  <p className="text-xs text-text-muted">
                    {formatFileSize(file.size)}
                    {imgDims && ` · ${imgDims.w} × ${imgDims.h}px`}
                    {imgDims && ` · ${(imgDims.w / (imgDims.h || 1)).toFixed(2)}:1 ratio`}
                  </p>
                </div>
                <button onClick={reset} className="text-text-muted hover:text-rose transition-colors p-2 rounded-lg hover:bg-rose/10 shrink-0">
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
              className="card border-rose/30 bg-rose/5 flex items-center gap-2 text-rose text-sm py-3">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </motion.div>
          )}

          {/* Info card */}
          <div className="card py-3 px-4 border-border/50">
            <div className="flex items-start gap-2 text-xs text-text-muted">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/60" />
              <span>For best results, use uncompressed or lightly compressed images. Heavy JPEG compression may reduce detection accuracy.</span>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <AnimatePresence mode="wait">
          {result && cfg ? (
            <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className={`card border ${cfg.border} ${cfg.bg}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
                    <cfg.icon className={`w-7 h-7 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-2xl font-black ${cfg.color} mb-1`}>{cfg.label}</h3>
                    <p className="text-text-muted text-sm leading-relaxed">{result.summary}</p>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex justify-between text-xs text-text-muted mb-2">
                    <span>Confidence Score</span>
                    <span className={`font-black text-xl ${cfg.color}`}>{formatConfidence(result.confidence)}</span>
                  </div>
                  <div className="h-3 bg-border rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Detection Signals ({result.signals.length})
                </h3>
                <div className="space-y-3">
                  {result.signals.map((s, i) => (
                    <motion.div key={s.name} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-active/50 border border-border/50">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.flagged ? 'bg-rose' : 'bg-emerald'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-text-secondary font-medium truncate">{s.name}</span>
                          <span className={`text-xs font-bold ml-2 px-1.5 py-0.5 rounded-full ${s.flagged ? 'bg-rose/15 text-rose' : 'bg-emerald/15 text-emerald'}`}>{s.weight}%</span>
                        </div>
                        <p className="text-xs text-text-muted truncate">{s.description}</p>
                        <div className="h-1 bg-border rounded-full mt-1.5 overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${s.weight}%` }}
                            transition={{ delay: i * 0.06 + 0.3, duration: 0.5 }}
                            className={`h-full rounded-full ${s.flagged ? 'bg-rose' : 'bg-emerald'}`} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="card py-3 px-4 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-text-muted font-mono truncate">{result.model_used} · {result.processing_time}ms</span>
                <button onClick={exportReport} className="text-xs btn-ghost py-1.5 px-3 flex items-center gap-1.5 shrink-0">
                  <Download className="w-3.5 h-3.5" /> Export Report
                </button>
              </div>
            </motion.div>
          ) : loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="card flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-2 border-primary/20 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-primary" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-text-primary">Analyzing image…</p>
                <p className="text-sm text-text-muted">Pixel forensics · GAN detection · Neural ensemble</p>
                <p className="text-xs text-text-disabled animate-pulse">Running 3-model ensemble + 6 pixel signals…</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="card flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-float">
                <ImageIcon className="w-10 h-10 text-primary" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">Upload an Image</h3>
              <p className="text-text-muted text-sm max-w-xs">Drop any image to scan for GAN artifacts, metadata anomalies, and AI generation patterns</p>
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-text-muted w-full max-w-xs">
                {['GAN fingerprinting', 'Metadata analysis', 'Pixel forensics', 'Lighting consistency'].map(f => (
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
    <div className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto pb-6">
      
      <ReviewSuggestion toolName="Image Detector" />
    </div>
  </>
  )
}