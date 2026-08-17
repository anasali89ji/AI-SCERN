'use client'

import { useEffect, useRef, useState } from 'react'

export function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (animated) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || animated) return
      setAnimated(true)
      let start = 0
      const steps = 60; const step = target / steps
      const interval = setInterval(() => {
        start += step
        if (start >= target) { setCount(target); clearInterval(interval) }
        else setCount(Math.floor(start))
      }, 1600 / steps)
    }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, animated])
  return <span ref={ref} className="counter-value">{count.toLocaleString()}{suffix}</span>
}
