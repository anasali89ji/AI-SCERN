'use client'
/**
 * Aiscern — Detection Sequence Loader
 *
 * Replaces the generic spinner during image analysis with a living,
 * sequential breakdown of every stage the detection engine runs.
 * Steps auto-advance on realistic timings so users feel the work happening.
 */
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, ScanLine, Fingerprint, Waves, ShieldCheck,
  Brain, Layers, FileText, Sparkles, CheckCircle2,
  type LucideIcon,
} from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

// ─── Step definitions ────────────────────────────────────────────────────────

interface Step {
  id:       string
  icon:     LucideIcon
  label:    string          // headline shown while active
  sublabel: string          // detail line while active
  done:     string          // label when completed
  ms:       number          // how long this step stays "active" before auto-advancing
  color:    string          // accent colour (Tailwind arbitrary or CSS var)
}

const STEPS: Step[] = [
  {
    id:       'upload',
    icon:     Upload,
    label:    'Securing your image',
    sublabel: 'Encrypting transfer to analysis cluster…',
    done:     'Upload complete',
    ms:       0,            // controlled externally via uploadProgress
    color:    '#6366f1',
  },
  {
    id:       'metadata',
    icon:     FileText,
    label:    'Reading image metadata',
    sublabel: 'EXIF data · format headers · compression signatures…',
    done:     'Metadata parsed',
    ms:       600,
    color:    '#8b5cf6',
  },
  {
    id:       'pixel',
    icon:     ScanLine,
    label:    'Analyzing pixel integrity',
    sublabel: 'Error Level Analysis · clone detection · chromatic aberration…',
    done:     'Pixel layer clean',
    ms:       700,
    color:    '#3b82f6',
  },
  {
    id:       'gan',
    icon:     Fingerprint,
    label:    'Identifying GAN fingerprints',
    sublabel: 'Generator-specific lattice patterns · SynthID watermark probe…',
    done:     'Fingerprint layer complete',
    ms:       700,
    color:    '#06b6d4',
  },
  {
    id:       'frequency',
    icon:     Waves,
    label:    'Frequency domain forensics',
    sublabel: 'FFT spectral peaks · wavelet subbands · 1/f deviation…',
    done:     'Frequency analysis done',
    ms:       650,
    color:    '#0ea5e9',
  },
  {
    id:       'noise',
    icon:     Layers,
    label:    'Noise & texture forensics',
    sublabel: 'ZED entropy · NLM noise tensor · DIRE reality check…',
    done:     'Noise layer scanned',
    ms:       600,
    color:    '#14b8a6',
  },
  {
    id:       'neural',
    icon:     Brain,
    label:    'Neural ensemble scoring',
    sublabel: 'Running 9-layer detection stack · fusing signals…',
    done:     'Ensemble scored',
    ms:       750,
    color:    '#10b981',
  },
  {
    id:       'forensic',
    icon:     ShieldCheck,
    label:    'Generative fingerprinting',
    sublabel: 'Attributing to generator family · lighting physics · bio markers…',
    done:     'Forensic map built',
    ms:       600,
    color:    '#22c55e',
  },
  {
    id:       'compile',
    icon:     Sparkles,
    label:    'Compiling verdict',
    sublabel: 'Scoring confidence · building report…',
    done:     'Report ready',
    ms:       400,
    color:    '#a3e635',
  },
]

// ─── Props ───────────────────────────────────────────────────────────────────

interface DetectionSequenceLoaderProps {
  /** Whether the API call is still in flight */
  loading:         boolean
  /** 0–100 upload progress; step 0 stays active until this hits 100 */
  uploadProgress?: number
  className?:      string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DetectionSequenceLoader({
  loading,
  uploadProgress = 0,
  className = '',
}: DetectionSequenceLoaderProps) {
  const reduced    = useReducedMotion()
  const [step, setStep]         = useState(0)   // index into STEPS
  const [barWidth, setBarWidth] = useState(0)    // active step's inner progress bar 0-100
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const barRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  // Advance through steps based on timing
  useEffect(() => {
    if (!loading) return

    // Step 0 (upload) — wait until uploadProgress reaches 100
    if (step === 0) {
      if (uploadProgress >= 100) {
        setStep(1)
        setBarWidth(0)
      }
      return
    }

    // Steps 1+ — auto-advance after each step's `ms` duration
    const current = STEPS[step]
    if (!current) return

    setBarWidth(0)

    // Animate the progress bar across the duration
    const interval = 50
    const ticks    = current.ms / interval
    let   tick     = 0
    barRef.current = setInterval(() => {
      tick++
      setBarWidth(Math.min((tick / ticks) * 100, 100))
    }, interval)

    timerRef.current = setTimeout(() => {
      clearInterval(barRef.current!)
      if (step < STEPS.length - 1) {
        setStep(s => s + 1)
      }
      // If on last step — stay there until loading becomes false
    }, current.ms)

    return () => {
      clearTimeout(timerRef.current!)
      clearInterval(barRef.current!)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, loading, uploadProgress])

  // Reset when a new detection starts
  useEffect(() => {
    if (loading) {
      setStep(uploadProgress >= 100 ? 1 : 0)
      setBarWidth(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  if (!loading) return null

  const completed = STEPS.slice(0, step)
  const active    = STEPS[step]
  const pending   = STEPS.slice(step + 1)

  // Overall progress for the top bar
  const overallPct = Math.round((step / (STEPS.length - 1)) * 100)

  const ActiveIcon = active?.icon ?? Sparkles

  return (
    <motion.div
      key="detection-seq-loader"
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -8 }}
      transition={{ duration: reduced ? 0 : 0.25, ease: 'easeOut' }}
      className={`card flex flex-col gap-5 py-6 px-5 ${className}`}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
            Detection in progress
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={active?.id}
              initial={{ opacity: 0, y: reduced ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -4 }}
              transition={{ duration: 0.2 }}
              className="text-base font-bold text-text-primary"
            >
              {active?.label ?? 'Finalising…'}
            </motion.p>
          </AnimatePresence>
        </div>
        {/* Pulsing shield icon */}
        <div className="relative w-10 h-10 flex items-center justify-center">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={active?.id}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ActiveIcon className="w-5 h-5 text-primary" />
              </motion.div>
            </AnimatePresence>
          </div>
          {!reduced && (
            <motion.div
              className="absolute inset-0 rounded-xl border border-primary/30"
              animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
      </div>

      {/* ── Overall progress bar ── */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={active?.sublabel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-xs text-text-muted leading-snug"
            >
              {active?.sublabel ?? 'A few more seconds…'}
            </motion.p>
          </AnimatePresence>
          <span className="text-xs font-bold text-primary tabular-nums ml-2 shrink-0">
            {overallPct}%
          </span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
            animate={{ width: `${overallPct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* ── Step list ── */}
      <div className="space-y-1.5">
        {/* Completed steps */}
        {completed.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.02 }}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-emerald/5 border border-emerald/15"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald/10 border border-emerald/25 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald" />
              </div>
              <span className="text-xs text-emerald font-medium">{s.done}</span>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="ml-auto text-[10px] font-bold text-emerald/70"
              >
                ✓
              </motion.div>
            </motion.div>
          )
        })}

        {/* Active step */}
        {active && (
          <motion.div
            key={active.id}
            layout
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="px-2.5 py-2 rounded-xl border"
            style={{
              borderColor: `${active.color}40`,
              background:  `${active.color}0a`,
            }}
          >
            <div className="flex items-center gap-2.5">
              {/* Spinning ring + icon */}
              <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full border-2"
                  style={{ borderColor: `${active.color}30` }}
                />
                {!reduced && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-transparent"
                    style={{ borderTopColor: active.color }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                  />
                )}
                <active.icon className="w-3.5 h-3.5" style={{ color: active.color }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary leading-tight">
                  {active.label}
                </p>
                {/* Step inner progress bar */}
                <div className="mt-1.5 h-0.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: active.color, width: `${step === 0 ? uploadProgress : barWidth}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
              </div>

              {/* Pulsing dots */}
              {!reduced && (
                <div className="flex gap-1 shrink-0">
                  {[0, 1, 2].map(d => (
                    <motion.div
                      key={d}
                      className="w-1 h-1 rounded-full"
                      style={{ background: active.color }}
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: d * 0.22 }}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Pending steps — show only next 3, dimmed */}
        {pending.slice(0, 3).map(s => {
          const Icon = s.icon
          return (
            <div
              key={s.id}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg opacity-25"
            >
              <div className="w-6 h-6 rounded-lg bg-border/40 border border-border/40 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-text-disabled" />
              </div>
              <span className="text-xs text-text-disabled">{s.label}</span>
            </div>
          )
        })}
      </div>

      {/* ── Footer hint ── */}
      <div className="flex items-center gap-2 text-[11px] text-text-disabled">
        <div className={`w-1.5 h-1.5 rounded-full bg-primary ${!reduced ? 'animate-pulse' : ''}`} />
        {step < STEPS.length - 2
          ? 'Running 9-layer forensic stack · typically 2–4 seconds'
          : step < STEPS.length - 1
          ? 'Almost there — fusing all signals…'
          : 'Compiling your report…'}
      </div>
    </motion.div>
  )
}
