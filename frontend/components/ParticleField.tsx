'use client'
import { useEffect, useRef } from 'react'

interface ParticleFieldProps {
  className?: string
  count?: number
  color?: string
}

/**
 * Lightweight canvas particle background — small drifting dots connected
 * by faint lines when close together. Pauses via IntersectionObserver when
 * off-screen and respects prefers-reduced-motion (renders a static frame).
 */
export function ParticleField({ className = '', count = 40, color = '#2BEE34' }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2)
    let raf = 0
    let running = true

    const particles = Array.from({ length: count }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
      r: Math.random() * 1.4 + 0.6,
    }))

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width; height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      const pts = particles.map(p => ({ x: p.x * width, y: p.y * height }))

      // Connections between nearby particles
      ctx.strokeStyle = color
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 90) {
            ctx.globalAlpha = (1 - dist / 90) * 0.12
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.stroke()
          }
        }
      }
      // Dots
      ctx.fillStyle = color
      particles.forEach((p, i) => {
        ctx.globalAlpha = 0.5
        ctx.beginPath()
        ctx.arc(pts[i].x, pts[i].y, p.r, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1
    }

    const tick = () => {
      if (!running) return
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > 1) p.vx *= -1
        if (p.y < 0 || p.y > 1) p.vy *= -1
      })
      draw()
      raf = requestAnimationFrame(tick)
    }

    if (reduced) {
      draw()
    } else {
      const observer = new IntersectionObserver(([entry]) => {
        running = entry.isIntersecting
        if (running) tick()
        else cancelAnimationFrame(raf)
      }, { rootMargin: '100px' })
      observer.observe(canvas)
      tick()
      return () => {
        observer.disconnect()
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', resize)
      }
    }

    return () => window.removeEventListener('resize', resize)
  }, [count, color])

  return <canvas ref={canvasRef} className={`pointer-events-none ${className}`} aria-hidden="true" />
}
