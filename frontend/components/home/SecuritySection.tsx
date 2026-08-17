import { Lock, Database, Trash2, ShieldCheck, KeyRound, Globe, Shield } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Reveal } from '@/components/motion/Reveal'

const SECURITY_FEATURES = [
  { title: 'End-to-End Encryption', desc: 'All uploads are encrypted in transit and at rest using industry-standard protocols.', icon: Lock },
  { title: 'Isolated Secure Storage', desc: 'Files are stored in isolated Cloudflare R2 buckets with strict access controls.', icon: Database },
  { title: 'Automatic File Deletion', desc: 'Content is purged automatically after analysis. We do not retain your data.', icon: Trash2 },
  { title: 'No Training on Your Content', desc: 'Your files are never used to train or improve our AI detection models.', icon: ShieldCheck },
  { title: 'Role-Based Access Controls', desc: 'Enterprise teams get granular permissions, audit logs, and SSO integration.', icon: KeyRound },
  { title: 'GDPR-Ready Architecture', desc: 'Built to pass compliance audits — not just checkbox exercises.', icon: Globe },
]

export default function SecuritySection() {
  return (
    <section id="security" aria-label="Security and privacy for trust verification" className="relative py-24 md:py-32 [overflow:clip]">
      {/* Subtle watermark, CSS only */}
      <Shield
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] text-text-primary opacity-[0.03] pointer-events-none"
        aria-hidden="true"
        strokeWidth={0.75}
      />

      <div className="max-w-[1440px] mx-auto px-6 relative">
        <SectionHeader headline="Your files are not our training data." subheadline="Enterprise-grade security and privacy built into every scan." />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SECURITY_FEATURES.map((feature, i) => {
            const Icon = feature.icon
            return (
              <Reveal key={feature.title} delay={i * 0.05} duration={0.4} y={16} amount={0.1}
                className="rounded-[24px] bg-surface border border-border p-6 md:p-8 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-text-primary">{feature.title}</h3>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
