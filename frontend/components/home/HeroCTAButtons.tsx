'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useAuth } from '@/components/auth-provider'
import { ArrowRight, MessageSquare } from 'lucide-react'
import { LiveDemo } from '@/components/home/LiveDemo'

export function HeroCTAButtons() {
  const { user } = useAuth()
  return (
    <>
      <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-9 sm:mb-14"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
        {user ? (
          <>
            <Link href="/dashboard"
              className="group relative w-full sm:w-auto px-8 py-4 rounded-2xl text-white text-base font-bold flex items-center justify-center gap-3 overflow-hidden transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 8px 32px rgba(37,99,235,0.35)' }}>
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-sm flex-shrink-0">
                {(user.displayName?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()}
              </span>
              Open Trust Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/chat" className="w-full sm:w-auto px-8 py-4 rounded-2xl border border-border/60 bg-surface text-base font-semibold flex items-center justify-center gap-2 hover:border-primary/40 transition-all duration-200">
              <MessageSquare className="w-5 h-5 text-emerald" />AI Trust Assistant
            </Link>
          </>
        ) : (
          <>
            <Link href="/detect/text"
              className="btn-primary w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-bold flex items-center justify-center shadow-lg shadow-primary/20">
              Verify Content — Free
            </Link>
            <Link href="/signup" className="btn-secondary w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base flex items-center justify-center hover:border-primary/30">
              Create Free Account
            </Link>
          </>
        )}
      </motion.div>

      <motion.div className="max-w-2xl 2xl:max-w-3xl mx-auto w-full"
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45 }}>
        <LiveDemo isLoggedIn={!!user} />
      </motion.div>
    </>
  )
}
