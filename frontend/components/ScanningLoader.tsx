'use client'
import { Upload, Brain, Cpu, CheckCircle2, type LucideIcon } from 'lucide-react'

export type ScanStage = 'idle' | 'uploading' | 'analyzing' | 'processing' | 'complete'

interface ScanningLoaderProps {
  stage:           ScanStage
  uploadProgress?: number
  mediaType?:      'text' | 'image' | 'audio' | 'video'
  className?:      string
}

const STAGES: { id: ScanStage; icon: LucideIcon; label: string }[] = [
  { id: 'uploading',  icon: Upload,       label: 'Uploading to secure storage'  },
  { id: 'analyzing',  icon: Brain,        label: 'Running AI detection models'  },
  { id: 'processing', icon: Cpu,          label: 'Computing detection signals'  },
  { id: 'complete',   icon: CheckCircle2, label: 'Analysis complete'            },
]

export default function ScanningLoader({
  stage, uploadProgress = 0, mediaType, className = '',
}: ScanningLoaderProps) {
  if (stage === 'idle') return null
  const currentIdx = STAGES.findIndex(s => s.id === stage)

  return (
    <div className={`space-y-4 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B6B6B]">
        {mediaType ? `Scanning ${mediaType}` : 'Scanning'}…
      </p>

      <div className="space-y-3">
        {STAGES.slice(0, 3).map((s, i) => {
          const isDone    = i < currentIdx
          const isCurrent = i === currentIdx
          const isPending = i > currentIdx
          const Icon      = s.icon

          return (
            <div key={s.id}
              className={`flex items-center gap-3 transition-opacity duration-300 ${isPending ? 'opacity-25' : 'opacity-100'}`}>

              {/* Step circle */}
              <div className={`relative w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                isDone    ? 'border-[#2BEE34] bg-[#2BEE34]/12'  :
                isCurrent ? 'border-[#2BEE34] bg-[#2BEE34]/10'  :
                            'border-[#2A2A2A] bg-transparent'
              }`}>
                {isCurrent && (
                  <div className="absolute inset-0 rounded-full border-2 border-t-[#2BEE34] border-r-transparent border-b-transparent border-l-transparent animate-spin-slow" />
                )}
                <Icon className={`w-3.5 h-3.5 ${
                  isDone    ? 'text-[#2BEE34]' :
                  isCurrent ? 'text-[#2BEE34]' :
                              'text-[#3A3A3A]'
                }`} strokeWidth={2} />
              </div>

              {/* Label + progress */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-tight ${
                  isDone    ? 'text-[#2BEE34]'  :
                  isCurrent ? 'text-white'       :
                              'text-[#3A3A3A]'
                }`}>
                  {s.label}
                </p>

                {/* Upload progress bar */}
                {isCurrent && s.id === 'uploading' && uploadProgress > 0 && (
                  <div className="mt-1.5 h-1 bg-[#2A2A2A] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2BEE34] rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}

                {/* Pulsing dots for active non-upload stages */}
                {isCurrent && s.id !== 'uploading' && (
                  <div className="mt-1.5 flex gap-1">
                    {[0, 1, 2].map(d => (
                      <div key={d}
                        className="w-1 h-1 rounded-full bg-[#2BEE34] animate-pulse-slow"
                        style={{ animationDelay: `${d * 200}ms` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Done check */}
              {isDone && (
                <div className="w-5 h-5 rounded-full bg-[#2BEE34]/10 border border-[#2BEE34]/30
                                flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-[#2BEE34]" strokeWidth={2.5} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
