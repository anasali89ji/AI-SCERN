import { Shield, Lock, Eye, Server, Fingerprint, FileCheck } from 'lucide-react'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'

export const metadata = {
  title: 'Security & Compliance — AI-SCERN',
  description: 'Enterprise-grade security, SOC 2 compliance, and zero-trust architecture for AI media attestation.',
}

const SECURITY_PILLARS = [
  {
    icon: Lock,
    title: 'End-to-End Encryption',
    desc: 'All uploads are encrypted in transit (TLS 1.3) and at rest (AES-256-GCM). Keys are managed via AWS KMS with automatic rotation.',
  },
  {
    icon: Eye,
    title: 'Zero-Knowledge Processing',
    desc: 'Our inference pipeline processes files in ephemeral GPU containers. No persistent storage of user media after analysis completes.',
  },
  {
    icon: Server,
    title: 'SOC 2 Type II',
    desc: 'AI-SCERN maintains SOC 2 Type II certification with annual third-party audits. Our controls cover security, availability, and confidentiality.',
  },
  {
    icon: Fingerprint,
    title: 'Biometric Data Protection',
    desc: 'Facial templates and voiceprints are never stored. We extract only non-reversible forensic features for detection purposes.',
  },
  {
    icon: FileCheck,
    title: 'Audit Logging',
    desc: 'Immutable audit trails for every detection request. Enterprise customers can stream logs to their SIEM via our API.',
  },
  {
    icon: Shield,
    title: 'Adversarial Robustness',
    desc: 'Models are continuously tested against adversarial perturbations, GAN camouflage, and deepfake evasion techniques.',
  },
]

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-surface-deep text-silver-800">
      <SiteNav />

      <main className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-6">
              <Shield className="w-3.5 h-3.5" />
              Trust & Safety
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
              Security is not a feature. It is the foundation.
            </h1>
            <p className="text-lg text-silver-600 max-w-2xl mx-auto leading-relaxed">
              AI-SCERN is built on a zero-trust architecture designed for enterprises handling sensitive media. Every byte is protected.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SECURITY_PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                className="group rounded-2xl border border-white/[0.06] bg-surface-elevated/40 p-6 hover:bg-surface-elevated/60 hover:border-white/[0.12] transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <pillar.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{pillar.title}</h3>
                <p className="text-sm text-silver-600 leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-surface-elevated to-surface-elevated/50 p-8 sm:p-12 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Need a security review?</h2>
            <p className="text-silver-600 mb-6 max-w-lg mx-auto">
              Our security team is available for custom compliance reviews, penetration testing coordination, and architecture consultations.
            </p>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-[#0A0A0A] font-semibold text-sm transition-colors"
            >
              Contact Security Team
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
