"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { uploadToR2WithProgress } from "@/lib/storage/upload-with-progress"
import {
  Mic,
  Upload,
  X,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Volume2,
  Waves,
  Activity,
  FileAudio,
  Zap,
  Clock,
  BarChart3,
  Sparkles,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  BrainCircuit
} from "lucide-react"

interface AudioSignal {
  name: string
  category: string
  description: string
  weight: number
  value: number
  flagged: boolean
}

interface AudioResult {
  verdict: "AI" | "HUMAN" | "UNCERTAIN"
  confidence: number
  model_used: string
  processing_time?: number
  summary: string
  signals: AudioSignal[]
  segment_scores?: { start_sec: number; end_sec: number; label: string; ai_score: number }[]
  degraded_signals?: string[]
  file_name?: string
}

export default function AudioDetectionPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AudioResult | null>(null)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState("")
  const progressRef = useRef<NodeJS.Timeout | null>(null)
  const stageRef = useRef<NodeJS.Timeout | null>(null)

  const stages = [
    "Reading audio stream...",
    "Extracting spectral features...",
    "Analyzing harmonic structure...",
    "Running ensemble models...",
    "Cross-referencing forensic database...",
    "Generating verdict...",
  ]

  useEffect(() => {
    return () => {
      if (progressRef.current) clearInterval(progressRef.current)
      if (stageRef.current) clearInterval(stageRef.current)
    }
  }, [])

  function startAnalysisAnimation() {
    setProgress(0)
    setCurrentStage(stages[0])

    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev
        return prev + Math.random() * 6
      })
    }, 500)

    let stageIndex = 0
    stageRef.current = setInterval(() => {
      stageIndex = (stageIndex + 1) % stages.length
      setCurrentStage(stages[stageIndex])
    }, 1800)
  }

  function stopAnalysisAnimation() {
    if (progressRef.current) clearInterval(progressRef.current)
    if (stageRef.current) clearInterval(stageRef.current)
    setProgress(100)
  }

  async function handleAnalyze() {
    if (!file) return
    setIsAnalyzing(true)
    setError("")
    setResult(null)
    startAnalysisAnimation()

    try {
      let r2Key: string | null = null

      // Try R2 presigned upload first (bypasses Vercel's 4.5MB request body
      // limit — audio files routinely exceed that, which is what was causing
      // "Failed to fetch" on anything longer than a few seconds of audio).
      try {
        const presignCtrl = new AbortController()
        const presignTimer = setTimeout(() => presignCtrl.abort(), 5000)
        const presignRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size, mediaType: "audio" }),
          signal: presignCtrl.signal,
        })
        clearTimeout(presignTimer)
        const presignData = await presignRes.json()
        if (presignData.success && presignData.uploadUrl) {
          await uploadToR2WithProgress(presignData.uploadUrl, file, () => {})
          r2Key = presignData.key
        }
      } catch { /* fallback to direct upload — R2 slow or unavailable */ }

      let res: Response
      if (r2Key) {
        res = await fetch("/api/detect/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ r2Key, fileName: file.name, fileSize: file.size, format: file.name.split(".").pop() }),
        })
      } else {
        const formData = new FormData()
        formData.append("file", file)
        res = await fetch("/api/detect/audio", {
          method: "POST",
          body: formData,
        })
      }

      stopAnalysisAnimation()

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || err.error || `Server error ${res.status}`)
      }

      const data = await res.json()
      if (data.success) {
        setResult(data.result)
      } else {
        throw new Error(data.error?.message || data.error || "Analysis failed")
      }
    } catch (err: any) {
      stopAnalysisAnimation()
      setError(err.message || "Network error")
    } finally {
      setIsAnalyzing(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.type.startsWith("audio/")) {
      setFile(dropped)
      setResult(null)
      setError("")
    }
  }

  function getVerdictColor(v: string) {
    return v === "AI" ? "text-rose-400" : v === "HUMAN" ? "text-emerald-400" : "text-amber-400"
  }

  function getVerdictBg(v: string) {
    return v === "AI" ? "bg-rose-500/10 border-rose-500/30" : v === "HUMAN" ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30"
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Mic className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Audio Detection</h1>
          <p className="text-sm text-slate-500">
            Voice synthesis detection · Spectral analysis · Prosody patterns · TTS artifacts
          </p>
        </div>
      </div>

      {/* Beta Notice */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0f0f17] p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-400 font-medium">Beta — under active development.</p>
          <p className="text-sm text-slate-500 mt-1">
            Audio detection is newer than our text and image models and is still being refined. Results may be less reliable — treat them as a starting signal, not a final verdict.
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="rounded-2xl border-2 border-dashed border-white/[0.07] bg-[#0f0f17] p-8 text-center hover:border-primary/30 transition-colors"
      >
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) {
              setFile(f)
              setResult(null)
              setError("")
            }
          }}
          className="hidden"
          id="audio-upload"
        />
        <label htmlFor="audio-upload" className="cursor-pointer block">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-slate-300">Drop an audio file or click to browse</p>
          <p className="text-xs text-slate-600 mt-1">WAV, MP3, OGG, FLAC — up to 50 MB</p>
        </label>
      </div>

      {/* File Info */}
      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-white/[0.07] bg-[#0f0f17] p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileAudio className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{file.name}</p>
                  <p className="text-xs text-slate-600">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                onClick={() => { setFile(null); setResult(null); setError("") }}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analyze Button */}
      {file && !isAnalyzing && !result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center"
        >
          <button
            onClick={handleAnalyze}
            className="px-6 py-3 rounded-xl bg-primary text-bg font-semibold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Zap className="w-4 h-4" />
            Start Analysis
          </button>
        </motion.div>
      )}

      {/* ========== LOADING / ANALYZING STATE ========== */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-white/[0.07] bg-[#0f0f17] p-8 text-center space-y-6"
          >
            {/* Animated Waveform */}
            <div className="flex items-center justify-center gap-1 h-16">
              {Array.from({ length: 24 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 rounded-full bg-gradient-to-t from-primary to-cyan-400"
                  animate={{
                    height: [12, 40 + Math.random() * 24, 12],
                    opacity: [0.4, 1, 0.4],
                  }}
                  transition={{
                    duration: 0.8 + Math.random() * 0.6,
                    repeat: Infinity,
                    repeatType: "reverse",
                    delay: i * 0.05,
                  }}
                />
              ))}
            </div>

            {/* Stage Text */}
            <div className="space-y-2">
              <motion.div
                key={currentStage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-sm font-medium text-primary flex items-center justify-center gap-2"
              >
                <Activity className="w-4 h-4 animate-pulse" />
                {currentStage}
              </motion.div>
              <p className="text-xs text-slate-600">This may take 15–45 seconds depending on file length</p>
            </div>

            {/* Progress Bar */}
            <div className="max-w-sm mx-auto space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Analyzing</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-[#141420] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-cyan-400 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {["Spectral Analysis", "Prosody Mapping", "TTS Artifact Hunt", "Formant Tracking"].map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-slate-500 border border-white/5"
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-400 text-sm flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== RESULTS ========== */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Verdict Card */}
            <div className={`rounded-2xl border ${getVerdictBg(result.verdict)} p-6 text-center`}>
              <div className={`text-5xl font-black ${getVerdictColor(result.verdict)} mb-2`}>
                {result.verdict}
              </div>
              <div className="text-sm text-slate-500">
                Confidence: <span className="font-medium text-slate-300">{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Model: {result.model_used}{result.processing_time ? ` · ${result.processing_time}ms` : ""}
              </div>
              {result.summary && (
                <p className="text-sm text-slate-400 mt-3">{result.summary}</p>
              )}
            </div>

            {/* Degraded signal notice — be honest when fewer signals ran than usual */}
            {!!result.degraded_signals?.length && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400">
                  This result used fewer signals than usual ({result.degraded_signals.join(", ")}).
                </p>
              </div>
            )}

            {/* Detection Signals */}
            {!!result.signals?.length && (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0f0f17] p-4">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Detection Signals ({result.signals.length})
                </h3>
                <div className="space-y-2.5">
                  {result.signals.map((s, i) => (
                    <div key={`${s.name}-${i}`} className="flex items-center gap-2.5 p-3 rounded-xl bg-[#141420] border border-white/5">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.flagged ? "bg-rose-500" : "bg-emerald-500"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-slate-300 font-medium truncate">{s.name}</span>
                          <span className={`text-xs font-bold ml-2 px-1.5 py-0.5 rounded-full ${s.flagged ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                            {s.weight}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{s.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Segment Timeline */}
            {!!result.segment_scores?.length && (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0f0f17] p-4">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Timeline
                </h3>
                <div className="space-y-2">
                  {result.segment_scores.map((seg, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-20 shrink-0">{seg.start_sec}s–{seg.end_sec}s</span>
                      <div className="flex-1 h-1.5 bg-[#141420] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${seg.ai_score > 0.6 ? "bg-rose-500" : seg.ai_score < 0.4 ? "bg-emerald-500" : "bg-amber-500"}`}
                          style={{ width: `${seg.ai_score * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium w-10 text-right ${seg.ai_score > 0.6 ? "text-rose-400" : seg.ai_score < 0.4 ? "text-emerald-400" : "text-amber-400"}`}>
                        {(seg.ai_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reset */}
            <div className="flex justify-center">
              <button
                onClick={() => { setFile(null); setResult(null); setError("") }}
                className="px-4 py-2 rounded-xl border border-white/[0.07] text-slate-400 text-sm flex items-center gap-2 hover:bg-white/5 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Analyze Another File
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
