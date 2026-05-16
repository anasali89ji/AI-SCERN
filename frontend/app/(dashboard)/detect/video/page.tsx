'use client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MobileResultSheet } from '@/components/MobileResultSheet'
import { useState, useCallback, useRef, useEffect } from 'react'
import { toUserError } from '@/lib/utils/user-errors'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Video, Upload, X, AlertTriangle, CheckCircle, HelpCircle,
  Loader2, RotateCcw, Play, Pause, Download, Info, Scan, Eye, Share2, Database } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence, formatFileSize } from '@/lib/utils/helpers'
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
import { SignupGate } from '@/components/SignupGate'



const verdictConfig = {
  AI:        { icon: AlertTriangle, color: 'text-rose',    border: 'border-rose/30',    bg: 'bg-rose/5',    label: 'DEEPFAKE / AI DETECTED' },
  HUMAN:     { icon: CheckCircle,  color: 'text-emerald', border: 'border-emerald/30', bg: 'bg-emerald/5', label: 'AUTHENTIC VIDEO' },
  UNCERTAIN: { icon: HelpCircle,   color: 'text-amber',   border: 'border-amber/30',   bg: 'bg-amber/5',   label: 'UNCERTAIN' },
}

// Sample 6 frames spread across the video at 0%, 12%, 28%, 46%, 68%, 90%
const FRAME_POSITIONS = [0.00, 0.12, 0.28, 0.46, 0.68, 0.90]
const FRAME_QUALITY   = 0.85
const CANVAS_WIDTH    = 640
const CANVAS_HEIGHT   = 360

interface ExtractedFrame {
  base64:  string
  index:   number
  timeSec: number
  preview: string  // data URL for UI display
}

function formatDur(s: number) {
  if (!s || isNaN(s)) return '--:--'
  const m = Math.floor(s / 60); const ss = Math.floor(s % 60)
  return `${m}:${ss.toString().padStart(2, '0')}`
}

// Inline canvas frame extraction — no ffmpeg needed
async function extractFrames(
  videoEl: HTMLVideoElement,
  duration: number,
  onProgress: (n: number, total: number) => void,
): Promise<ExtractedFrame[]> {
  const canvas  = document.createElement('canvas')
  canvas.width  = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const ctx     = canvas.getContext('2d')!
  const frames: ExtractedFrame[] = []

  for (let i = 0; i < FRAME_POSITIONS.length; i++) {
    const timeSec = Math.max(0, Math.min(duration - 0.1, FRAME_POSITIONS[i] * duration))
    onProgress(i, FRAME_POSITIONS.length)

    await new Promise<void>((resolve) => {
      // Use resolve-only — reject causes whole extraction to fail for one bad frame
      const timeout = setTimeout(() => resolve(), 5000)  // 5s timeout per frame, then skip
      videoEl.onseeked = () => { clearTimeout(timeout); resolve() }
      videoEl.onerror  = () => { clearTimeout(timeout); resolve() }  // skip bad frames
      videoEl.currentTime = timeSec
    })

    ctx.drawImage(videoEl, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    const dataUrl = canvas.toDataURL('image/jpeg', FRAME_QUALITY)
    const base64  = dataUrl.split(',')[1]  // strip data:image/jpeg;base64,

    frames.push({ base64, index: i, timeSec: Math.round(timeSec * 10) / 10, preview: dataUrl })
  }

  return frames
}

function FrameStrip({
  frames,
  frameScores,
}: {
  frames: ExtractedFrame[]
  frameScores?: { frame: number; time_sec: number; ai_score: number; face_detected?: boolean }[]
}) {
  if (!frames.length) return null

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-muted font-medium">Extracted Frames ({frames.length})</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {frames.map((f, i) => {
          const score = frameScores?.find(fs => fs.frame === f.index)
          const isSuspicious = score && score.ai_score > 0.55
          return (
            <div key={i} className="relative group">
              <div className={`relative rounded-lg overflow-hidden border-2 transition-all
                ${isSuspicious ? 'border-rose/50' : 'border-emerald/30'}`}>
                <img src={f.preview} alt={`Frame ${i + 1}`} className="w-full h-10 object-cover" />
                {score?.face_detected && (
                  <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-blue-400" title="Face detected" />
                )}
              </div>
              <div className="flex justify-between items-center mt-0.5 px-0.5">
                <span className="text-[9px] text-text-disabled">{formatDur(f.timeSec)}</span>
                {score && (
                  <span className={`text-[9px] font-bold ${isSuspicious ? 'text-rose' : 'text-emerald'}`}>
                    {Math.round(score.ai_score * 100)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose/60" />Suspicious frame
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald/60" />Clean frame
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400" />Face detected
        </span>
      </div>
    </div>
  )
}

function VideoDetectionPage() {
  const { user: currentUser } = useAuth()
  const displayName: string | null =
    currentUser?.displayName?.split(' ')[0] ||
    currentUser?.email?.split('@')[0] ||
    null
  const [file,        setFile]        = useState<File | null>(null)
  const [_preview, setPreview] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState<DetectionResult | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [playing,     setPlaying]     = useState(false)
  const [progress,    setProgress]    = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [scanId,      setScanId]      = useState<string | null>(null)

  const shareResult = async () => {
    if (!scanId) return
    try {
      await fetch(`/api/scan/${scanId}/share`, { method: 'POST' })
      await navigator.clipboard.writeText(`${window.location.origin}/scan/${scanId}`)
      alert('Share link copied to clipboard!')
    } catch { alert('Could not copy link. Try again.') }
  }
  const [phase,       setPhase]       = useState<'idle' | 'extracting' | 'analyzing'>('idle')
  const [framesDone,  setFramesDone]  = useState(0)
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([])
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const v = videoRef.current; if (!v) return
    const onTime = () => { setCurrentTime(v.currentTime); setProgress(v.currentTime / (v.duration || 1)) }
    const onMeta = () => setDuration(v.duration)
    const onEnd  = () => { setPlaying(false); setProgress(0) }
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('ended', onEnd)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('ended', onEnd)
    }
  }, [file])

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]; if (!f) return
    setFile(f); setResult(null); setError(null); setProgress(0)
    setCurrentTime(0); setDuration(0); setPlaying(false); setExtractedFrames([])
    const url = URL.createObjectURL(f)
    setPreview(url)
    if (videoRef.current) videoRef.current.src = url
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.webm', '.mov', '.avi', '.mkv'] },
    maxSize: 100 * 1024 * 1024,
    multiple: false,
    onDropRejected: () => setError('Invalid file. Use MP4, WEBM, MOV or AVI under 100MB.'),
  })

  const togglePlay = () => {
    if (!videoRef.current) return
    if (playing) { videoRef.current.pause(); setPlaying(false) }
    else { videoRef.current.play(); setPlaying(true) }
  }

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  const handleDetect = async () => {
    if (!file || !videoRef.current) return
    setLoading(true); setError(null); setResult(null); setExtractedFrames([])

    try {
      const vid = videoRef.current
      const dur = vid.duration || duration

      // Phase 1: extract frames in browser
      setPhase('extracting')
      let frames: ExtractedFrame[] = []

      if (dur > 0.5) {
        try {
          frames = await extractFrames(vid, dur, (n, total) => setFramesDone(n + 1))
          setExtractedFrames(frames)
        } catch (frameErr) {
          // Frame extraction failed (e.g. Firefox seek issue) — continue without frames
          console.warn('[VideoDetection] Frame extraction failed:', frameErr)
          setError('Frame extraction failed — analysis will use file metadata only. For best results use Chrome/Edge.')
          frames = []
        }
      }

      // Phase 2: send to API
      setPhase('analyzing')
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'

      const res = await fetch('/api/detect/video', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          frames:   frames.map(f => ({ base64: f.base64, index: f.index, timeSec: f.timeSec })),
          fileName: file.name,
          fileSize: file.size,
          format:   ext,
        }),
      })

      const data = await res.json()
      if (!data.success) throw new Error(toUserError(data.error?.code, data.error?.message))
      setResult(data.result); setShowMobileResult(true)
      setScanId(data.scan_id ?? null)
      window.dispatchEvent(new CustomEvent('aiscern:scan-saved'))
    } catch (e: unknown) {
      setError(e instanceof Error ? toUserError(undefined, e.message) : toUserError())
    } finally {
      setLoading(false); setPhase('idle'); setFramesDone(0)
    }
  }

  const exportReport = () => {
    if (!result || !file) return
    const frameTable = result.frame_scores?.map(fs =>
      `  Frame ${fs.frame} @ ${fs.time_sec}s → ${Math.round(fs.ai_score * 100)}% AI${(fs as any).face_detected ? ' [face]' : ''}`
    ).join('\n') ?? ''

    const text = [
      'Aiscern Video Analysis Report',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `File:       ${file.name}`,
      `Size:       ${formatFileSize(file.size)}`,
      duration > 0 ? `Duration:   ${formatDur(duration)}` : '',
      `Frames:     ${extractedFrames.length} extracted`,
      '',
      `Verdict:    ${result.verdict}`,
      `Confidence: ${Math.round(result.confidence * 100)}%`,
      `Engine:     Aiscern Detection Engine`,
      '',
      `Summary:    ${result.summary}`,
      '',
      'Detection Signals:',
      result.signals.map(s => `  • ${s.name} — ${s.weight}%${s.flagged ? ' ⚠ flagged' : ''}`).join('\n'),
      '',
      frameTable ? 'Per-Frame Scores:\n' + frameTable : '',
      '',
      `Analyzed: ${new Date().toLocaleString()}`,
    ].filter(l => l !== undefined).join('\n')

    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    a.download = `aiscern-video-${Date.now()}.txt`; a.click()
  }

  const reset = () => {
    setFile(null); setPreview(null); setResult(null); setError(null)
    setPlaying(false); setProgress(0); setDuration(0); setCurrentTime(0)
    setExtractedFrames([]); setPhase('idle')
  }

  const cfg = result ? verdictConfig[result.verdict as Verdict] : null

  const loadingLabel = phase === 'extracting'
    ? `Extracting frame ${framesDone} of ${FRAME_POSITIONS.length}…`
    : phase === 'analyzing'
    ? 'Analyzing frames for deepfake artifacts…'
    : 'Analyzing…'

  return (
    <>
    <SignupGate />
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
            <Video className="w-6 h-6 text-secondary" />
          </div>
          Video Detection
        </h1>
        <p className="text-text-muted ml-14 text-sm">
          Browser frame extraction · Advanced vision analysis per-frame · Temporal consistency analysis
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Left: Upload + Video Player */}
        <div className="space-y-4">
          {!file ? (
            typeof window !== 'undefined' && 'ontouchstart' in window ? (
              // FIX B.4: Mobile tap-to-upload
              <label className="flex flex-col items-center gap-3 card border-2 border-dashed border-secondary/30 bg-secondary/5 rounded-2xl py-10 cursor-pointer active:scale-95 transition-transform min-h-[180px] justify-center">
                <div className="w-16 h-16 rounded-2xl bg-secondary/15 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-secondary" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-secondary text-base">Tap to Choose Video File</p>
                  <p className="text-xs text-text-muted mt-1">MP4 · WEBM · MOV · AVI · Max 100MB</p>
                </div>
                <input type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onDrop([f]) }} />
              </label>
            ) : (
            <div {...getRootProps()}
              className={`card border-2 border-dashed cursor-pointer transition-all duration-300 min-h-[180px] sm:min-h-[260px] flex flex-col items-center justify-center gap-4
                ${isDragActive ? 'border-secondary bg-secondary/5 scale-[1.02]' : 'border-border hover:border-secondary/50 hover:bg-surface-hover/30'}`}>
              <input {...getInputProps()} />
              <motion.div animate={isDragActive ? { scale: 1.2 } : { scale: 1 }}
                className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center">
                <Upload className={`w-10 h-10 ${isDragActive ? 'text-secondary' : 'text-text-muted'}`} />
              </motion.div>
              <div className="text-center">
                <p className="font-semibold text-text-primary mb-1">{isDragActive ? 'Drop video here' : 'Drag & drop a video'}</p>
                <p className="text-sm text-text-muted">or click to browse</p>
                <p className="text-xs text-text-disabled mt-2">MP4 · WEBM · MOV · AVI · Max 100MB</p>
              </div>
            </div>
            )
          ) : (
            <div className="card space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video ref={videoRef} className="w-full max-h-64 object-contain" onEnded={() => setPlaying(false)} />

                {loading ? (
                  <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center gap-3">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-2 border-secondary/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-t-secondary animate-spin" />
                      <div className="absolute inset-2 bg-secondary/10 rounded-full flex items-center justify-center">
                        {phase === 'extracting' ? <Scan className="w-5 h-5 text-secondary" /> : <Eye className="w-5 h-5 text-secondary" />}
                      </div>
                    </div>
                    <p className="text-sm text-secondary font-semibold">{loadingLabel}</p>
                    {phase === 'extracting' && (
                      <div className="flex gap-1 mt-1">
                        {FRAME_POSITIONS.map((_, i) => (
                          <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300
                            ${i < framesDone ? 'bg-secondary' : 'bg-secondary/20'}`} />
                        ))}
                      </div>
                    )}
                    {phase === 'analyzing' && (
                      <p className="text-xs text-text-muted animate-pulse">Analyzing {extractedFrames.length} frames for deepfake artifacts…</p>
                    )}
                  </div>
                ) : (
                  <button onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/40 transition-colors group">
                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {playing ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
                    </div>
                  </button>
                )}
              </div>

              {/* Seek bar */}
              <div className="px-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted w-10 shrink-0 tabular-nums">{formatDur(currentTime)}</span>
                  <div className="flex-1 h-1.5 bg-border rounded-full cursor-pointer overflow-hidden" onClick={seekTo}>
                    <div className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all"
                      style={{ width: `${progress * 100}%` }} />
                  </div>
                  <span className="text-xs text-text-muted w-10 shrink-0 tabular-nums text-right">{formatDur(duration)}</span>
                </div>
              </div>

              {/* File info */}
              <div className="flex items-center justify-between px-1">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-text-secondary font-medium truncate">{file.name}</p>
                  <p className="text-[10px] sm:text-xs text-text-muted">{formatFileSize(file.size)}{duration > 0 ? ` · ${formatDur(duration)}` : ''}</p>
                </div>
                <button onClick={reset} className="text-text-muted hover:text-rose p-2 rounded-lg hover:bg-rose/10 transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Extracted frames strip */}
              {extractedFrames.length > 0 && (
                <FrameStrip frames={extractedFrames} frameScores={result?.frame_scores} />
              )}

              <div className="flex gap-3">
                <button onClick={reset} className="btn-ghost flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" /> New Video
                </button>
                <button onClick={handleDetect} disabled={loading}
                  className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                  {loading ? loadingLabel.split('…')[0] + '…' : 'Analyze Video'}
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

          <div className="card py-3 px-4 border-border/50">
            <div className="flex items-start gap-2 text-xs text-text-muted">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-secondary/60" />
              <span>
                <span className="text-text-secondary font-medium">How it works:</span> Your browser extracts {FRAME_POSITIONS.length} frames directly from the video,
                then Aiscern's vision engine analyzes each frame for deepfake artifacts. No video data is stored.
              </span>
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <AnimatePresence mode="wait">
          {result && cfg ? (
            <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-4 w-full min-w-0">
              {/* Verdict card */}
              <div className={`card border ${cfg.border} ${cfg.bg} w-full min-w-0`}>
                {displayName && (
                  <div className="mb-3 text-xs font-medium text-text-muted">
                    Hey <span className="text-text-primary font-semibold">{displayName}</span>, here's what we found
                    {file ? <> for <span className="text-text-primary font-medium">"{file.name}"</span></> : null}:
                  </div>
                )}
                <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
                    <cfg.icon className={`w-5 h-5 sm:w-7 sm:h-7 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-base sm:text-xl font-black ${cfg.color} mb-1 leading-tight`}>
                      {displayName
                        ? result.verdict === 'AI' ? `${displayName}, this video is AI Generated`
                          : result.verdict === 'HUMAN' ? `${displayName}, this is an Authentic Video`
                          : `${displayName}, this video is Uncertain`
                        : cfg.label}
                    </h3>
                    <p className="text-text-muted text-sm leading-relaxed">{result.summary}</p>
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-text-muted mb-2 gap-2">
                    <span className="shrink-0">Confidence</span>
                    <span className={`font-black text-base sm:text-xl ${cfg.color} tabular-nums shrink-0`}>{formatConfidence(result.confidence)}</span>
                  </div>
                  <div className="h-2.5 sm:h-3 bg-border rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence * 100}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-secondary to-primary" />
                  </div>
                </div>

                {/* Frame timeline */}
                {result.frame_scores && result.frame_scores.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-text-muted mb-2 font-medium">Per-Frame AI Probability Timeline</p>
                    <div className="flex items-end gap-1 h-12">
                      {result.frame_scores.map((fs, i) => (
                        <motion.div key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(8, fs.ai_score * 100)}%` }}
                          transition={{ delay: i * 0.08, duration: 0.5, ease: 'easeOut' }}
                          title={`${fs.time_sec}s — ${Math.round(fs.ai_score * 100)}% AI${(fs as any).face_detected ? ' [face]' : ''}`}
                          className={`flex-1 rounded-sm transition-all ${
                            fs.ai_score > 0.62 ? 'bg-rose' :
                            fs.ai_score > 0.45 ? 'bg-amber' : 'bg-emerald'
                          }`} />
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-text-disabled mt-1">
                      <span>0s</span>
                      <span>{duration > 0 ? formatDur(duration) : '—'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Detection signals */}
              <div className="card">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  Detection Signals ({result.signals.length})
                </h3>
                <div className="space-y-2.5 max-h-[280px] sm:max-h-none overflow-y-auto sm:overflow-visible pr-0.5 sm:pr-0">
                  {result.signals.map((s, i) => (
                    <motion.div key={s.name}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, ease: 'easeOut' }}
                      className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-surface-active/50 border border-border/50 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${s.flagged ? 'bg-rose' : 'bg-emerald'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1 gap-2">
                          <span className="text-xs sm:text-sm text-text-secondary font-medium truncate">{s.name}</span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0
                            ${s.flagged ? 'bg-rose/15 text-rose' : 'bg-emerald/15 text-emerald'}`}>
                            {s.weight}%
                          </span>
                        </div>
                        <p className="text-xs text-text-muted truncate">{s.description}</p>
                        <div className="h-1 bg-border rounded-full mt-1.5 overflow-hidden">
                          <motion.div initial={{ width: 0 }}
                            animate={{ width: `${Math.round(s.value * 100)}%` }}
                            transition={{ delay: i * 0.06 + 0.3, duration: 0.5 }}
                            className={`h-full rounded-full ${s.flagged ? 'bg-rose' : 'bg-emerald'}`} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="card py-3 px-4 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-text-muted font-mono truncate">
                  {result.processing_time}ms
                </span>
                <button onClick={exportReport} className="text-xs btn-ghost py-1.5 px-3 flex items-center gap-1.5 shrink-0">
                  <Download className="w-3.5 h-3.5" /> Export Report
                </button>
              </div>
            </motion.div>
          ) : !loading && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="card flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-4 animate-float">
                <Video className="w-10 h-10 text-secondary" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">Upload a Video</h3>
              <p className="text-text-muted text-sm max-w-xs">
                Your browser extracts frames, Aiscern analyzes each one for deepfake artifacts
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-text-muted w-full max-w-xs">
                {[
                  'Browser frame extraction',
                  'Aiscern vision engine',
                  'Face detection per frame',
                  'Temporal consistency check',
                  'Per-frame confidence scores',
                  'Real deepfake detection',
                ].map(f => (
                  <div key={f} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-active/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary/60 shrink-0" />{f}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    <div className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto pb-6">
      
      <LazyReviewSuggestion toolName="Video Detector" />
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
        <details className="card mt-2 mx-4 mb-4">
          <summary className="cursor-pointer text-sm font-semibold text-text-secondary flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Detection Models &amp; Datasets
          </summary>
          <div className="mt-3 space-y-2 text-xs text-text-muted">
            <p><span className="text-text-secondary font-medium">Engine</span> Aiscern Detection Engine</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {[
                { name: 'FakeAVCeleb v1.2', desc: 'Purdue-M multimodal deepfake dataset', url: 'https://huggingface.co/datasets/Purdue-M/FakeAVCeleb_v1.2' },
                { name: 'DFDC Dataset', desc: 'Meta DeepFake Detection Challenge', url: 'https://ai.meta.com/datasets/dfdc/' },
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
    {/* FIX B.3: MobileResultSheet — bottom sheet for detection result on mobile */}
    <MobileResultSheet isOpen={showMobileResult} onClose={() => setShowMobileResult(false)} title="Detection Result">
      {result && (
        <div className="space-y-4 pb-4">
          <div className={`card border ${result.verdict === 'AI' ? 'border-amber/30 bg-amber/5' : result.verdict === 'HUMAN' ? 'border-emerald/30 bg-emerald/5' : 'border-amber/20 bg-amber/5'} p-4 rounded-2xl`}>
            <p className="font-black text-xl">{result.verdict === 'AI' ? '🤖 AI Generated' : result.verdict === 'HUMAN' ? '✅ Human' : '⚠️ Uncertain'}</p>
            <p className="text-text-muted text-sm mt-1">{Math.round(result.confidence_pct ?? (result.confidence <= 1 ? result.confidence * 100 : result.confidence))}% confidence</p>
            {result.summary && <p className="text-sm mt-2 text-text-secondary">{result.summary}</p>}
          </div>
        </div>
      )}
    </MobileResultSheet>
  </>
  )
}
export default function VideoDetectionPageWrapper() {
  return <ErrorBoundary><VideoDetectionPage /></ErrorBoundary>
}
