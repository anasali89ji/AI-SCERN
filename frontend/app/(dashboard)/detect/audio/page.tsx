'use client'
export const dynamic = 'force-dynamic'
import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Upload, X, AlertTriangle, CheckCircle, HelpCircle, Loader2, RotateCcw, Play, Pause } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence, formatFileSize } from '@/lib/utils/helpers'

const verdictConfig = {
  AI:        { icon: AlertTriangle, color: 'text-rose',    border: 'border-rose/30',    bg: 'bg-rose/5',    label: 'AI GENERATED VOICE' },
  HUMAN:     { icon: CheckCircle,  color: 'text-emerald', border: 'border-emerald/30', bg: 'bg-emerald/5', label: 'AUTHENTIC HUMAN VOICE' },
  UNCERTAIN: { icon: HelpCircle,   color: 'text-amber',   border: 'border-amber/30',   bg: 'bg-amber/5',   label: 'UNCERTAIN' },
}

function WaveformVisualizer({ playing }: { playing: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {Array.from({ length: 32 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-gradient-to-t from-primary to-cyan"
          animate={playing ? {
            height: [4, Math.random() * 32 + 8, 4],
          } : { height: 4 }}
          transition={{ duration: 0.5 + Math.random() * 0.5, repeat: playing ? Infinity : 0, ease: 'easeInOut', delay: i * 0.03 }}
        />
      ))}
    </div>
  )
}

export default function AudioDetectionPage() {
  const { user: firebaseUser } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const supabase = createClient()

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]; if (!f) return
    setFile(f); setResult(null); setError(null)
    if (audioRef.current) { audioRef.current.src = URL.createObjectURL(f) }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.ogg', '.m4a', '.flac'] },
    maxSize: 50 * 1024 * 1024, multiple: false,
    onDropRejected: () => setError('Invalid file. Use MP3, WAV, OGG, M4A or FLAC under 50MB.')
  })

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const handleDetect = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/detect/audio', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || 'Detection failed')
      setResult(data.data)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('scans').insert({
          user_id: user.id, media_type: 'audio', file_name: file.name,
          file_size: file.size, verdict: data.data.verdict,
          confidence_score: data.data.confidence, signals: data.data.signals,
          model_used: data.data.model_used, status: 'complete'
        })
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Detection failed') }
    finally { setLoading(false) }
  }

  const reset = () => { setFile(null); setResult(null); setError(null); setPlaying(false) }
  const cfg = result ? verdictConfig[result.verdict as Verdict] : null

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan/10 flex items-center justify-center">
            <Mic className="w-6 h-6 text-cyan" />
          </div>
          Audio Detection
        </h1>
        <p className="text-text-muted ml-14">Voice synthesis detection, spectral analysis, prosody patterns, TTS artifacts</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          {!file ? (
            <div {...getRootProps()}
              className={`card border-2 border-dashed cursor-pointer transition-all duration-300 min-h-64 flex flex-col items-center justify-center gap-4
                ${isDragActive ? 'border-cyan bg-cyan/5 scale-[1.02]' : 'border-border hover:border-cyan/50 hover:bg-surface-hover/30'}`}>
              <input {...getInputProps()} />
              <motion.div animate={isDragActive ? { scale: 1.2 } : { scale: 1 }}
                className="w-20 h-20 rounded-2xl bg-cyan/10 flex items-center justify-center">
                <Upload className={`w-10 h-10 ${isDragActive ? 'text-cyan' : 'text-text-muted'}`} />
              </motion.div>
              <div className="text-center">
                <p className="font-semibold text-text-primary mb-1">{isDragActive ? 'Drop your audio' : 'Drag & drop audio file'}</p>
                <p className="text-sm text-text-muted">or click to browse</p>
                <p className="text-xs text-text-disabled mt-2">MP3 · WAV · OGG · M4A · FLAC · Max 50MB</p>
              </div>
              <WaveformVisualizer playing={false} />
            </div>
          ) : (
            <div className="card space-y-5">
              <div className="p-4 rounded-xl bg-surface-active border border-border">
                <WaveformVisualizer playing={playing} />
                <audio ref={audioRef} onEnded={() => setPlaying(false)} className="hidden" />
                <div className="flex items-center gap-4 mt-4">
                  <button onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors flex-shrink-0">
                    {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-secondary font-medium truncate">{file.name}</p>
                    <p className="text-xs text-text-muted">{formatFileSize(file.size)}</p>
                  </div>
                  <button onClick={reset} className="text-text-muted hover:text-rose p-2 rounded-lg hover:bg-rose/10 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={reset} className="btn-ghost flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" /> New File
                </button>
                <button onClick={handleDetect} disabled={loading}
                  className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
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
                      className="h-full rounded-full bg-gradient-to-r from-cyan to-primary" />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-text-primary mb-4">Audio Signals</h3>
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
              className="card flex flex-col items-center justify-center py-20 text-center h-full">
              <div className="w-20 h-20 rounded-2xl bg-cyan/10 flex items-center justify-center mx-auto mb-4 animate-float">
                <Mic className="w-10 h-10 text-cyan" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">Upload Audio</h3>
              <p className="text-text-muted text-sm max-w-xs">Drop a voice recording or audio clip to scan for TTS synthesis and voice cloning artifacts</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
