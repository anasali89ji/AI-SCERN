import type { Metadata } from 'next'
import { SolutionPage } from '@/components/SolutionPage'
import { ShieldCheck, AlertTriangle, Brain, Eye, Layers, Lock, BarChart3, FileSearch } from 'lucide-react'

export const metadata: Metadata = {
  title: 'AI Detection for Cybersecurity — Aiscern',
  description: 'Detect deepfake audio in fraud calls, synthetic identity documents, and AI-crafted phishing content. Built for trust & safety and cybersecurity teams.',
  openGraph: {
    title: 'AI Detection for Cybersecurity — Aiscern',
    url: 'https://aiscern.com/solutions/security',
    siteName: 'Aiscern',
  },
}

export default function SecurityPage() {
  return (
    <SolutionPage
      industry="Cybersecurity"
      tagline="Stop Synthetic Threats Before They Land"
      description="AI-powered fraud — voice clone scams, deepfake identity verification bypass, and AI-crafted spear-phishing — is the fastest-growing attack surface. Aiscern gives security teams multi-modal detection to stop synthetic content at every ingestion point."
      heroIcon={<ShieldCheck className="w-20 h-20 lg:w-28 lg:h-28 opacity-80" strokeWidth={1} />}
      accentColor="rose"
      ctaLabel="Start Free Security Account"
      problemTitle="Synthetic Content in the Threat Landscape"
      painPoints={[
        { title: 'Voice clone fraud is bypassing traditional authentication', desc: 'Real-time voice synthesis tools allow attackers to impersonate executives, family members, and customer service agents in live calls.' },
        { title: 'Deepfake identity documents fool KYC systems', desc: 'AI-generated ID photos and synthesized video selfies are being used to bypass Know Your Customer verification at financial institutions.' },
        { title: 'AI-crafted spear-phishing is highly personalized', desc: 'LLMs generate convincing, context-aware phishing emails at scale, with none of the grammatical errors that traditionally flagged phishing attempts.' },
        { title: 'Trust & Safety teams are overwhelmed by synthetic UGC', desc: 'User-generated content platforms face massive volumes of AI-generated spam, synthetic reviews, and deepfake images that exceed manual moderation capacity.' },
      ]}
      features={[
        { icon: <Brain className="w-5 h-5" />, title: 'AI Text Detection', desc: 'Identify AI-generated phishing, social engineering, and synthetic content in ingested text streams.' },
        { icon: <Eye className="w-5 h-5" />, title: 'Image Forensics', desc: 'Detect synthetic identity photos, AI-generated profile images, and fabricated document imagery.' },
        { icon: <AlertTriangle className="w-5 h-5" />, title: 'Voice Clone Detection', desc: 'wav2vec2 spectral analysis flags AI-synthesized speech against ASVspoof benchmark datasets.' },
        { icon: <Lock className="w-5 h-5" />, title: 'API Integration', desc: 'High-throughput REST API designed for security platform integration. Sub-2-second text detection for real-time screening.' },
        { icon: <Layers className="w-5 h-5" />, title: 'Batch Processing', desc: 'Run bulk scans across ingested content queues. Prioritize high-risk items with confidence-score filtering.' },
        { icon: <BarChart3 className="w-5 h-5" />, title: 'SIEM-Ready Reporting', desc: 'Scan results include structured JSON output compatible with SIEM ingestion and SOC dashboards.' },
      ]}
      useCases={[
        { title: 'Real-Time Call Authentication', desc: 'A financial services firm integrates Aiscern\'s audio API into its inbound call verification pipeline to flag real-time voice synthesis attempts during account access requests.' },
        { title: 'KYC Identity Document Screening', desc: 'A fintech company screens user-submitted selfie videos and ID photos through Aiscern\'s image pipeline as part of its onboarding fraud detection stack.' },
        { title: 'Phishing Email Triage', desc: 'A SOC team routes flagged inbound emails through Aiscern\'s text API to identify AI-generated spear-phishing, reducing analyst triage time by prioritizing high-confidence synthetic content.' },
      ]}
      faqs={[
        { q: 'What is the latency of real-time audio detection?', a: 'Asynchronous audio detection processes a 30-second clip in approximately 3–8 seconds. Real-time streaming detection is on our roadmap. For call center integration, we recommend a post-call analysis pipeline initially.' },
        { q: 'Can Aiscern detect voice clones of specific individuals?', a: 'Our detection is general-purpose — it identifies AI-synthesized speech characteristics rather than comparing against a specific person\'s voiceprint. Speaker verification (matching a claimed identity) requires a separate biometric system.' },
        { q: 'What throughput does the API support?', a: 'Pro plans support 100 concurrent requests. Enterprise plans have custom rate limits. Contact us at /enterprise for high-throughput security platform integration requirements.' },
        { q: 'How does Aiscern handle evasion attempts?', a: 'We continuously update our ensemble models against known evasion techniques. Our text detection includes homoglyph and encoding attack detection. Adversarial robustness is an ongoing research priority.' },
        { q: 'Is there a SIEM connector available?', a: 'We provide structured JSON output via API. Direct SIEM connectors for Splunk and Elastic are on our roadmap. In the meantime, a lightweight middleware integration is straightforward via our REST API.' },
      ]}
    />
  )
}
