import type { Metadata } from 'next'
import { SolutionPage } from '@/components/SolutionPage'
import { GraduationCap, FileSearch, AlertTriangle, BarChart3, Shield, Brain, Eye, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'AI Detection for Education — Aiscern',
  description: 'Detect AI-generated essays, assignments, and research papers. Purpose-built for teachers, professors, and academic institutions. Free tier available.',
  openGraph: {
    title: 'AI Detection for Education — Aiscern',
    description: 'Protect academic integrity with ensemble-based AI text detection. Built for educators and institutions.',
    url: 'https://aiscern.com/solutions/education',
    siteName: 'Aiscern',
    images: [{ url: 'https://aiscern.com/og-image.jpg' }],
  },
}

export default function EducationPage() {
  return (
    <SolutionPage
      industry="Education"
      tagline="Protect Academic Integrity at Scale"
      description="AI-generated essays are flooding classrooms. Aiscern gives educators a forensic-grade ensemble detection system to identify AI-written assignments across text modalities — with explainable results, not just scores."
      heroIcon={GraduationCap}
      accentColor="primary"
      ctaLabel="Start Free Teacher Account"
      problemTitle="The Academic Integrity Crisis"
      painPoints={[
        { title: 'ChatGPT rewrites are undetectable by eye', desc: 'Modern AI-generated text is fluent, coherent, and stylistically diverse. Human graders cannot reliably distinguish AI work from genuine student writing.' },
        { title: 'Single-model detectors have high false-positive rates', desc: 'Tools that rely on one model flag innocent students. Aiscern uses an ensemble to reduce false positives below 3%.' },
        { title: 'Students are evading detection with paraphrasing tools', desc: 'Light paraphrasing fools simpler detectors. Aiscern analyzes linguistic fingerprints that survive paraphrasing.' },
        { title: 'No audit trail for grade appeals', desc: 'Instructors need a defensible, documented record. Aiscern provides forensic reports exportable for disciplinary proceedings.' },
      ]}
      features={[
        { icon: Brain, title: 'Ensemble Detection', desc: 'Combines RoBERTa, Binoculars perplexity analysis, and Gemini for ≥96% ensemble AUC across student writing datasets.' },
        { icon: FileSearch, title: 'Sentence-Level Highlights', desc: 'Color-coded heatmap shows which sentences are AI-likely — not just an overall score.' },
        { icon: BarChart3, title: 'Confidence Scoring', desc: 'Confidence threshold system: ≥62% = AI, ≤38% = Human, middle zone = uncertain. Designed for defensible academic decisions.' },
        { icon: Layers, title: 'Batch Processing', desc: 'Upload entire class sets at once. Process 50+ documents simultaneously with a Pro or Team plan.' },
        { icon: Shield, title: 'Export & Evidence', desc: 'PDF forensic reports include scan ID, timestamp, model breakdown, and per-sentence scores for grade appeals.' },
        { icon: Eye, title: 'Multi-Language Support', desc: 'Detection works across English, Spanish, French, German, and more — covering international student submissions.' },
      ]}
      useCases={[
        { title: 'Essay & Assignment Verification', desc: 'A professor uploads 30 student essays after noticing suspiciously uniform prose. Aiscern flags 4 as high-confidence AI-generated, generating exportable evidence for academic integrity review.' },
        { title: 'Research Paper Screening', desc: 'A graduate school screens submitted theses using the API integration. Pre-defense submissions are automatically scanned, with results attached to the institutional review file.' },
        { title: 'Standardized Test Prep Auditing', desc: 'An online tutoring platform scans writing samples submitted for feedback to ensure students are practicing genuine writing, not outsourcing to AI tools.' },
      ]}
      faqs={[
        { q: 'Can Aiscern detect AI text that has been paraphrased?', a: 'Yes. Our ensemble analyzes perplexity patterns, burstiness, and phrase-level fingerprints that survive light paraphrasing. Heavily rewritten content may reduce confidence, and we report this honestly in the uncertainty zone rather than making false claims.' },
        { q: 'What happens if a student claims a false positive?', a: 'We recommend never acting on a single tool result alone. Aiscern provides per-sentence breakdowns and confidence scores so instructors can make informed decisions. Use our forensic report alongside other evidence in any academic integrity proceedings.' },
        { q: 'Can I integrate Aiscern with my LMS (Canvas, Moodle, Blackboard)?', a: 'API access is available on Pro and Team plans. You can call our detection endpoint from any LMS that supports webhook integrations or custom plugins. Documentation is at /docs/api.' },
        { q: 'Does Aiscern store student submissions?', a: 'We follow a strict data minimization policy. Scan content is processed ephemerally and not stored beyond the session unless you explicitly save a report. See our /transparency page for full details.' },
        { q: 'What languages are supported?', a: 'English detection has the highest accuracy. We support Spanish, French, German, Portuguese, and several other European languages with slightly reduced accuracy. Non-Latin scripts are in development.' },
      ]}
      testimonialQuote="We needed something defensible, not just a percentage. Aiscern's sentence-level report is the first tool I could actually present at an academic integrity committee."
      testimonialAuthor="Department Chair, unnamed institution"
      testimonialRole="Beta tester"
    />
  )
}
