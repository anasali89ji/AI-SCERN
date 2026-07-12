'use client'

import Link from 'next/link'
import { ArrowRight, MessageSquare, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

const REASSURANCES = ['No credit card required', 'Free tier always available', 'No account for basic examinations']

export function CTASection() {
  const { user } = useAuth()

  return (
    <section className="relative py-20 sm:py-28 lg:py-32 px-4 sm:px-6 border-t border-white/[0.06] bg-depth-bg overflow-hidden">
      {/* Radial glow from center — no particles, no floating elements */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 40%, rgba(43,238,52,0.06) 0%, transparent 60%)' }}
        aria-hidden="true"
      />

      <div className="relative max-w-3xl mx-auto text-center">
        <h2 className="text-display text-silver-900 mb-5 leading-[1.05]">
          Start Attesting Content Free
        </h2>
        <p className="text-lead text-silver-600 mb-10 max-w-xl mx-auto">
          Core features free — no credit card required. No account needed for basic examinations.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href={user ? '/dashboard' : '/detect/text'}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg
                       bg-accent hover:bg-accent-hover text-depth-bg text-base font-semibold
                       transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            {user ? 'Go to Dashboard' : 'Begin Attestation Free'}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          {user ? (
            <Link
              href="/chat"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg
                         bg-surface-elevated border border-white/[0.08] hover:border-accent hover:text-accent
                         text-silver-800 text-base font-semibold transition-all duration-200
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <MessageSquare className="w-4 h-4" aria-hidden="true" /> Try ARIA Assistant
            </Link>
          ) : (
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg
                         bg-surface-elevated border border-white/[0.08] hover:border-accent hover:text-accent
                         text-silver-800 text-base font-semibold transition-all duration-200
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Create Free Account
            </Link>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs text-silver-600">
          {REASSURANCES.map(t => (
            <div key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent/70" aria-hidden="true" />{t}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
