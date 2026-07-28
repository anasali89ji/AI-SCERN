'use client'

import { motion } from 'framer-motion'
import { Layers, Zap, Brain, Database, Lock, TrendingUp } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const FEATURES = [
  { title: 'One Platform', icon: Layers, description: 'Scan text, images, audio, and video without switching tools.' },
  { title: 'Fast Analysis', icon: Zap, description: 'Results within seconds, even on large documents and video files.' },
  { title: 'Explainable AI', icon: Brain, description: 'Confidence score, heatmaps, and reasoning for every verdict.' },
  { title: 'Enterprise Ready', icon: Database, description: 'API access, batch scanning, and secure infrastructure built for scale.' },
  { title: 'Privacy First', icon: Lock, description: 'Uploads are protected. No customer content is used for model training.' },
  { title: 'Continuous Improvement', icon: TrendingUp, description: 'Models continuously updated against emerging AI generation techniques.' },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}

export default function WhyChooseSection() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="features" aria-label="Why organizations choose Aiscern" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-[1440px] mx-auto px-6">
        <SectionHeader headline="Why organizations choose Aiscern." />

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial={shouldReduceMotion ? undefined : 'hidden'}
          whileInView={shouldReduceMotion ? undefined : 'visible'}
          viewport={{ once: true, margin: '-100px' }}
          variants={containerVariants}
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <motion.article
                key={feature.title}
                variants={itemVariants}
                className="spotlight-card lift-hover rounded-[24px] bg-surface border border-border p-6 md:p-8 transition-all duration-300 hover:border-primary/30"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-3">{feature.title}</h3>
                <p className="text-base text-text-secondary leading-relaxed">{feature.description}</p>
              </motion.article>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
