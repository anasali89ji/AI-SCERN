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
      tagline="Verify Clinical Content Before It Reaches Patients"
      description="AI-hallucinated citations have already surfaced in published medical literature, and synthetic clinical notes carry real liability risk. Aiscern screens submitted medical text and imagery before it enters the record or the peer-review queue."
      heroIcon={<Heart className="w-20 h-20 lg:w-28 lg:h-28 opacity-80" strokeWidth={1} />}
      accentColor="rose"
      ctaLabel="Start Free Healthcare Account"
      heroImage="/solutions/healthcare/hero.webp"
      heroImageAlt="A physician reviewing a tablet showing patient charts while walking through a hospital corridor"
      problemImage="/solutions/healthcare/problem.webp"
      problemImageAlt="A tablet displaying a fabricated medical journal article alongside an alert notification, illustrating the risk of AI-generated clinical content"
      trustBar={[
        { label: 'Ensemble AUC', value: '≥94%' },
        { label: 'Data Handling', value: 'Ephemeral' },
        { label: 'BAA', value: 'Available' },
      ]}
      workflow={[
        { title: 'Submit Manuscript', desc: 'Upload a paper, clinical note, or research submission for screening.' },
        { title: 'Run Multi-Model Analysis', desc: 'Text and imaging ensembles analyze content for AI-generation patterns.' },
        { title: 'Receive Confidence Report', desc: 'Get a report suitable for IRB documentation or editorial review.' },
      ]}
      comparisonCompetitorName="Manual peer review"
      comparisonRows={[
        { feature: 'Screening speed per manuscript', aiscern: 'Under 2 minutes', competitor: 'Hours to days' },
        { feature: 'Sentence-level AI flagging', aiscern: true, competitor: false },
        { feature: 'Consistent across reviewers', aiscern: true, competitor: false },
        { feature: 'HIPAA-ready processing', aiscern: true, competitor: 'N/A' },
        { feature: 'Scales to high submission volume', aiscern: true, competitor: false },
      ]}
      problemTitle="AI Fabrication Reaches Clinical Content"
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
        {
          title: 'Research Submission Pre-Screening',
          challenge: 'A medical journal\'s editorial team needs to flag AI-generated sections before assigning peer reviewers.',
          action: 'Every manuscript is run through Aiscern at intake, with high-probability sections highlighted for the editor.',
          outcome: 'Suspect sections flagged before reviewer time is spent on them',
        },
        {
          title: 'Clinical Documentation Audit',
          challenge: 'A hospital quality assurance team wants to spot-check notes from high-volume providers.',
          action: 'A sample of clinical notes is scanned monthly for AI-generation patterns.',
          outcome: 'Documentation inconsistent with actual encounters surfaced for follow-up',
        },
        {
          title: 'Insurance Claim Verification',
          challenge: 'A medical review team needs to catch narratives inconsistent with standard clinical language.',
          action: 'Supporting documentation submitted with claims is scanned before adjudication.',
          outcome: 'Anomalous submissions routed to manual review',
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
        { q: 'Is Aiscern HIPAA compliant?', a: 'Aiscern processes submitted content ephemerally and does not retain patient data. For HIPAA-covered use cases, our Enterprise plan includes a Business Associate Agreement (BAA). Contact us at /enterprise for healthcare-specific compliance documentation.' },
        { q: 'How accurate is detection on medical writing specifically?', a: 'Medical writing has distinct stylistic patterns. Our ensemble performs well on academic medical text. Clinical notes — which are typically terse and formulaic — may score in uncertain ranges even when genuine. We recommend using Aiscern as a screening layer, not a definitive judgment tool.' },
        { q: 'Can Aiscern detect AI-generated radiology reports?', a: 'Yes — radiology reports are text documents and are analyzed by our text detection ensemble. The formulaic nature of radiology reporting means some genuine reports may fall in our uncertain confidence zone.' },
        { q: 'What about AI-assisted writing versus fully AI-generated?', a: 'We distinguish between AI-assisted writing (score 39–61%, uncertain zone) and fully AI-generated content (≥62%). Clinicians who use AI to structure or check their notes will typically score in the uncertain range.' },
        { q: 'Can we integrate with our EHR system?', a: 'API access is available on Pro and Enterprise plans. REST API integration with most EHR systems is technically feasible via custom middleware. Contact us for healthcare-specific integration guidance.' },
      ]}
    />
  )
}
