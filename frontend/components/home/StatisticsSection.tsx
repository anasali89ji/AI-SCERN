'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

function useCountUp(target: number, shouldReduceMotion: boolean) {
  const [count, setCount] = useState(shouldReduceMotion ? target : 0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (shouldReduceMotion || started) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setStarted(true)
        const steps = 40
        const step = target / steps
        let current = 0
        const interval = setInterval(() => {
          current += step
          if (current >= target) {
            setCount(target)
            clearInterval(interval)
          } else {
            setCount(Math.floor(current))
          }
        }, 1000 / steps)
        observer.disconnect()
      },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, started, shouldReduceMotion])

  return { ref, count }
}

const STATS: { value: string; label: string; numeric?: number }[] = [
  { value: '< 3', label: 'seconds — average AI content detection scan time' },
  { value: '4', label: 'modalities covered — text, image, audio, video', numeric: 4 },
  { value: 'REST + Webhook', label: 'enterprise API integrations for automated trust verification' },
  { value: '24/7', label: 'continuous deepfake detection pipeline uptime' },
]

export default function StatisticsSection() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section aria-label="Trust verification platform statistics" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="grid grid-cols-2 lg:flex lg:justify-between gap-8 lg:gap-6">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center flex-1"
            >
              {stat.numeric !== undefined ? (
                <NumericValue target={stat.numeric} shouldReduceMotion={!!shouldReduceMotion} />
              ) : (
                <div className="font-black text-4xl md:text-5xl gradient-text tabular-nums">{stat.value}</div>
              )}
              <p className="text-sm text-text-muted uppercase tracking-wider mt-2">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function NumericValue({ target, shouldReduceMotion }: { target: number; shouldReduceMotion: boolean }) {
  const { ref, count } = useCountUp(target, shouldReduceMotion)
  return (
    <span ref={ref} className="font-black text-4xl md:text-5xl gradient-text tabular-nums">
      {count}
    </span>
  )
}
