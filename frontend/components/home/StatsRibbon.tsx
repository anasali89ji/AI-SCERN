'use client'

import { useEffect, useRef, useState } from 'react'

interface Stat {
  value: number
  suffix?: string
  label: string
}

// NOTE: Using the site's actual documented benchmark figures (matching the FAQ schema
// in app/page.tsx) rather than the prompt's placeholder marketing copy ("12M+
// Attestations", "50ms Latency") — those aren't numbers we can currently back up.
const DEFAULT_STATS: Stat[] = [
  { value: 4,  suffix: '',  label: 'Modalities Covered' },
  { value: 8,  suffix: '+', label: 'Forensic Engines'   },
  { value: 94, suffix: '%', label: 'Text Accuracy (~)'  },
  { value: 98, suffix: '%', label: 'Image Accuracy (~)' },
]

function CountUpValue({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (started) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started) return
      setStarted(true)
      const durationMs = 1500
      const startTime = performance.now()
      const tick = (now: number) => {
        const progress = Math.min((now - startTime) / durationMs, 1)
        setCount(Math.floor(progress * target))
        if (progress < 1) requestAnimationFrame(tick)
        else setCount(target)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, started])

  return <span ref={ref} className="tabular-nums">{count.toLocaleString()}{suffix}</span>
}

export function StatsRibbon({ stats = DEFAULT_STATS }: { stats?: Stat[] }) {
  return (
    <section className="bg-surface-elevated border-y border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 lg:gap-0 lg:divide-x lg:divide-white/5">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center lg:px-4">
              <div className="text-3xl sm:text-4xl font-bold text-silver-900 mb-1.5">
                <CountUpValue target={stat.value} suffix={stat.suffix} />
              </div>
              <p className="text-silver-600 text-[11px] sm:text-sm uppercase tracking-wider font-medium leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
