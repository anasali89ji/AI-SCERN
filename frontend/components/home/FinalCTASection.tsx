import Link from 'next/link'
import { Reveal } from '@/components/motion/Reveal'

const PARTICLES = Array.from({ length: 20 }).map((_, i) => ({
  id: i,
  left: `${(i * 37) % 100}%`,
  top: `${(i * 53) % 100}%`,
  delay: `${(i % 10) * 0.4}s`,
  duration: `${8 + (i % 6)}s`,
}))

export default function FinalCTASection() {
  return (
    <section aria-label="Get started with trust verification" className="relative py-24 md:py-32 lg:py-40 [overflow:clip]">
      {/* Mesh gradients, reused from hero */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="hero-mesh-1 absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="hero-mesh-2 absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)', filter: 'blur(90px)' }} />
        <div className="hero-mesh-3 absolute bottom-1/4 left-1/5 w-[420px] h-[420px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)', filter: 'blur(70px)' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px]"
          style={{ background: 'radial-gradient(ellipse at top, rgba(37,99,235,0.08) 0%, transparent 65%)' }} />

        {/* prefers-reduced-motion: global rule in globals.css already forces
            animation-duration to 0.01ms, so these are effectively static for
            reduced-motion users without needing a JS-side gate. */}
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className="absolute w-1 h-1 rounded-full bg-primary/40"
            style={{
              left: p.left,
              top: p.top,
              opacity: 0.4,
              animation: `float ${p.duration} ease-in-out ${p.delay} infinite`,
            }}
          />
        ))}
      </div>

      <div className="max-w-3xl mx-auto px-6 text-center relative">
        <Reveal duration={0.6} y={24}>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-text-primary mb-4">
            Stop guessing. Start verifying digital authenticity.
          </h2>
          <p className="text-lg md:text-xl text-text-muted max-w-xl mx-auto mb-10 leading-relaxed">
            Protect your organization from AI-generated misinformation, deepfakes, and synthetic media with one unified trust verification platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="magnetic-btn rounded-xl bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white px-8 py-4 font-semibold"
            >
              Start Free Trust Verification
            </Link>
            <Link
              href="/enterprise"
              className="rounded-xl border border-border bg-surface text-text-primary px-8 py-4 font-semibold hover:bg-surface-active transition-colors"
            >
              Book Enterprise Demo
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
