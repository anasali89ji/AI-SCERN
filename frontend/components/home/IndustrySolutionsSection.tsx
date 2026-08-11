'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const INDUSTRIES = [
  {
    title: 'Higher Education',
    problem: 'AI-written theses are passing review boards. Academic integrity erodes degree by degree.',
    solution: 'Aiscern scans assignments in bulk, flags AI-generated text, and produces audit-ready trust verification reports for examination offices.',
    href: '/solutions/education',
    bg: 'radial-gradient(circle at 90% 10%, rgba(124,58,237,0.05), transparent 50%)',
  },
  {
    title: 'Human Resources',
    problem: 'Candidates are outsourcing their personality to ChatGPT. AI-polished CVs mask the real applicant.',
    solution: 'Screen written applications and video transcripts for synthetic content before you hire — know who actually wrote the application.',
    href: '/solutions/hr',
    bg: 'radial-gradient(circle at 10% 90%, rgba(37,99,235,0.05), transparent 50%)',
  },
  {
    title: 'Media & Journalism',
    problem: "You have 10 minutes to publish. A deepfake doesn't need more than 5 to go viral.",
    solution: 'Verify images, audio, and video before publication with shareable content authenticity reports that stand up to scrutiny.',
    href: '/solutions/media',
    bg: 'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.03), transparent 70%)',
  },
  {
    title: 'Legal & Compliance',
    problem: 'Deepfake evidence and AI-drafted contracts are entering proceedings undetected — jeopardizing case outcomes.',
    solution: 'Support digital evidence review with forensic-grade AI content detection and trust verification reports admissible in legal contexts.',
    href: '/solutions/legal',
    bg: 'radial-gradient(circle at 90% 90%, rgba(16,185,129,0.05), transparent 50%)',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}

export default function IndustrySolutionsSection() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="solutions" aria-label="Industry trust verification solutions" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-[1440px] mx-auto px-6">
        <SectionHeader headline="Built for every industry fighting AI-generated deception." />

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8"
          initial={shouldReduceMotion ? undefined : 'hidden'}
          whileInView={shouldReduceMotion ? undefined : 'visible'}
          viewport={{ once: true, margin: '-100px' }}
          variants={containerVariants}
        >
          {INDUSTRIES.map((industry) => (
            <motion.div key={industry.title} variants={itemVariants} className="group relative">
              <Link
                href={industry.href}
                className="bento-shimmer block relative rounded-[24px] bg-surface border border-border p-6 md:p-8 h-full transition-all duration-300 hover:border-primary/30 overflow-hidden"
              >
                <div className="absolute inset-0 pointer-events-none" style={{ background: industry.bg }} aria-hidden="true" />
                <div className="relative">
                  <h3 className="text-xl md:text-2xl font-semibold text-text-primary mb-3">{industry.title}</h3>
                  <p className="text-base text-text-secondary leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
                    {industry.problem}
                  </p>
                  <div className="max-h-0 opacity-0 group-hover:max-h-40 group-hover:opacity-100 group-hover:mt-4 transition-all duration-300 overflow-hidden">
                    <p className="text-base text-text-secondary leading-relaxed mb-4">{industry.solution}</p>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      Learn more <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
