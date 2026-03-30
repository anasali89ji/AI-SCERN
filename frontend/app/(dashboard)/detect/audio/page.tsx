'use client'
export const dynamic = 'force-dynamic'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Upload, X, AlertTriangle, CheckCircle, HelpCircle, Loader2, RotateCcw, Play, Pause, Download } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence, formatFileSize } from '@/lib/utils/helpers'
import { SignupGate, incrementGlobalScanCount } from '@/components/SignupGate'
import { ReviewSuggestion } from '@/components/ReviewSuggestion'
import { FeedbackBar } from '@/components/FeedbackBar'



const verdictConfig = {
  AI:        { icon: AlertTriangle, color: 'text-rose',    border: 'border-rose/30',    bg: 'bg-rose/5',    label: 'AI GENERATED VOICE' },
  HUMAN:     { icon: CheckCircle,  color: 'text-emerald', border: 'border-emerald/30', bg: 'bg-emerald/5', label: 'AUTHENTIC HUMAN VOICE' },
  UNCERTAIN: { icon: HelpCircle,   color: 'text-amber',   border: 'border-amber/30',   bg: 'bg-amber/5',   label: 'UNCERTAIN' },
}

const WAVE_HEIGHTS = Array.from({ length: 40 }, (_, i) => 6 + Math.sin(i * 0.8) * 14 + Math.cos(i * 0.3) * 10)
const WAVE_DURATIONS = Array.from({ length: 40 }, (_, i) => 0.45 + (i % 7) * 0.08)

function WaveformVisualizer({ playing, progress = 0 }: { playing: boolean; progress?: number }) {
  return (
    <div className="flex items-center justify-center gap-0.5 h-14 relative overflow-hidden rounded-xl">
      {/* Progress overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to right, transparent ${progress * 100}%, rgba(0,0,0,0.4) ${progress * 100}%)` }} />
      {Array.from({ length: 40 }).map((_, i) => (
        <motion.div key={i}
          className="w-1 rounded-full shrink-0"
          style={{ background: i < progress * 40 ? '#8b5cf6' : '#4c1d95' }}
          animate={playing ? { height: [3, WAVE_HEIGHTS[i], 3] } : { height: 3 }}
          transition={{ duration: WAVE_DURATIONS[i], repeat: playing ? Infinity : 0, ease: 'easeInOut', delay: i * 0.025 }}
        />
      ))}
    </div>
  )
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60); const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AudioDetectionPage() {
  const { user: currentUser } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => { setCurrentTime(audio.currentTime); setProgress(audio.currentTime / (audio.duration || 1)) }
    const onLoad = () => setDuration(audio.duration)
    const onEnd  = () => { setPlaying(false); setProgress(0) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onLoad)
    audio.addEventListener('ended', onEnd)
    return () => { audio.removeEventListener('timeupdate', onTime); audio.removeEventListener('loadedmetadata', onLoad); audio.removeEventListener('ended', onEnd) }
  }, [file])

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]; if (!f) return
    setFile(f); setResult(null); setError(null); setProgress(0); setCurrentTime(0); setDuration(0); setPlaying(false)
    if (audioRef.current) { audioRef.current.src = URL.createObjectURL(f) }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'] },
    maxSize: 50 * 1024 * 1024, multiple: false,
    onDropRejected: () => setError('Invalid file. Use MP3, WAV, OGG, M4A, FLAC or AAC under 50MB.')
  })

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = pct * duration
    setProgress(pct)
  }

  const handleDetect = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3'
      let r2Key: string | null = null

      // Try R2 presigned upload first
      try {
        const presignRes = await fetch('/api/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type || `audio/${ext}`, fileSize: file.size, mediaType: 'audio' }),
        })
        const presignData = await presignRes.json()
        if (presignData.success && presignData.uploadUrl) {
          await fetch(presignData.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || `audio/${ext}` }, body: file })
          r2Key = presignData.key
        }
      } catch { /* fallback to direct upload */ }

      let res: Response
      if (r2Key) {
        res = await fetch('/api/detect/audio', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ r2Key, fileName: file.name, fileSize: file.size, format: ext }),
        })
      } else {
        const formData = new FormData(); formData.append('file', file)
        res = await fetch('/api/detect/audio', { method: 'POST', body: formData })
      }

      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || 'Detection failed')
      setResult(data.result)
      setScanId(data.scan_id ?? null)
      incrementGlobalScanCount()
      window.dispatchEvent(new Event('aiscern:scan'))
      // FIX: removed duplicate supabase.from('scans').insert() — API route already saves
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Detection failed') }
    finally { setLoading(false) }
  }

  const exportReport = () => {
    if (!result || !file) return
    const text = `Aiscern Audio Analysis Report\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nFile: ${file.name}\nSize: ${formatFileSize(file.size)}${duration ? `\nDuration: ${formatDuration(duration)}` : ''}\n\nVerdict: ${result.verdict}\nConfidence: ${result.confidence}%\nSummary: ${result.summary}\n\nSignals:\n${result.signals.map((s: any) => `  • ${s.name} — ${s.weight}%`).join('\n')}\n\nModel: ${result.model_used}\nAnalyzed: ${new Date().toLocaleString()}`
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `aiscern-audio-${Date.now()}.txt`; a.click()
  }

  const reset = () => { setFile(null); setResult(null); setError(null); setPlaying(false); setProgress(0); setDuration(0); setCurrentTime(0) }
  const cfg = result ? verdictConfig[result.verdict as Verdict] : null

  return (
    <>
    <SignupGate />
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <audio ref={audioRef} className="hidden" />
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan/10 flex items-center justify-center shrink-0">
            <Mic className="w-6 h-6 text-cyan" />
          </div>
          Audio Detection
        </h1>
        <p className="text-text-muted ml-14 text-sm">Voice synthesis detection · Spectral analysis · Prosody patterns · TTS artifacts</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
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
                <p className="font-semibold text-text-primary mb-1">{isDragActive ? 'Drop audio here' : 'Drag & drop audio file'}</p>
                <p className="text-sm text-text-muted">or click to browse</p>
                <p className="text-xs text-text-disabled mt-2">MP3 · WAV · OGG · M4A · FLAC · AAC · Max 50MB</p>
              </div>
              <WaveformVisualizer playing={false} />
            </div>
          ) : (
            <div className="card space-y-4">
              <div className="p-4 rounded-xl bg-surface-active border border-border">
                <WaveformVisualizer playing={playing} progress={progress} />

                {/* Seek bar */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-text-muted w-10 shrink-0 tabular-nums">{formatDuration(currentTime)}</span>
                  <div className="flex-1 h-1.5 bg-border rounded-full cursor-pointer overflow-hidden" onClick={seekTo}>
                    <div className="h-full bg-gradient-to-r from-cyan to-primary rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <span className="text-xs text-text-muted w-10 shrink-0 tabular-nums text-right">{formatDuration(duration)}</span>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <button onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan to-primary flex items-center justify-center hover:opacity-90 transition-opacity shrink-0 shadow-lg shadow-cyan/20">
                    {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-secondary font-medium truncate">{file.name}</p>
                    <p className="text-xs text-text-muted">
                      {formatFileSize(file.size)}
                      {duration > 0 && ` · ${formatDuration(duration)}`}
                    </p>
                  </div>
                  <button onClick={reset} className="text-text-muted hover:text-rose p-2 rounded-lg hover:bg-rose/10 transition-colors shrink-0">
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
                  {loading ? 'Analyzing…' : 'Detect'}
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
        </div>

        <AnimatePresence mode="wait">
          {result && cfg ? (
            <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className={`card border ${cfg.border} ${cfg.bg}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
                    <cfg.icon className={`w-7 h-7 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-xl font-black ${cfg.color} mb-1`}>{cfg.label}</h3>
                    <p className="text-text-muted text-sm leading-relaxed">{result.summary}</p>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex justify-between text-xs text-text-muted mb-2">
                    <span>Confidence</span>
                    <span className={`font-black text-xl ${cfg.color}`}>{formatConfidence(result.confidence)}</span>
                  </div>
                  <div className="h-3 bg-border rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-cyan to-primary" />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan" />
                  Audio Signals ({result.signals.length})
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
                            className={`h-full rounded-full ${s.flagged ? 'bg-rose' : 'bg-cyan'}`} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Segment timeline */}
              {result.segment_scores && result.segment_scores.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-cyan" />
                    Audio Segment Analysis
                  </h3>
                  <div className="space-y-1.5">
                    {result.segment_scores.map((seg: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-text-muted w-16 shrink-0 font-mono">
                          {seg.start_sec}s – {seg.end_sec}s
                        </span>
                        <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${seg.ai_score > 0.62 ? 'bg-rose' : seg.ai_score > 0.38 ? 'bg-amber' : 'bg-emerald'}`}
                            style={{ width: `${Math.round(seg.ai_score * 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold w-10 text-right ${seg.ai_score > 0.62 ? 'text-rose' : seg.ai_score > 0.38 ? 'text-amber' : 'text-emerald'}`}>
                          {Math.round(seg.ai_score * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose" />AI-synthetic</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber" />Uncertain</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald" />Authentic</span>
                  </div>
                </div>
              )}

              <div className="card py-3 px-4 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-text-muted font-mono truncate">{result.model_used} · {result.processing_time}ms</span>
                <button onClick={exportReport} className="text-xs btn-ghost py-1.5 px-3 flex items-center gap-1.5 shrink-0">
                  <Download className="w-3.5 h-3.5" /> Export Report
                </button>
              </div>
            </motion.div>
          ) : !loading && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="card flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-2xl bg-cyan/10 flex items-center justify-center mx-auto mb-4 animate-float">
                <Mic className="w-10 h-10 text-cyan" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">Upload Audio</h3>
              <p className="text-text-muted text-sm max-w-xs">Drop a voice recording to scan for TTS synthesis and voice cloning artifacts</p>
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-text-muted w-full max-w-xs">
                {['Prosody analysis', 'Spectral fingerprint', 'TTS artifact detection', 'Voice cloning'].map(f => (
                  <div key={f} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-active/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan/60 shrink-0" />{f}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    <div className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto pb-6">
      
      <ReviewSuggestion toolName="Audio Detector" />
      {result && <div className="px-4 pb-4"><FeedbackBar scanId={scanId} verdict={result.verdict} /></div>}
    </div>
    </>
  )
}