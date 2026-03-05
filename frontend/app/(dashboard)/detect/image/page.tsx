'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Image as ImageIcon, Upload, X, AlertTriangle, CheckCircle, HelpCircle, Loader2, RotateCcw, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence, formatFileSize } from '@/lib/utils/helpers'

const verdictConfig = {
  AI:        { icon: AlertTriangle, color: 'text-rose',    border: 'border-rose/30',    bg: 'bg-rose/5',    badge: 'badge-ai',        label: 'AI GENERATED' },
  HUMAN:     { icon: CheckCircle,  color: 'text-emerald', border: 'border-emerald/30', bg: 'bg-emerald/5', badge: 'badge-human',     label: 'HUMAN CREATED' },
  UNCERTAIN: { icon: HelpCircle,   color: 'text-amber',   border: 'border-amber/30',   bg: 'bg-amber/5',   badge: 'badge-uncertain', label: 'UNCERTAIN' },
}

export default function ImageDetectionPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDropRejected: (files) => {
      const err = files[0]?.errors[0]
      setError(err?.code === 'file-too-large' ? 'File exceeds 10MB limit' : 'Invalid file type. Use JPG, PNG, WEBP or GIF.')
    }
  })

  const handleDetect = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/detect/image', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || 'Detection failed')
      setResult(data.data)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('scans').insert({
          user_id: user.id, media_type: 'image', file_name: file.name,
          file_size: file.size, verdict: data.data.verdict,
          confidence_score: data.data.confidence, signals: data.data.signals,
          model_used: data.data.model_used, status: 'complete'
        })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Detection failed')
    } finally { setLoading(false) }
  }

  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(null) }

  const cfg = result ? verdictConfig[result.verdict as Verdict] : null

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-primary" />
          </div>
          Image Detection
        </h1>
        <p className="text-text-muted ml-14">GAN artifacts, pixel forensics, metadata analysis, lighting inconsistencies</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Upload Panel */}
        <div className="space-y-4">
          {!file ? (
            <div
              {...getRootProps()}
              className={`card border-2 border-dashed cursor-pointer transition-all duration-300 min-h-64 flex flex-col items-center justify-center gap-4
                ${isDragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-primary/50 hover:bg-surface-hover/30'}`}
            >
              <input {...getInputProps()} />
              <motion.div
                animate={isDragActive ? { scale: 1.2 } : { scale: 1 }}
                className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center"
              >
                <Upload className={`w-10 h-10 ${isDragActive ? 'text-primary' : 'text-text-muted'}`} />
              </motion.div>
              <div className="text-center">
                <p className="font-semibold text-text-primary mb-1">
                  {isDragActive ? 'Drop your image here' : 'Drag & drop an image'}
                </p>
                <p className="text-sm text-text-muted">or click to browse</p>
                <p className="text-xs text-text-disabled mt-2">JPG · PNG · WEBP · GIF · Max 10MB</p>
              </div>
            </div>
          ) : (
            <div className="card space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-surface-active">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview!} alt="Preview" className="w-full max-h-72 object-contain" />
                {loading && (
                  <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-3">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
                      <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                    {/* Scan line animation */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <motion.div
                        animate={{ y: ['0%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80"
                      />
                    </div>
                    <p className="text-sm text-primary font-medium">Analyzing image...</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-text-secondary font-medium">{file.name}</p>
                  <p className="text-text-muted text-xs">{formatFileSize(file.size)}</p>
                </div>
                <button onClick={reset} className="text-text-muted hover:text-rose transition-colors p-2 rounded-lg hover:bg-rose/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={reset} className="btn-ghost flex-1 py-2.5 flex items-center justify-center gap-2 text-sm">
                  <RotateCcw className="w-4 h-4" /> New Image
                </button>
                <button onClick={handleDetect} disabled={loading} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  {loading ? 'Scanning...' : 'Detect'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="card border-rose/30 bg-rose/5 flex items-center gap-2 text-rose text-sm py-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </motion.div>
          )}
        </div>

        {/* Results Panel */}
        <AnimatePresence mode="wait">
          {result && cfg ? (
            <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              {/* Verdict */}
              <div className={`card border ${cfg.border} ${cfg.bg}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0`}>
                    <cfg.icon className={`w-7 h-7 ${cfg.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-2xl font-black ${cfg.color} mb-1`}>{cfg.label}</h3>
                    <p className="text-text-muted text-sm leading-relaxed">{result.summary}</p>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex justify-between text-xs text-text-muted mb-2">
                    <span>Confidence Score</span>
                    <span className={`font-bold text-base ${cfg.color}`}>{formatConfidence(result.confidence)}</span>
                  </div>
                  <div className="h-3 bg-border rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
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
                  {result.signals.map((s, i) => (
                    <motion.div key={s.name} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-active/50">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.flagged ? 'bg-rose' : 'bg-emerald'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-text-secondary font-medium truncate">{s.name}</span>
                          <span className={`text-xs font-bold ml-2 ${s.flagged ? 'text-rose' : 'text-emerald'}`}>{s.weight}%</span>
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

              {/* Footer */}
              <div className="card py-3 px-4 flex items-center justify-between">
                <span className="text-xs text-text-muted font-mono">{result.model_used}</span>
                <span className="text-xs text-text-muted">{result.processing_time}ms</span>
              </div>
            </motion.div>
          ) : !loading ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="card flex flex-col items-center justify-center py-20 text-center h-full">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-float">
                <ImageIcon className="w-10 h-10 text-primary" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">Upload an Image</h3>
              <p className="text-text-muted text-sm max-w-xs">Drop any image to scan for GAN artifacts, metadata anomalies, and AI generation patterns</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
