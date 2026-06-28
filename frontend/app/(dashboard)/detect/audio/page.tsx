'use client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MobileResultSheet } from '@/components/MobileResultSheet'
import { useState, useCallback, useRef, useEffect } from 'react'
import { toUserError } from '@/lib/utils/user-errors'
import { useDropzone } from 'react-dropzone'
import { uploadToR2WithProgress } from '@/lib/storage/upload-with-progress'
import { Mic, Upload, X, AlertTriangle, Loader2, RotateCcw, Play, Pause, Download, Share2, Info, Database } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import type { DetectionResult, Verdict } from '@/types'
import { formatConfidence, formatFileSize, normalizeConfidence } from '@/lib/utils/helpers'
import dynamic from 'next/dynamic'
import { verdictConfig as baseVerdictConfig } from '@/lib/ui/verdict-config'

// ── Post-scan components — loaded only after a result arrives ─────────────────
const LazyReviewSuggestion = dynamic(
  () => import('@/components/ReviewSuggestion').then(m => ({ default: m.ReviewSuggestion })),
  { ssr: false }
)
const LazyFeedbackBar = dynamic(
  () => import('@/components/FeedbackBar').then(m => ({ default: m.FeedbackBar })),
  { ssr: false }
)
import { SignupGate, incrementGlobalScanCount } from '@/components/SignupGate'



const verdictConfig = {
  AI:        { ...baseVerdictConfig.AI,        label: 'AI GENERATED VOICE' },
  HUMAN:     { ...baseVerdictConfig.HUMAN,     label: 'AUTHENTIC HUMAN VOICE' },
  UNCERTAIN: { ...baseVerdictConfig.UNCERTAIN },
}

const WAVE_HEIGHTS = Array.from({ length: 40 }, (_, i) => 6 + Math.sin(i * 0.8) * 14 + Math.cos(i * 0.3) * 10)
const WAVE_DURATIONS = Array.from({ length: 40 }, (_, i) => 0.45 + (i % 7) * 0.08)

function WaveformVisualizer({ playing, progress = 0 }: { playing: boolean; progress?: number }) {

  return (
    <div className="flex items-center justify-center gap-0.5 h-14 relative overflow-hidden rounded-xl">
      {/* Progress overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to right, transparent ${progress * 100}%, rgba(0,0,0,0.4) ${progress * 100}%)` }} />
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i} className="w-1 rounded-full shrink-0 bg-[#2BEE34]/60"
          style={{ height: `${20 + Math.sin(i * 0.8) * 15 + Math.cos(i * 0.4) * 10}px` }} />
      ))}
    </div>
  )
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60); const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function AudioDetectionPage() {
  const { user: currentUser } = useAuth()
  const displayName: string | null =
    currentUser?.displayName?.split(' ')[0] ||
    currentUser?.email?.split('@')[0] ||
    null
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [_uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [showMobileResult, setShowMobileResult] = useState(false)
  const [scanId, setScanId] = useState<string | null>(null)

  const shareResult = async () => {
    if (!scanId) return
    try {
      await fetch(`/api/scan/${scanId}/share`, { method: 'POST' })
      await navigator.clipboard.writeText(`${window.location.origin}/scan/${scanId}`)
      alert('Share link copied to clipboard!')
    } catch { alert('Could not copy link. Try again.') }
  }
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
          setUploadProgress(0)
          await uploadToR2WithProgress(presignData.uploadUrl, file, setUploadProgress)
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
      if (!data.success) throw new Error(toUserError(data.error?.code, data.error?.message))
      setResult(data.result); setShowMobileResult(true)
      setScanId(data.scan_id ?? null)
      window.dispatchEvent(new CustomEvent('aiscern:scan-saved'))
      incrementGlobalScanCount()
      window.dispatchEvent(new Event('aiscern:scan'))
      // FIX: removed duplicate supabase.from('scans').insert() — API route already saves
    } catch (e: unknown) { setError(e instanceof Error ? toUserError(undefined, e.message) : toUserError()) }
    finally { setLoading(false) }
  }

  const exportReport = () => {
    if (!result || !file) return
    const text = `Aiscern Audio Analysis Report\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nFile: ${file.name}\nSize: ${formatFileSize(file.size)}${duration ? `\nDuration: ${formatDuration(duration)}` : ''}\n\nVerdict: ${result.verdict}\nConfidence: ${formatConfidence(result.confidence)}\nSummary: ${result.summary}\n\nSignals:\n${result.signals.map((s: any) => `  • ${s.name} — ${s.weight}%`).join('\n')}\n\nEngine: Aiscern Detection Engine\nAnalyzed: ${new Date().toLocaleString()}`
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `aiscern-audio-${Date.now()}.txt`; a.click()
  }

  const reset = () => { setFile(null); setResult(null); setError(null); setPlaying(false); setProgress(0); setDuration(0); setCurrentTime(0) }
  const cfg = result ? verdictConfig[result.verdict as Verdict] : null

  return (
    <>
    {/* Screen reader announcement of analysis results */}
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {result && `Analysis complete. Verdict: ${verdictConfig[result.verdict as Verdict]?.label ?? result.verdict}. Confidence: ${formatConfidence(result.confidence)}.`}
    </div>
    <SignupGate />
    <div className="p-2 sm:p-4 lg:p-8 2xl:p-10 max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto">
      <audio ref={audioRef} className="hidden" />
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2BEE34]/10 flex items-center justify-center shrink-0">
            <Mic className="w-6 h-6 text-[#2BEE34]" />
          </div>
          Audio Detection
        </h1>
        <p className="text-[#6B6B6B] ml-14 text-sm">Voice synthesis detection · Spectral analysis · Prosody patterns · TTS artifacts</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
        <div className="space-y-4">
          {!file ? (
            typeof window !== 'undefined' && 'ontouchstart' in window ? (
              // FIX B.4: Mobile tap-to-upload (no drag zone on touch devices)
              <label className="flex flex-col items-center gap-3 card border-2 border-dashed border-[#2BEE34]/30 bg-[#2BEE34]/5 rounded-xl py-10 cursor-pointer  transition-transform min-h-[180px] justify-center">
                <div className="w-16 h-16 rounded-xl bg-[#2BEE34]/15 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-[#2BEE34]" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-[#2BEE34] text-base">Tap to Choose Audio File</p>
                  <p className="text-xs text-[#6B6B6B] mt-1">MP3 · WAV · OGG · M4A · FLAC · AAC · Max 50MB</p>
                </div>
                <input type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onDrop([f]) }} />
              </label>
            ) : (
            <div {...getRootProps()}
              className={`card border-2 border-dashed cursor-pointer transition-all duration-200 min-h-[180px] sm:min-h-[260px] flex flex-col items-center justify-center gap-4
                ${isDragActive ? 'border-[#2BEE34] bg-[#2BEE34]/5 ' : 'border-[#1E1E1E] hover:border-[#2BEE34]/50 hover:bg-[#141414]/30'}`}>
              <input {...getInputProps()} />
              <div className="w-20 h-20 rounded-xl bg-[#2BEE34]/10 flex items-center justify-center">
                <Upload className={`w-10 h-10 ${isDragActive ? 'text-[#2BEE34]' : 'text-[#6B6B6B]'}`} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-white mb-1">{isDragActive ? 'Drop audio here' : 'Drag & drop audio file'}</p>
                <p className="text-sm text-[#6B6B6B]">or click to browse</p>
                <p className="text-xs text-[#6B6B6B] mt-2">MP3 · WAV · OGG · M4A · FLAC · AAC · Max 50MB</p>
              </div>
              <WaveformVisualizer playing={false} />
            </div>
            )
          ) : (
            <div className="card space-y-4">
              <div className="p-4 rounded-xl bg-[#141414] border border-[#1E1E1E]">
                <WaveformVisualizer playing={playing} progress={progress} />

                {/* Seek bar */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-[#6B6B6B] w-10 shrink-0 tabular-nums">{formatDuration(currentTime)}</span>
                  <div className="flex-1 h-1.5 bg-[#1A1A1A] rounded-full cursor-pointer overflow-hidden" onClick={seekTo}>
                    <div className="h-full bg-[#2BEE34] rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <span className="text-xs text-[#6B6B6B] w-10 shrink-0 tabular-nums text-right">{formatDuration(duration)}</span>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <button onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-[#2BEE34] hover:bg-[#1A8F1F] flex items-center justify-center transition-colors shrink-0">
                    {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#A3A3A3] font-medium truncate">{file.name}</p>
                    <p className="text-xs text-[#6B6B6B]">
                      {formatFileSize(file.size)}
                      {duration > 0 && ` · ${formatDuration(duration)}`}
                    </p>
                  </div>
                  <button onClick={reset}
              title="Detect Another" className="text-[#6B6B6B] hover:text-[#FF4444] p-2 rounded-lg hover:bg-[#FF4444]/10 transition-colors shrink-0">
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
            <div className="card border-[#FF4444]/30 bg-[#FF4444]/5 flex items-center gap-2 text-[#FF4444] text-sm py-3">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        
          {result && cfg ? (
            <div className="space-y-4 w-full min-w-0">
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
                    <h3 className={`text-base sm:text-xl font-black ${cfg.color} mb-1 leading-tight`}>
                      {displayName
                        ? result.verdict === 'AI' ? `${displayName}, this audio is AI Generated`
                          : result.verdict === 'HUMAN' ? `${displayName}, this is an Authentic Human Voice`
                          : `${displayName}, this audio is Uncertain`
                        : cfg.label}
                    </h3>
                    <p className="text-[#6B6B6B] text-sm leading-relaxed">{result.summary}</p>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-[#6B6B6B] mb-2 gap-2">
                    <span className="shrink-0">Confidence</span>
                    <span className={`font-black text-base sm:text-xl ${cfg.color} tabular-nums shrink-0`}>{formatConfidence(result.confidence)}</span>
                  </div>
                  <div className="h-2.5 sm:h-3 bg-[#1A1A1A] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#2BEE34]">
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#2BEE34]" />
                  Audio Signals ({result.signals.length})
                </h3>
                <div className="space-y-2.5 max-h-[280px] sm:max-h-none overflow-y-auto sm:overflow-visible pr-0.5 sm:pr-0">
                  {result.signals.map((s, i) => (
                    <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-[#141414]/50 border border-[#1E1E1E] min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${s.flagged ? 'bg-[#FF4444]' : 'bg-[#2BEE34]'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1 gap-2">
                          <span className="text-xs sm:text-sm text-[#A3A3A3] font-medium truncate">{s.name}</span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${s.flagged ? 'bg-[#FF4444]/15 text-[#FF4444]' : 'bg-[#2BEE34]/15 text-[#2BEE34]'}`}>{s.weight}%</span>
                        </div>
                        <p className="text-xs text-[#6B6B6B] truncate">{s.description}</p>
                        <div className="h-1 bg-[#1A1A1A] rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${s.flagged ? 'bg-[#FF4444]' : 'bg-[#2BEE34]'}>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Segment timeline */}
              {result.segment_scores && result.segment_scores.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-[#2BEE34]" />
                    Audio Segment Analysis
                  </h3>
                  <div className="space-y-1.5">
                    {result.segment_scores.map((seg: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-[#6B6B6B] w-16 shrink-0 font-mono">
                          {seg.start_sec}s – {seg.end_sec}s
                        </span>
                        <div className="flex-1 h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${seg.ai_score > 0.62 ? 'bg-[#FF4444]' : seg.ai_score > 0.38 ? 'bg-[#FFB800]' : 'bg-[#2BEE34]'}`}
                            style={{ width: `${Math.round(seg.ai_score * 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold w-10 text-right ${seg.ai_score > 0.62 ? 'text-[#FF4444]' : seg.ai_score > 0.38 ? 'text-[#FFB800]' : 'text-[#2BEE34]'}`}>
                          {Math.round(seg.ai_score * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-[#6B6B6B]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FF4444]" />AI-synthetic</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FFB800]" />Uncertain</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2BEE34]" />Authentic</span>
                  </div>
                </div>
              )}

              <div className="card py-3 px-4 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-[#6B6B6B] font-mono truncate">{result.processing_time}ms</span>
                <button onClick={exportReport} className="text-xs btn-ghost py-1.5 px-3 flex items-center gap-1.5 shrink-0">
                  <Download className="w-3.5 h-3.5" /> Export Report
                </button>
              </div>
            </div>
          ) : !loading && (
            <div className="card flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-xl bg-[#2BEE34]/10 flex items-center justify-center mx-auto mb-4 ">
                <Mic className="w-10 h-10 text-[#2BEE34]" />
              </div>
              <h3 className="font-semibold text-white mb-2">Upload Audio</h3>
              <p className="text-[#6B6B6B] text-sm max-w-xs">Drop a voice recording to scan for TTS synthesis and voice cloning artifacts</p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#6B6B6B] w-full max-w-xs">
                {['Prosody analysis', 'Spectral fingerprint', 'TTS artifact detection', 'Voice cloning'].map(f => (
                  <div key={f} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#141414]/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2BEE34]/60 shrink-0" />{f}
                  </div>
                ))}
              </div>
            </div>
          )}
        
      </div>
    </div>
    <div className="px-4 sm:px-6 lg:px-8 2xl:px-10 max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1700px] mx-auto pb-6">
      
      <LazyReviewSuggestion toolName="Audio Detector" />
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
                { name: 'ASVspoof5', desc: 'ASVspoof anti-spoofing benchmark', url: 'https://huggingface.co/datasets/ASVspoof/ASVspoof5' },
                { name: 'Deepfake Audio Detection', desc: 'morisaki deepfake audio dataset', url: 'https://huggingface.co/datasets/morisaki/deepfake-audio-detection' },
                { name: 'MelodyMachine V2', desc: 'Deepfake audio detection dataset V2', url: 'https://huggingface.co/datasets/MelodyMachine/Deepfake-audio-detection-dataset-V2' },
              ].map(d => (
                <a key={d.url} href={d.url} target="_blank" rel="noreferrer"
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-[#141414] transition-colors group">
                  <Database className="w-3.5 h-3.5 text-[#2BEE34] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
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
    {/* FIX B.3: MobileResultSheet */}
    <MobileResultSheet isOpen={showMobileResult} onClose={() => setShowMobileResult(false)} title="Detection Result">
      {result && (
        <div className="space-y-4 pb-4">
          <div className={`card border ${result.verdict === 'AI' ? 'border-[#FFB800]/30 bg-[#FFB800]/5' : result.verdict === 'HUMAN' ? 'border-[#2BEE34]/30 bg-[#2BEE34]/5' : 'border-[#FFB800]/20 bg-[#FFB800]/5'} p-4 rounded-xl`}>
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
export default function AudioDetectionPageWrapper() {
  return <ErrorBoundary><AudioDetectionPage /></ErrorBoundary>
}
