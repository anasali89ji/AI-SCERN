'use client'

import { motion } from 'framer-motion'
import { Lock, Database, Trash2, ShieldCheck, KeyRound, Globe, Shield } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const SECURITY_FEATURES = [
  { title: 'Encrypted Processing', icon: Lock },
  { title: 'Secure Storage', icon: Database },
  { title: 'Automatic File Deletion', icon: Trash2 },
  { title: 'No Training on Customer Files', icon: ShieldCheck },
  { title: 'Access Controls', icon: KeyRound },
  { title: 'GDPR-ready Architecture', icon: Globe },
]

export default function SecuritySection() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="security" aria-label="Security and privacy" className="relative py-24 md:py-32 [overflow:clip]">
      {/* Subtle watermark, CSS only */}
      <Shield
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] text-text-primary opacity-[0.03] pointer-events-none"
        aria-hidden="true"
        strokeWidth={0.75}
      />

      <div className="max-w-[1440px] mx-auto px-6 relative">
        <SectionHeader headline="Enterprise-grade privacy and security." />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SECURITY_FEATURES.map((feature, i) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
                whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-[24px] bg-surface border border-border p-6 md:p-8 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-text-primary">{feature.title}</h3>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
