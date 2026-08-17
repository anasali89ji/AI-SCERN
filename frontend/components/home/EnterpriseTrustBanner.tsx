import { Users, GraduationCap, Globe, Scale, CheckCircle } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { RevealStagger, RevealStaggerItem } from '@/components/motion/RevealStagger'

const CARDS = [
  {
    title: 'HR Recruitment',
    icon: Users,
    features: ['Detect AI-written CVs', 'Screen Cover Letters', 'Interview Transcript Analysis'],
  },
  {
    title: 'Academic Integrity',
    icon: GraduationCap,
    features: ['Essay & Thesis Detection', 'Research Verification', 'Assignment Bulk Review'],
  },
  {
    title: 'Media Verification',
    icon: Globe,
    features: ['Deepfake Image Detection', 'AI Voice Analysis', 'Synthetic Video Forensics'],
  },
  {
    title: 'Legal Verification',
    icon: Scale,
    features: ['Evidence Screening', 'Document Authenticity', 'Digital Media Review'],
  },
]

export default function EnterpriseTrustBanner() {
  return (
    <section id="trust" aria-label="Enterprise trust verification" className="relative py-24 md:py-32 [overflow:clip]">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="hero-mesh-1 absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.10) 0%, transparent 70%)', filter: 'blur(90px)' }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(160,174,192,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(160,174,192,0.5) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="max-w-[1440px] mx-auto px-6 relative">
        <SectionHeader
          headline="Trusted by professionals who verify digital authenticity every day."
          subheadline="Whether you're screening AI-written assignments, verifying media for publication, reviewing legal evidence, or evaluating recruitment documents — Aiscern provides one unified trust verification platform."
        />

        <RevealStagger className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {CARDS.map((card) => {
            const Icon = card.icon
            return (
              <RevealStaggerItem key={card.title}
                className="rounded-[24px] bg-surface/80 backdrop-blur-xl md:backdrop-blur-none md:bg-surface border border-border p-6 md:p-8 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_20px_40px_rgba(37,99,235,0.08)] hover:-translate-y-1">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-4">{card.title}</h3>
                <ul className="space-y-2">
                  {card.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                      <CheckCircle className="w-4 h-4 text-emerald flex-shrink-0" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              </RevealStaggerItem>
            )
          })}
        </RevealStagger>
      </div>
    </section>
  )
}
