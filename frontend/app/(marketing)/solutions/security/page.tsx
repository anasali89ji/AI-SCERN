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
      tagline="Catch Synthetic Fraud at Ingestion"
      description="Voice-clone fraud incidents like the Arup video-call scam, which cost the firm $25.6M in a single day, show how far synthetic identity attacks have come. Aiscern's audio, image, and text ensembles screen calls, documents, and messages before they reach a decision point."
      heroIcon={<ShieldCheck className="w-20 h-20 lg:w-28 lg:h-28 opacity-80" strokeWidth={1} />}
      accentColor="rose"
      ctaLabel="Start Free Security Account"
      heroImage="/solutions/security/hero.webp"
      heroImageAlt="A security operations center analyst at a curved monitor array displaying threat maps at night"
      problemImage="/solutions/security/problem.webp"
      problemImageAlt="A split image showing a grandmother on the phone in a warm kitchen next to an attacker using voice-cloning software in a dark room"
      trustBar={[
        { label: 'Text Scan Time', value: '<2 sec' },
        { label: 'Audio Benchmark', value: 'ASVspoof' },
        { label: 'Output Format', value: 'SIEM-ready JSON' },
      ]}
      workflow={[
        { title: 'Ingest Call or Document', desc: 'Route inbound calls, emails, or documents to the API.' },
        { title: 'Run Ensemble Scan', desc: 'Audio, image, and text models score the content in real time.' },
        { title: 'Alert With Confidence Score', desc: 'The SOC dashboard receives structured JSON with a confidence score.' },
      ]}
      comparisonCompetitorName="Pindrop (audio only)"
      comparisonRows={[
        { feature: 'Modalities covered', aiscern: 'Audio + image + text', competitor: 'Audio only' },
        { feature: 'Text detection latency', aiscern: 'Under 2 sec', competitor: 'N/A' },
        { feature: 'SIEM-ready JSON output', aiscern: true, competitor: true },
        { feature: 'KYC document screening', aiscern: true, competitor: false },
        { feature: 'Enterprise SLA', aiscern: true, competitor: true },
      ]}
      problemTitle="Synthetic Identity Attacks Are Scaling"
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
        {
          title: 'Real-Time Call Authentication',
          challenge: 'A financial services firm needs to flag voice synthesis attempts during account access calls.',
          action: 'The audio API is wired into the inbound call verification pipeline.',
          outcome: 'Suspected voice clone attempts flagged during the call, not after',
        },
        {
          title: 'KYC Identity Document Screening',
          challenge: 'A fintech company needs to catch synthetic ID photos and selfie videos at onboarding.',
          action: 'Submitted documents run through the image pipeline as part of the onboarding stack.',
          outcome: 'Synthetic identity attempts blocked before account approval',
        },
        {
          title: 'Phishing Email Triage',
          challenge: 'A SOC team is overwhelmed by inbound email volume during triage.',
          action: 'Flagged emails are routed through the text API automatically.',
          outcome: 'Analyst triage time concentrated on high-confidence synthetic content',
        },
      ]}
      caseStudy={{
        quote: '[QUOTE TEXT HERE]',
        author: '[CUSTOMER NAME]',
        role: '[ROLE]',
        company: '[COMPANY]',
        metric: '[METRIC]',
        metricLabel: 'Placeholder metric',
        isPlaceholder: true,
      }}
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
