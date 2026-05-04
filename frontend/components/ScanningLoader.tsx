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
  { id: 'uploading',  icon: Upload,      label: 'Uploading to secure storage',   color: 'var(--color-primary, #7c3aed)' },
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
    <AnimatePresence mode="wait">
      <motion.div
        key={`scanning-loader-${stage}`}
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduced ? 0 : -8 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        className={`rounded-2xl border border-white/[0.05] bg-white/[0.03] backdrop-blur-sm p-5 space-y-4 ${className}`}
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
                  className="relative w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300"
                  style={{
                    borderColor: isDone
                      ? '#10b981'
                      : isCurrent
                      ? s.color
                      : 'rgba(255,255,255,0.1)',
                    background: isDone
                      ? 'rgba(16,185,129,0.12)'
                      : isCurrent
                      ? `${s.color}18`
                      : 'transparent',
                  }}
                >
                  {/* Spinning ring for active stage */}
                  {isCurrent && !reduced && (
                    <motion.div
                      className="absolute inset-[-3px] rounded-full border-2 border-transparent border-t-primary"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    />
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
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: s.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                      />
                    </div>
                  )}

                  {/* Pulsing dots for non-upload active stages */}
                  {isCurrent && s.id !== 'uploading' && (
                    <div className="mt-1.5 flex gap-1">
                      {[0, 1, 2].map(d => (
                        <motion.div
                          key={d}
                          className="w-1 h-1 rounded-full"
                          style={{ background: s.color }}
                          animate={reduced ? { opacity: 1 } : { opacity: [0.3, 1, 0.3] }}
                          transition={reduced ? {} : { duration: 1.2, repeat: Infinity, delay: d * 0.25 }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Done checkmark */}
                {isDone && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-[11px] font-bold text-emerald-400 flex-shrink-0"
                  >
                    ✓
                  </motion.span>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
