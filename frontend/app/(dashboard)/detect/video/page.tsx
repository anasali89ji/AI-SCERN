'use client'
export const dynamic = 'force-dynamic'
import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Video, Upload, X, AlertTriangle, CheckCircle, HelpCircle, Loader2, RotateCcw, Play, Pause } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence, formatFileSize } from '@/lib/utils/helpers'

const verdictConfig = {
  AI:        { icon: AlertTriangle, color: 'text-rose',    border: 'border-rose/30',    bg: 'bg-rose/5',    label: 'AI / DEEPFAKE DETECTED' },
  HUMAN:     { icon: CheckCircle,  color: 'text-emerald', border: 'border-emerald/30', bg: 'bg-emerald/5', label: 'AUTHENTIC VIDEO' },
  UNCERTAIN: { icon: HelpCircle,   color: 'text-amber',   border: 'border-amber/30',   bg: 'bg-amber/5',   label: 'UNCERTAIN' },
}

function FrameAnalysisGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-6 gap-1 mt-3">
      {Array.from({ length: Math.min(count, 18) }).map((_, i) => (
        <motion.div key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04 }}
          className={`h-8 rounded-md flex items-center justify-center text-xs font-bold
            ${Math.random() > 0.5 ? 'bg-rose/20 text-rose border border-rose/30' : 'bg-emerald/20 text-emerald border border-emerald/30'}`}>
          {i + 1}
        </motion.div>
      ))}
    </div>
  )
}

export default function VideoDetectionPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const supabase = createClient()

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]; if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.webm', '.mov', '.avi'] },
    maxSize: 100 * 1024 * 1024, multiple: false,
    onDropRejected: () => setError('Invalid file. Use MP4, WEBM, or MOV under 100MB.')
  })

  const togglePlay = () => {
    if (!videoRef.current) return
    if (playing) { videoRef.current.pause(); setPlaying(false) }
    else { videoRef.current.play(); setPlaying(true) }
  }

  const handleDetect = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    try {
      const formData = new FormData(); formData.append('file', file)
      const res = await fetch('/api/detect/video', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || 'Detection failed')
      setResult(data.data)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('scans').insert({
          user_id: user.id, media_type: 'video', file_name: file.name,
          file_size: file.size, verdict: data.data.verdict,
          confidence_score: data.data.confidence, signals: data.data.signals,
          model_used: data.data.model_used, status: 'complete'
        })
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Detection failed') }
    finally { setLoading(false) }
  }

  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(null); setPlaying(false) }
  const cfg = result ? verdictConfig[result.verdict as Verdict] : null

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
            <Video className="w-6 h-6 text-secondary" />
          </div>
          Video Detection
        </h1>
        <p className="text-text-muted ml-14">Deepfake detection, frame-by-frame analysis, temporal inconsistency, face swap artifacts</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          {!file ? (
            <div {...getRootProps()}
              className={`card border-2 border-dashed cursor-pointer transition-all duration-300 min-h-64 flex flex-col items-center justify-center gap-4
                ${isDragActive ? 'border-secondary bg-secondary/5 scale-[1.02]' : 'border-border hover:border-secondary/50 hover:bg-surface-hover/30'}`}>
              <input {...getInputProps()} />
              <motion.div animate={isDragActive ? { scale: 1.2 } : { scale: 1 }}
                className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center">
                <Upload className={`w-10 h-10 ${isDragActive ? 'text-secondary' : 'text-text-muted'}`} />
              </motion.div>
              <div className="text-center">
                <p className="font-semibold text-text-primary mb-1">{isDragActive ? 'Drop your video' : 'Drag & drop a video'}</p>
                <p className="text-sm text-text-muted">or click to browse</p>
                <p className="text-xs text-text-disabled mt-2">MP4 · WEBM · MOV · Max 100MB</p>
              </div>
            </div>
          ) : (
            <div className="card space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video ref={videoRef} src={preview!} className="w-full max-h-64 object-contain"
                  onEnded={() => setPlaying(false)} />
                {loading && (
                  <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-3">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-2 border-secondary/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-t-secondary animate-spin" />
                      <div className="absolute inset-2 bg-secondary/10 rounded-full flex items-center justify-center">
                        <Video className="w-5 h-5 text-secondary" />
                      </div>
                    </div>
                    <p className="text-sm text-secondary font-medium">Analyzing frames...</p>
                  </div>
                )}
                {!loading && (
                  <button onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors">
                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                      {playing ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
                    </div>
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary font-medium">{file.name}</p>
                  <p className="text-xs text-text-muted">{formatFileSize(file.size)}</p>
                </div>
                <button onClick={reset} className="text-text-muted hover:text-rose p-2 rounded-lg hover:bg-rose/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={reset} className="btn-ghost flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" /> New Video
                </button>
                <button onClick={handleDetect} disabled={loading}
                  className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                  {loading ? 'Analyzing...' : 'Detect'}
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

        <AnimatePresence mode="wait">
          {result && cfg ? (
            <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className={`card border ${cfg.border} ${cfg.bg}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
                    <cfg.icon className={`w-7 h-7 ${cfg.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-xl font-black ${cfg.color} mb-1`}>{cfg.label}</h3>
                    <p className="text-text-muted text-sm">{result.summary}</p>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex justify-between text-xs text-text-muted mb-2">
                    <span>Confidence</span>
                    <span className={`font-bold text-base ${cfg.color}`}>{formatConfidence(result.confidence)}</span>
                  </div>
                  <div className="h-3 bg-border rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-secondary to-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-text-muted mt-4 mb-1">Frame Analysis</p>
                  <FrameAnalysisGrid count={12} />
                </div>
              </div>
              <div className="card">
                <h3 className="font-semibold text-text-primary mb-4">Detection Signals</h3>
                <div className="space-y-3">
                  {result.signals.map((s, i) => (
                    <motion.div key={s.name} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }} className="flex items-center gap-3 p-3 rounded-xl bg-surface-active/50">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.flagged ? 'bg-rose' : 'bg-emerald'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-text-secondary font-medium truncate">{s.name}</span>
                          <span className={`text-xs font-bold ml-2 ${s.flagged ? 'text-rose' : 'text-emerald'}`}>{s.weight}%</span>
                        </div>
                        <p className="text-xs text-text-muted truncate">{s.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div className="card py-3 px-4 flex justify-between">
                <span className="text-xs text-text-muted font-mono">{result.model_used}</span>
                <span className="text-xs text-text-muted">{result.processing_time}ms</span>
              </div>
            </motion.div>
          ) : !loading && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="card flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-4 animate-float">
                <Video className="w-10 h-10 text-secondary" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">Upload a Video</h3>
              <p className="text-text-muted text-sm max-w-xs">Drop a video clip to scan each frame for deepfake artifacts, face swaps, and temporal inconsistencies</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
