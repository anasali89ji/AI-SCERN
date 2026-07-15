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
      tagline="Screen Submissions Before Peer Review"
      description="LLMs can generate citations that read as plausible but don't exist, and published papers with hallucinated references have already made it into the literature. Aiscern screens manuscripts at intake so editors and reviewers aren't the last line of defense."
      heroIcon={<Microscope className="w-20 h-20 lg:w-28 lg:h-28 opacity-80" strokeWidth={1} />}
      accentColor="cyan"
      ctaLabel="Start Free Research Account"
      heroImage="/solutions/research/hero.webp"
      heroImageAlt="A scientist at a lab bench with a microscope and scattered papers, an integrity dashboard visible on a nearby screen"
      trustBar={[
        { label: 'Ensemble AUC', value: '≥96%' },
        { label: 'Journal Integration', value: 'OJS / ScholarOne' },
        { label: 'Batch Size', value: '100 submissions' },
      ]}
      workflow={[
        { title: 'Submit Manuscript', desc: 'Upload a paper or connect the API to your submission portal.' },
        { title: 'Run Section-Level Analysis', desc: 'The ensemble flags AI-generated paragraphs at the section level.' },
        { title: 'Review Editor Dashboard', desc: 'See confidence scores across the submission queue before assigning reviewers.' },
      ]}
      comparisonCompetitorName="iThenticate"
      comparisonRows={[
        { feature: 'Detects AI-generated text', aiscern: true, competitor: 'Plagiarism-focused, limited AI detection' },
        { feature: 'Section-level heatmap', aiscern: true, competitor: false },
        { feature: 'Journal management system API', aiscern: true, competitor: true },
        { feature: 'Confidence uncertainty zone', aiscern: true, competitor: false },
        { feature: 'Academic pricing tier', aiscern: true, competitor: true },
      ]}
      problemTitle="Hallucinated Citations Reach Publication"
      painPoints={[
        { title: 'AI-generated papers with hallucinated citations', desc: 'LLMs generate plausible-sounding but non-existent citations. Published papers with hallucinated references undermine evidence-based research practices.' },
        { title: 'Synthetic datasets in empirical research', desc: 'AI-generated datasets that do not reflect real-world phenomena can produce misleading research conclusions that persist in literature long after publication.' },
        { title: 'Peer review overload enabling AI submission proliferation', desc: 'Overwhelmed reviewers cannot manually detect AI-generated papers. Automated pre-screening is now a practical necessity for high-volume journals.' },
        { title: 'Data fabrication in experiment logs and lab notes', desc: 'AI assistance in generating experiment logs, results tables, and analysis text blurs the line between AI-assisted writing and outright fabrication.' },
      ]}
      features={[
        { icon: <Brain className="w-5 h-5" />, title: 'Research Paper Analysis', desc: 'Full-document ensemble detection on academic papers with ≥96% AUC. Section-level confidence breakdown for targeted review.' },
        { icon: <FileSearch className="w-5 h-5" />, title: 'Sentence-Level Heatmap', desc: 'Identify which specific paragraphs and sections are AI-flagged — crucial for peer reviewers assessing partial AI use.' },
        { icon: <Layers className="w-5 h-5" />, title: 'Batch Journal Submission Screening', desc: 'Process entire submission batches. API integration available for journal management systems (OJS, ScholarOne, Editorial Manager).' },
        { icon: <BarChart3 className="w-5 h-5" />, title: 'Statistical Confidence Reporting', desc: 'Detailed confidence intervals and model breakdown — the kind of methodological transparency academic contexts demand.' },
        { icon: <CheckCircle className="w-5 h-5" />, title: 'Audit Trail for IRB', desc: 'Timestamped reports with scan IDs for institutional review board documentation and research integrity committees.' },
        { icon: <Lock className="w-5 h-5" />, title: 'Data Privacy for Research', desc: 'Submitted manuscripts are processed ephemerally. We do not train on your research content or retain it beyond the session.' },
      ]}
      useCases={[
        {
          title: 'Journal Pre-Submission Screening',
          challenge: 'A scientific journal needs every paper screened before reviewer assignment, without slowing the pipeline.',
          action: 'The API is wired into the submission portal for automatic screening.',
          outcome: 'Confidence scores visible on a dashboard across the entire submission queue',
        },
        {
          title: 'Institutional Research Integrity Audits',
          challenge: 'A university research integrity office runs periodic audits of funded research outputs.',
          action: 'Aiscern flags outputs for closer review by the standing committee.',
          outcome: 'Audit workload concentrated on the highest-risk submissions',
        },
        {
          title: 'Grant Application Verification',
          challenge: 'A funding body needs project descriptions to reflect genuine investigator thinking.',
          action: 'Proposals are screened during evaluation.',
          outcome: 'AI-generated descriptions flagged before funding decisions are made',
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
        { q: 'How does Aiscern handle domain-specific scientific writing?', a: 'Scientific writing has domain-specific vocabularies and citation patterns. Our ensemble is trained on diverse academic corpora. Highly technical domain-specific writing may show wider confidence intervals. We recommend interpreting uncertain-zone scores (39–61%) with additional human review.' },
        { q: 'Can Aiscern detect AI use in only parts of a paper?', a: 'Yes — our sentence-level analysis highlights individual paragraphs and sentences that score above the AI threshold. This is particularly useful for papers where AI was used to generate introductions or discussion sections while methods and results are genuine.' },
        { q: 'Does detection work on preprints and arXiv-style papers?', a: 'Yes. Aiscern analyzes the text content of papers regardless of their publication status. PDF upload is supported — text is extracted and analyzed through the full ensemble.' },
        { q: 'What about legitimate AI-assisted writing tools used by researchers?', a: 'We distinguish between AI-assisted writing (grammar, clarity editing — typically scores 39–61%) and AI-generated content (≥62%). Many journals now require disclosure of AI assistance; Aiscern helps quantify the extent of that assistance.' },
        { q: 'Is there academic pricing available?', a: 'Yes. Educational institutions and non-commercial research organizations qualify for discounted plans. Contact us at /contact with your institutional email for academic pricing details.' },
      ]}
    />
  )
}
