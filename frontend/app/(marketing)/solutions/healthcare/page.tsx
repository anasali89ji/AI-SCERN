import type { Metadata } from 'next'
import { SolutionPage } from '@/components/SolutionPage'
import { Heart, FileSearch, Brain, Shield, Lock, Eye, BarChart3, AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'AI Detection for Healthcare — Aiscern',
  description: 'Identify AI-generated medical literature, synthetic patient data, and fabricated imagery in clinical submissions. Free tier for healthcare professionals.',
  openGraph: {
    title: 'AI Detection for Healthcare — Aiscern',
    url: 'https://aiscern.com/solutions/healthcare',
    siteName: 'Aiscern',
  },
}

export default function HealthcarePage() {
  return (
    <SolutionPage
      industry="Healthcare"
      tagline="Ensure Clinical Accuracy in an AI-Generated World"
      description="Fabricated research, synthetic patient records, and AI-generated clinical notes are threats to patient safety and scientific integrity. Aiscern helps healthcare organizations verify the authenticity of submitted medical content."
      heroIcon={<Heart className="w-20 h-20 lg:w-28 lg:h-28 opacity-80" strokeWidth={1} />}
      accentColor="rose"
      ctaLabel="Start Free Healthcare Account"
      problemTitle="AI Fabrication Risks in Healthcare"
      painPoints={[
        { title: 'AI-generated medical research is entering journals', desc: 'Predatory journals and some mainstream publications have published papers with AI-generated content and hallucinated references, threatening evidence-based medicine.' },
        { title: 'Synthetic clinical notes create liability', desc: 'AI-generated clinical documentation that does not accurately reflect patient encounters creates malpractice exposure and patient safety risks.' },
        { title: 'Fabricated patient testimonials misrepresent outcomes', desc: 'Healthcare marketing increasingly relies on AI-generated patient stories, creating ethical and regulatory compliance risks.' },
        { title: 'Medical imaging manipulation is a growing concern', desc: 'AI-generated or modified medical images (X-rays, MRIs) submitted in research or insurance contexts require forensic-level verification.' },
      ]}
      features={[
        { icon: <Brain className="w-5 h-5" />, title: 'Medical Literature Screening', desc: 'Detect AI-generated sections in submitted research papers, systematic reviews, and clinical study reports.' },
        { icon: <FileSearch className="w-5 h-5" />, title: 'Clinical Document Analysis', desc: 'Analyze clinical notes, discharge summaries, and patient reports for AI-generation patterns.' },
        { icon: <Eye className="w-5 h-5" />, title: 'Medical Image Forensics', desc: 'ViT-based detection identifies digitally synthesized medical imagery for research and insurance fraud contexts.' },
        { icon: <Lock className="w-5 h-5" />, title: 'HIPAA-Conscious Design', desc: 'Ephemeral processing ensures patient data is never retained. Enterprise plans include Data Processing Agreements.' },
        { icon: <Shield className="w-5 h-5" />, title: 'Audit Reports', desc: 'Timestamped PDF reports for compliance documentation, IRB submissions, and quality assurance records.' },
        { icon: <BarChart3 className="w-5 h-5" />, title: 'Confidence Transparency', desc: 'Explicit confidence intervals ensure healthcare professionals understand result limitations before acting on them.' },
      ]}
      useCases={[
        { title: 'Research Submission Pre-Screening', desc: 'A medical journal\'s editorial team runs submitted manuscripts through Aiscern before peer review assignment, flagging high-AI-probability sections for additional scrutiny.' },
        { title: 'Clinical Documentation Audit', desc: 'A hospital quality assurance team spot-checks clinical notes from high-volume providers to identify AI-generated documentation patterns that may not reflect actual patient encounters.' },
        { title: 'Insurance Claim Verification', desc: 'An insurance medical review team scans supporting documentation submitted with claims to identify AI-generated narratives inconsistent with standard clinical language patterns.' },
      ]}
      faqs={[
        { q: 'Is Aiscern HIPAA compliant?', a: 'Aiscern processes submitted content ephemerally and does not retain patient data. For HIPAA-covered use cases, our Enterprise plan includes a Business Associate Agreement (BAA). Contact us at /enterprise for healthcare-specific compliance documentation.' },
        { q: 'How accurate is detection on medical writing specifically?', a: 'Medical writing has distinct stylistic patterns. Our ensemble performs well on academic medical text. Clinical notes — which are typically terse and formulaic — may score in uncertain ranges even when genuine. We recommend using Aiscern as a screening layer, not a definitive judgment tool.' },
        { q: 'Can Aiscern detect AI-generated radiology reports?', a: 'Yes — radiology reports are text documents and are analyzed by our text detection ensemble. The formulaic nature of radiology reporting means some genuine reports may fall in our uncertain confidence zone.' },
        { q: 'What about AI-assisted writing versus fully AI-generated?', a: 'We distinguish between AI-assisted writing (score 39–61%, uncertain zone) and fully AI-generated content (≥62%). Clinicians who use AI to structure or check their notes will typically score in the uncertain range.' },
        { q: 'Can we integrate with our EHR system?', a: 'API access is available on Pro and Enterprise plans. REST API integration with most EHR systems is technically feasible via custom middleware. Contact us for healthcare-specific integration guidance.' },
      ]}
    />
  )
}
