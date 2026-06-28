'use client'
/**
 * Aiscern — Multi-Stage Scanning Loader (Module 7)
 *
 * Shows real detection pipeline stages with animated progress.
 * Replace generic Loader2 spinners on detect pages with this component.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Brain, Cpu, CheckCircle, type LucideIcon } from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export type ScanStage = 'idle' | 'uploading' | 'analyzing' | 'processing' | 'complete'

interface ScanningLoaderProps {
  stage:           ScanStage
  uploadProgress?: number       // 0–100, used during 'uploading' stage
  mediaType?:      'text' | 'image' | 'audio' | 'video'
  className?:      string
}

const STAGES: {
  id:     ScanStage
  icon:   LucideIcon
  label:  string
  color:  string
}[] = [
  { id: 'uploading',  icon: Upload,      label: 'Uploading to secure storage',   color: 'var(--color-primary, #2563eb)' },
  { id: 'analyzing',  icon: Brain,       label: 'Running AI detection models',   color: '#2563eb' },
  { id: 'processing', icon: Cpu,         label: 'Computing detection signals',   color: '#06b6d4' },
  { id: 'complete',   icon: CheckCircle, label: 'Analysis complete',             color: '#10b981' },
]

export default function ScanningLoader({
  stage,
  uploadProgress = 0,
  mediaType,
  className = '',
}: ScanningLoaderProps) {
  const reduced = useReducedMotion()
  if (stage === 'idle') return null

  const currentIdx = STAGES.findIndex(s => s.id === stage)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className={`card p-5 space-y-4 ${className}`}
      >
        {/* Header */}
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          {mediaType ? `Scanning ${mediaType}` : 'Scanning'}…
        </p>

        {/* Stage list */}
        <div className="space-y-3">
          {STAGES.slice(0, 3).map((s, i) => {
            const isDone    = i < currentIdx
            const isCurrent = i === currentIdx
            const isPending = i > currentIdx
            const Icon      = s.icon

            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 transition-opacity duration-500 ${isPending ? 'opacity-25' : 'opacity-100'}`}
              >
                {/* Step circle */}
                <div
                  className="relative w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200"
                  style={{
                    borderColor: isDone
                      ? '#10b981'
                      : isCurrent
                      ? s.color
                      : 'rgba(255,255,255,0.07)',
                    background: isDone
                      ? 'rgba(16,185,129,0.12)'
                      : isCurrent
                      ? `${s.color}15`
                      : 'transparent',
                  }}
                >
                  {/* Spinning ring for active stage */}
                  {isCurrent && !reduced && (
                    <div className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: `${s.color}40`, borderTopColor: s.color }} />
                  )}
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{
                      color: isDone ? '#10b981' : isCurrent ? s.color : 'rgba(255,255,255,0.25)',
                    }}
                  />
                </div>

                {/* Label + progress */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium leading-tight"
                    style={{
                      color: isDone
                        ? '#10b981'
                        : isCurrent
                        ? '#f1f5f9'
                        : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {s.label}
                  </p>

                  {/* Upload progress bar */}
                  {isCurrent && s.id === 'uploading' && uploadProgress > 0 && (
                    <div className="mt-1.5 h-1 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%`, background: s.color }} />
                    </div>
                  )}

                  {/* Pulsing dots for non-upload active stages */}
                  {isCurrent && s.id !== 'uploading' && (
                    <div className="mt-1.5 flex gap-1">
                      {[0, 1, 2].map(d => (
                        <div key={d} className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{ background: s.color, animationDelay: `${d * 0.15}s` }} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Done checkmark */}
                {isDone && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs font-bold">
                    ✓
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
