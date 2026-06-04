import type { Metadata } from 'next'
import { SolutionPage } from '@/components/SolutionPage'
import { Microscope, Brain, FileSearch, Layers, BarChart3, Shield, CheckCircle, Lock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'AI Detection for Academic Research — Aiscern',
  description: 'Validate authenticity of research papers, datasets, and experiment logs. Maintain scientific integrity with ensemble AI detection and API access.',
  openGraph: {
    title: 'AI Detection for Academic Research — Aiscern',
    url: 'https://aiscern.com/solutions/research',
    siteName: 'Aiscern',
  },
}

export default function ResearchPage() {
  return (
    <SolutionPage
      industry="Academic Research"
      tagline="Uphold Scientific Integrity in the AI Age"
      description="AI-generated research content threatens peer review, reproducibility, and scientific trust. Aiscern helps researchers, journal editors, and institutions validate the authenticity of submitted work before it enters the scientific record."
      heroIcon={Microscope}
      accentColor="cyan"
      ctaLabel="Start Free Research Account"
      problemTitle="Scientific Integrity Under Pressure"
      painPoints={[
        { title: 'AI-generated papers with hallucinated citations', desc: 'LLMs generate plausible-sounding but non-existent citations. Published papers with hallucinated references undermine evidence-based research practices.' },
        { title: 'Synthetic datasets in empirical research', desc: 'AI-generated datasets that do not reflect real-world phenomena can produce misleading research conclusions that persist in literature long after publication.' },
        { title: 'Peer review overload enabling AI submission proliferation', desc: 'Overwhelmed reviewers cannot manually detect AI-generated papers. Automated pre-screening is now a practical necessity for high-volume journals.' },
        { title: 'Data fabrication in experiment logs and lab notes', desc: 'AI assistance in generating experiment logs, results tables, and analysis text blurs the line between AI-assisted writing and outright fabrication.' },
      ]}
      features={[
        { icon: Brain, title: 'Research Paper Analysis', desc: 'Full-document ensemble detection on academic papers with ≥96% AUC. Section-level confidence breakdown for targeted review.' },
        { icon: FileSearch, title: 'Sentence-Level Heatmap', desc: 'Identify which specific paragraphs and sections are AI-flagged — crucial for peer reviewers assessing partial AI use.' },
        { icon: Layers, title: 'Batch Journal Submission Screening', desc: 'Process entire submission batches. API integration available for journal management systems (OJS, ScholarOne, Editorial Manager).' },
        { icon: BarChart3, title: 'Statistical Confidence Reporting', desc: 'Detailed confidence intervals and model breakdown — the kind of methodological transparency academic contexts demand.' },
        { icon: CheckCircle, title: 'Audit Trail for IRB', desc: 'Timestamped reports with scan IDs for institutional review board documentation and research integrity committees.' },
        { icon: Lock, title: 'Data Privacy for Research', desc: 'Submitted manuscripts are processed ephemerally. We do not train on your research content or retain it beyond the session.' },
      ]}
      useCases={[
        { title: 'Journal Pre-Submission Screening', desc: 'A scientific journal integrates Aiscern\'s API into its submission portal. Every paper triggers automated AI screening before assignment to peer reviewers, with a dashboard showing confidence scores across the submission queue.' },
        { title: 'Institutional Research Integrity Audits', desc: 'A university research integrity office conducts periodic audits of funded research outputs, using Aiscern to flag submissions for closer review by the standing committee.' },
        { title: 'Grant Application Verification', desc: 'A funding body screens research proposals during evaluation to identify AI-generated project descriptions, ensuring that funded research reflects genuine investigator thinking.' },
      ]}
      faqs={[
        { q: 'How does Aiscern handle domain-specific scientific writing?', a: 'Scientific writing has domain-specific vocabularies and citation patterns. Our ensemble is trained on diverse academic corpora. Highly technical domain-specific writing may show wider confidence intervals. We recommend interpreting uncertain-zone scores (39–61%) with additional human review.' },
        { q: 'Can Aiscern detect AI use in only parts of a paper?', a: 'Yes — our sentence-level analysis highlights individual paragraphs and sentences that score above the AI threshold. This is particularly useful for papers where AI was used to generate introductions or discussion sections while methods and results are genuine.' },
        { q: 'Does detection work on preprints and arXiv-style papers?', a: 'Yes. Aiscern analyzes the text content of papers regardless of their publication status. PDF upload is supported — text is extracted and analyzed through the full ensemble.' },
        { q: 'What about legitimate AI-assisted writing tools used by researchers?', a: 'We distinguish between AI-assisted writing (grammar, clarity editing — typically scores 39–61%) and AI-generated content (≥62%). Many journals now require disclosure of AI assistance; Aiscern helps quantify the extent of that assistance.' },
        { q: 'Is there academic pricing available?', a: 'Yes. Educational institutions and non-commercial research organizations qualify for discounted plans. Contact us at /contact with your institutional email for academic pricing details.' },
      ]}
    />
  )
}
