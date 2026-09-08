'use client'
/**
 * Aiscern — Detection Sequence Loader
 *
 * Module 7.5 (SIMPLIFY): exactly 4 steps, horizontal progress with labels.
 * No spinning loaders, no excessive SVG animation — clean and minimal.
 */
import { useEffect, useState, useRef } from 'react'
import { Check } from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useAnimationPref } from '@/components/AnimationPreferenceContext'

const STEPS = [
  { id: 'analyzing', label: 'Analyzing…' },
  { id: 'signals',   label: 'Extracting signals…' },
  { id: 'ensemble',  label: 'Ensemble voting…' },
  { id: 'finalizing',label: 'Finalizing report…' },
] as const

interface DetectionSequenceLoaderProps {
  /** Whether the API call is still in flight */
  loading:         boolean
  /** 0–100 upload progress; step 0 stays active until this hits 100 */
  uploadProgress?: number
  className?:      string
}

export function DetectionSequenceLoader({
  loading,
  uploadProgress = 0,
  className = '',
}: DetectionSequenceLoaderProps) {
  const osReduced = useReducedMotion()
  const { reduceAnimations } = useAnimationPref()
  const reduced = osReduced || reduceAnimations

  const [step, setStep] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-advance through the 4 steps on realistic timings. Step 0 waits for
  // uploadProgress to complete before the sequence starts advancing on its own.
  useEffect(() => {
    if (!loading) return
    if (step === 0 && uploadProgress < 100) return

    if (step < STEPS.length - 1) {
      timerRef.current = setTimeout(() => setStep(s => s + 1), 700)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [step, loading, uploadProgress])

  // Reset when a new detection starts
  useEffect(() => {
    if (loading) setStep(0)
  }, [loading])

  if (!loading) return null

  return (
    <div className={`card flex flex-col gap-5 py-6 px-5 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-silver-600">
        Detection in progress
      </p>

      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const isDone    = i < step
          const isActive  = i === step
          const isFuture  = i > step
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-initial">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className={[
                  'w-6 h-6 rounded-full flex items-center justify-center border',
                  isDone   ? 'border-transparent bg-accent/10 text-accent' : '',
                  isActive ? 'border-accent bg-accent/10' : '',
                  isFuture ? 'border-silver-500/50' : '',
                ].join(' ')}>
                  {isDone ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-accent' : 'bg-silver-500/50'}`} />
                  )}
                </div>
                <span className={[
                  'text-[11px] font-medium text-center leading-tight max-w-[80px]',
                  isDone   ? 'text-silver-600' : '',
                  isActive ? 'text-accent' : '',
                  isFuture ? 'text-silver-500/50' : '',
                ].join(' ')}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 bg-white/10 mx-2 -mt-5 relative overflow-hidden rounded-full">
                  <div
                    className={`absolute inset-y-0 left-0 bg-accent rounded-full ${reduced ? '' : 'transition-all duration-500 ease-out'}`}
                    style={{ width: isDone ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
