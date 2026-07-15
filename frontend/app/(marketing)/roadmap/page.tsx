import { Rocket, CheckCircle2, Circle, FlaskConical } from 'lucide-react'
import { SiteNav } from '@/components/SiteNav'

export const metadata = {
  title: 'Product Roadmap — AI-SCERN',
  description: 'See what we are building next for AI media attestation and forensics.',
}

const ROADMAP = [
  {
    quarter: 'Q3 2026',
    status: 'in-progress',
    items: [
      'Real-time video stream attestation (WebRTC)',
      'Mobile native SDKs (iOS & Android)',
      'Enterprise SSO with SAML 2.0 & OIDC',
      'Advanced audio deepfake detection (TTS vs. VC)',
    ],
  },
  {
    quarter: 'Q4 2026',
    status: 'planned',
    items: [
      'Blockchain attestation certificates (Ethereum L2)',
      'Federated learning for private model tuning',
      'Chrome extension for in-browser media scanning',
      'Multi-language support (12 languages)',
    ],
  },
  {
    quarter: 'Q1 2027',
    status: 'planned',
    items: [
      'Autonomous red-team agent for model stress testing',
      '3D Gaussian Splatting forensics',
      'On-premise air-gapped deployments',
      'NIST AI RMF compliance toolkit',
    ],
  },
  {
    quarter: 'Q2 2027',
    status: 'research',
    items: [
      'Quantum-resistant watermarking schemes',
      'Neural radiance field (NeRF) detection',
      'Cross-modal consistency reasoning (text+image+video)',
      'Real-time hologram attestation',
    ],
  },
]

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <SiteNav />

      <main className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-6">
              <Rocket className="w-3.5 h-3.5" />
              Public Roadmap
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">What we are building</h1>
            <p className="text-lg text-slate-400">
              Transparent priorities. No vaporware.
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-4 sm:left-8 top-0 bottom-0 w-px bg-white/[0.08]" />

            <div className="space-y-12">
              {ROADMAP.map((group) => (
                <div key={group.quarter} className="relative pl-12 sm:pl-20">
                  <div className="absolute left-2.5 sm:left-6.5 top-1.5 w-3 h-3 rounded-full border-2 border-slate-800 bg-slate-700" />

                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xl font-bold text-white">{group.quarter}</h2>
                    <span className={`
                      inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                      ${group.status === 'in-progress' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : ''}
                      ${group.status === 'planned' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : ''}
                      ${group.status === 'research' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : ''}
                    `}>
                      {group.status === 'in-progress' && <CheckCircle2 className="w-3 h-3" />}
                      {group.status === 'planned' && <Circle className="w-3 h-3" />}
                      {group.status === 'research' && <FlaskConical className="w-3 h-3" />}
                      {group.status}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <div
                        key={item}
                        className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.04] bg-slate-900/30 text-sm text-slate-300 hover:bg-slate-900/50 transition-colors"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
