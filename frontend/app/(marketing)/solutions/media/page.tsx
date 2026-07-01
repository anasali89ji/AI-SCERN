import type { Metadata } from 'next'
import { SolutionPage } from '@/components/SolutionPage'
import { Newspaper, Eye, Video, FileSearch, Brain, Shield, AlertTriangle, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'AI Detection for Media & Journalism — Aiscern',
  description: 'Identify AI-generated text, synthetic images, and deepfake video in submitted media. Built for fact-checkers, journalists, and newsrooms.',
  openGraph: {
    title: 'AI Detection for Media & Journalism — Aiscern',
    url: 'https://aiscern.com/solutions/media',
    siteName: 'Aiscern',
  },
}

export default function MediaPage() {
  return (
    <SolutionPage
      industry="Media & Journalism"
      tagline="Defend the Truth Against Synthetic Media"
      description="Deepfakes, AI-generated press releases, and synthetic imagery are weaponized against journalism every day. Aiscern gives newsrooms a multi-modal detection layer across text, image, audio, and video."
      heroIcon={<Newspaper className="w-20 h-20 lg:w-28 lg:h-28 opacity-80" strokeWidth={1} />}
      accentColor="amber"
      ctaLabel="Start Free Journalist Account"
      problemTitle="The Synthetic Media Threat to Journalism"
      painPoints={[
        { title: 'AI-generated press releases flood editorial inboxes', desc: 'PR agencies and bad actors use LLMs to mass-generate press releases. Journalists spend time verifying content that may be entirely AI-fabricated.' },
        { title: 'Deepfake images are used in disinformation campaigns', desc: 'Synthetic images are shared as photographic evidence in political, social, and conflict contexts, putting newsrooms at risk of publishing misinformation.' },
        { title: 'Voice clone audio is indistinguishable from real', desc: 'AI-synthesized audio clips mimic political figures, executives, and witnesses. Traditional verification is no longer sufficient.' },
        { title: 'Viral deepfake videos spread before verification can catch up', desc: 'The detection window is narrow. By the time manual verification completes, synthetic content has already been widely shared.' },
      ]}
      features={[
        { icon: <Brain className="w-5 h-5" />, title: 'AI Text Detection', desc: 'Ensemble RoBERTa + Binoculars analysis on press releases, reports, and submitted articles with ≥96% AUC.' },
        { icon: <Eye className="w-5 h-5" />, title: 'Deepfake Image Detection', desc: 'ViT-based classifier with pixel-level integrity analysis. Detects GAN-generated and diffusion model images.' },
        { icon: <Video className="w-5 h-5" />, title: 'Video Deepfake Detection', desc: 'Frame-level analysis combined with NVIDIA NIM deepfake models for facial manipulation detection.' },
        { icon: <AlertTriangle className="w-5 h-5" />, title: 'Audio Clone Detection', desc: 'wav2vec2-based voice analysis against ASVspoof benchmarks — flags synthetic speech with 92% recall.' },
        { icon: <FileSearch className="w-5 h-5" />, title: 'Forensic Reports', desc: 'Exportable reports with model confidence breakdown, scan ID, and timestamp for editorial documentation.' },
        { icon: <Shield className="w-5 h-5" />, title: 'API for Newsroom Workflows', desc: 'Integrate detection directly into CMS submission pipelines. Auto-flag content before it reaches editorial review.' },
      ]}
      useCases={[
        { title: 'User-Submitted Media Screening', desc: 'A digital newsroom receives thousands of tips and user-submitted images during a breaking news event. Aiscern\'s API scans each image at submission and flags suspected deepfakes for priority editorial review.' },
        { title: 'Fact-Checker Text Verification', desc: 'A fact-checking desk receives a viral op-ed with suspicious uniformity. Aiscern\'s sentence-level analysis identifies AI-generated sections, informing the editorial decision to add verification caveats.' },
        { title: 'Source Audio Authentication', desc: 'An investigative journalist receives an audio clip purportedly of a government official. Aiscern\'s audio detection pipeline analyzes spectral characteristics to flag potential voice cloning.' },
      ]}
      faqs={[
        { q: 'How fast can Aiscern analyze submitted content during breaking news?', a: 'Text detection returns results in under 2 seconds for most submissions. Image and audio detection complete within 5–15 seconds. Video analysis is longer — typically 30–90 seconds per minute of footage.' },
        { q: 'Does image detection work on screenshots and compressed social media images?', a: 'Yes, though compression artifacts can reduce accuracy. We recommend submitting the highest-quality version available. Our pixel-integrity layer is designed to work on JPEG-compressed images.' },
        { q: 'What is the false positive rate for image detection?', a: 'Our image ensemble achieves approximately 3% false positive rate on benchmark datasets (14-layer ensemble, AUC 0.98). Real-world rates vary by image type. We always recommend human editorial review of flagged content.' },
        { q: 'Can Aiscern detect deepfake video of political figures?', a: 'Our video pipeline analyzes temporal consistency and facial artifacts. It performs best on face-swap and lip-sync deepfakes. Highly sophisticated full-body synthesis may reduce accuracy — see our /benchmarks page for dataset-specific results.' },
        { q: 'Is there a newsroom bulk pricing plan?', a: 'Yes. Enterprise and Team plans include volume-based pricing, dedicated API limits, and priority support. Contact us at /enterprise for newsroom-specific agreements.' },
      ]}
      testimonialQuote="In a breaking news environment, 15 seconds can be the difference between publishing a deepfake and catching one. Aiscern fits into our editorial workflow without slowing it down."
      testimonialAuthor="Digital Editor"
      testimonialRole="Beta tester"
    />
  )
}
