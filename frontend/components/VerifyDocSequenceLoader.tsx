'use client'
/**
 * Aiscern — VerifyDoc Sequence Loader
 *
 * Same visual language as DetectionSequenceLoader, but reflects VerifyDoc's
 * actual pipeline shape: extraction happens first, then image detection
 * (with physical-consistency layers) and text detection + plagiarism
 * scoring run as PARALLEL branches — shown side-by-side rather than as one
 * linear list, since that's what's actually happening on the backend.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileSearch, Image as ImageIcon, FileText, Atom,
  Copy, Sparkles, CheckCircle2, type LucideIcon,
} from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface Branch {
  id: string
  icon: LucideIcon
  label: string
  sublabel: string
  color: string
  ms: number
}

const PARALLEL_BRANCHES: Branch[] = [
  {
    id: 'image',
    icon: ImageIcon,
    label: 'Scanning embedded images',
    sublabel: 'GAN fingerprints · physical consistency (PAFRA/BDIS/SSWDP/QESM)…',
    color: '#3b82f6',
    ms: 2200,
  },
  {
    id: 'text',
    icon: FileText,
    label: 'Analyzing document text',
    sublabel: 'Perplexity · burstiness · stylometry · repetition…',
    color: '#8b5cf6',
    ms: 1800,
  },
  {
    id: 'plagiarism',
    icon: Copy,
    label: 'Checking originality',
    sublabel: 'Internal duplication · boilerplate patterns · citation density…',
    color: '#f59e0b',
    ms: 1400,
  },
]

interface VerifyDocSequenceLoaderProps {
  loading: boolean
  uploadProgress?: number
  hasImages?: boolean
  hasText?: boolean
  className?: string
}

export function VerifyDocSequenceLoader({
  loading,
  uploadProgress = 0,
  hasImages = true,
  hasText = true,
  className = '',
}: VerifyDocSequenceLoaderProps) {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<'upload' | 'extract' | 'parallel' | 'compile'>('upload')
  const [branchDone, setBranchDone] = useState<Record<string, boolean>>({})

  const activeBranches = PARALLEL_BRANCHES.filter(b =>
    b.id === 'image' ? hasImages : true
  ).filter(b => hasText || b.id === 'image')

  useEffect(() => {
    if (!loading) { setPhase('upload'); setBranchDone({}); return }
    if (uploadProgress < 100) { setPhase('upload'); return }
    if (phase === 'upload') {
      setPhase('extract')
      const t = setTimeout(() => setPhase('parallel'), 700)
      return () => clearTimeout(t)
    }
  }, [loading, uploadProgress, phase])

  useEffect(() => {
    if (phase !== 'parallel') return
    const timers = activeBranches.map(b =>
      setTimeout(() => {
        setBranchDone(prev => {
          const next = { ...prev, [b.id]: true }
          if (activeBranches.every(x => next[x.id])) {
            setTimeout(() => setPhase('compile'), 300)
          }
          return next
        })
      }, b.ms)
    )
    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  if (!loading) return null

  return (
    <motion.div
      key="verifydoc-seq-loader"
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -8 }}
      transition={{ duration: reduced ? 0 : 0.25, ease: 'easeOut' }}
      className={`card flex flex-col gap-5 py-6 px-5 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">VerifyDoc scanning</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={phase}
              initial={{ opacity: 0, y: reduced ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -4 }}
              transition={{ duration: 0.2 }}
              className="text-base font-bold text-text-primary"
            >
              {phase === 'upload'    && 'Securing your document'}
              {phase === 'extract'   && 'Extracting text & images'}
              {phase === 'parallel'  && 'Running parallel detection'}
              {phase === 'compile'   && 'Compiling verdict'}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="relative w-10 h-10 flex items-center justify-center">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={phase}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {phase === 'upload'   && <Upload className="w-5 h-5 text-primary" />}
                {phase === 'extract'  && <FileSearch className="w-5 h-5 text-primary" />}
                {phase === 'parallel' && <Atom className="w-5 h-5 text-primary" />}
                {phase === 'compile'  && <Sparkles className="w-5 h-5 text-primary" />}
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

      {phase === 'upload' && (
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
            animate={{ width: `${uploadProgress}%` }}
            transition={{ duration: 0.15 }}
          />
        </div>
      )}

      {(phase === 'extract' || phase === 'compile') && (
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-primary/30 bg-primary/5">
          <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
            {!reduced && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
              />
            )}
            {phase === 'compile'
              ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              : <FileSearch className="w-3.5 h-3.5 text-primary" />}
          </div>
          <p className="text-sm font-semibold text-text-primary">
            {phase === 'compile' ? 'All branches complete — fusing signals into one verdict' : 'Reading pages, pulling embedded images, isolating body text'}
          </p>
        </div>
      )}

      {/* Parallel branch cards — the point of this loader */}
      {phase === 'parallel' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {activeBranches.map(b => {
            const done = !!branchDone[b.id]
            const Icon = b.icon
            return (
              <motion.div
                key={b.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-3 py-3 rounded-xl border flex flex-col gap-2"
                style={{
                  borderColor: done ? 'rgba(16,185,129,0.3)' : `${b.color}40`,
                  background:  done ? 'rgba(16,185,129,0.06)' : `${b.color}0a`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
                    {!done && (
                      <>
                        <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: `${b.color}30` }} />
                        {!reduced && (
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-transparent"
                            style={{ borderTopColor: b.color }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                          />
                        )}
                      </>
                    )}
                    {done
                      ? <CheckCircle2 className="w-4 h-4 text-emerald" />
                      : <Icon className="w-3.5 h-3.5" style={{ color: b.color }} />}
                  </div>
                  <span className="text-xs font-bold" style={{ color: done ? '#10b981' : b.color }}>
                    {done ? 'Done' : 'Running'}
                  </span>
                </div>
                <p className="text-xs font-semibold text-text-primary leading-tight">{b.label}</p>
                <p className="text-[10.5px] text-text-muted leading-snug">{b.sublabel}</p>
              </motion.div>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-text-disabled">
        <div className={`w-1.5 h-1.5 rounded-full bg-primary ${!reduced ? 'animate-pulse' : ''}`} />
        Image and text branches run concurrently — neither waits on the other.
      </div>
    </motion.div>
  )
}
