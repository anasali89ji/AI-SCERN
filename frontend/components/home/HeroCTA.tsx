'use client'

import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { ArrowRight, MessageSquare, ScanLine } from 'lucide-react'

/**
 * Auth-aware hero CTAs (§Plan 6.4).
 *
 * Exactly two actions — one primary, one secondary — never three
 * equal-weight buttons. Authenticated users go straight into the product.
 */
export function HeroCTAButtons() {
  const { user } = useAuth()

  if (user) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-5 animate-enter">
        <Link href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg
                     bg-accent hover:bg-accent-hover text-depth-bg font-semibold
                     text-base transition-colors duration-200 w-full sm:w-auto
                     focus-visible:ring-2 focus-visible:ring-accent/50">
          Open Dashboard <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
        <Link href="/chat"
          className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg
                     bg-surface-elevated border border-white/[0.08] hover:border-accent hover:text-accent
                     text-silver-800 font-semibold text-base transition-all duration-200 w-full sm:w-auto
                     focus-visible:ring-2 focus-visible:ring-accent/50">
          <MessageSquare className="w-4 h-4" aria-hidden="true" /> AI Detection Assistant
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-5 animate-enter">
      <Link href="/detect/text"
        className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg
                   bg-accent hover:bg-accent-hover text-depth-bg font-semibold
                   text-base transition-colors duration-200 w-full sm:w-auto
                   focus-visible:ring-2 focus-visible:ring-accent/50">
        <ScanLine className="w-4 h-4" aria-hidden="true" /> Start Free Detection
      </Link>
      <Link href="#tools"
        className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg
                   bg-surface-elevated border border-white/[0.08] hover:border-accent hover:text-accent
                   text-silver-800 font-semibold text-base transition-all duration-200 w-full sm:w-auto
                   focus-visible:ring-2 focus-visible:ring-accent/50">
        Explore the tools
      </Link>
    </div>
  )
}
