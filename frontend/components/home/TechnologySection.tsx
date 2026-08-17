import { SectionHeader } from '@/components/ui/SectionHeader'
import { Reveal } from '@/components/motion/Reveal'
import { LineDrawVertical } from '@/components/motion/LineDraw'

const LAYERS = [
  { title: 'Universal Input', desc: 'Accepts text, images, audio, and video in any common format. No preprocessing required.', border: 'border-l-primary' },
  { title: 'Signal Extraction', desc: 'Normalizes, resizes, and extracts raw forensic signals invisible to the human eye.', border: 'border-l-secondary' },
  { title: 'Multi-Model Ensemble', desc: 'Specialized AI detection models inspect content in parallel — no single point of failure.', border: 'border-l-cyan' },
  { title: 'Deepfake Forensics', desc: 'Pixel-level, spectral, and linguistic forensics hunt for synthetic artifacts across every modality.', border: 'border-l-primary' },
  { title: 'Cross-Model Validation', desc: 'Results are cross-referenced to resolve conflicts, reduce false positives, and boost trust verification accuracy.', border: 'border-l-secondary' },
  { title: 'Trust Scoring', desc: 'Aggregates all signals into an explainable authenticity score with clear reasoning.', border: 'border-l-emerald' },
  { title: 'Audit-Ready Reports', desc: 'Produces human-readable trust verification reports with evidence, reasoning, and confidence breakdowns.', border: 'border-l-emerald' },
]

export default function TechnologySection() {
  return (
    <section id="technology" aria-label="AI trust verification technology" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHeader headline="Built so you don't have to trust a single algorithm." />

        <div className="relative">
          {/* Vertical connector */}
          <div className="absolute left-6 md:left-8 top-2 bottom-2 w-px overflow-hidden" aria-hidden="true">
            <LineDrawVertical className="h-full w-full trust-pulse"
              style={{ background: 'linear-gradient(180deg, rgba(37,99,235,0.7) 0%, rgba(16,185,129,0.5) 100%)' }} />
          </div>

          <div className="space-y-4">
            {LAYERS.map((layer, i) => (
              <Reveal key={layer.title} delay={i * 0.08} duration={0.5} y={24} amount={0.1}
                className={`relative ml-2 md:ml-4 rounded-2xl bg-surface border border-border ${layer.border} border-l-4 p-6`}>
                <h3 className="text-lg font-semibold text-text-primary mb-1">{layer.title}</h3>
                <p className="text-sm md:text-base text-text-secondary leading-relaxed">{layer.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
