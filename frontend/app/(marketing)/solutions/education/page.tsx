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
      tagline="Defend Academic Integrity Without Guesswork"
      description="A growing share of student submissions now include AI-written passages that are fluent enough to pass a human read-through. Aiscern's 8-model ensemble flags AI-written assignments with a sub-3% false-positive rate and a sentence-level report educators can act on."
      heroIcon={<GraduationCap className="w-20 h-20 lg:w-28 lg:h-28 opacity-80" strokeWidth={1} />}
      accentColor="primary"
      ctaLabel="Start Free Teacher Account"
      heroImage="/solutions/education/hero.webp"
      heroImageAlt="A professor at a desk grading printed student essays with a red pen, laptop open beside them showing a scan dashboard"
      problemImage="/solutions/education/problem.webp"
      problemImageAlt="Two student essays side by side on a desk, one messy and handwritten-style, one uniformly polished, illustrating the detection challenge"
      trustBar={[
        { label: 'Ensemble AUC', value: '≥94%' },
        { label: 'False Positive Rate', value: '<3%' },
        { label: 'API Uptime', value: '99.9%' },
      ]}
      workflow={[
        { title: 'Upload Assignment', desc: 'Import essays individually or as a class-set batch from your LMS export.' },
        { title: 'Run Ensemble Scan', desc: '8 models analyze perplexity, burstiness, and phrase-level fingerprints.' },
        { title: 'Export Forensic Report', desc: 'Download a sentence-level PDF with scan ID and timestamp for grade appeals.' },
      ]}
      comparisonCompetitorName="Turnitin AI Detection"
      comparisonRows={[
        { feature: 'Detection approach', aiscern: '8-model ensemble', competitor: 'Single proprietary model' },
        { feature: 'Sentence-level heatmap', aiscern: true, competitor: true },
        { feature: 'Confidence uncertainty zone', aiscern: true, competitor: false },
        { feature: 'Standalone (no LMS lock-in required)', aiscern: true, competitor: false },
        { feature: 'Free tier available', aiscern: true, competitor: false },
      ]}
      problemTitle="AI Essays Are Hard to Spot by Eye"
      painPoints={[
        { title: 'ChatGPT rewrites are undetectable by eye', desc: 'Modern AI-generated text is fluent, coherent, and stylistically diverse. Human graders cannot reliably distinguish AI work from genuine student writing.' },
        { title: 'Single-model detectors have high false-positive rates', desc: 'Tools that rely on one model flag innocent students. Aiscern uses an ensemble to reduce false positives below 3%.' },
        { title: 'Students are evading detection with paraphrasing tools', desc: 'Light paraphrasing fools simpler detectors. Aiscern analyzes linguistic fingerprints that survive paraphrasing.' },
        { title: 'No audit trail for grade appeals', desc: 'Instructors need a defensible, documented record. Aiscern provides forensic reports exportable for disciplinary proceedings.' },
      ]}
      features={[
        { icon: <Brain className="w-5 h-5" />, title: 'Ensemble Detection', desc: 'Combines RoBERTa, Binoculars perplexity analysis, and Gemini for ≥94% ensemble AUC across student writing datasets.' },
        { icon: <FileSearch className="w-5 h-5" />, title: 'Sentence-Level Highlights', desc: 'Color-coded heatmap shows which sentences are AI-likely — not just an overall score.' },
        { icon: <BarChart3 className="w-5 h-5" />, title: 'Confidence Scoring', desc: 'Confidence threshold system: ≥62% = AI, ≤38% = Human, middle zone = uncertain. Designed for defensible academic decisions.' },
        { icon: <Layers className="w-5 h-5" />, title: 'Batch Processing', desc: 'Upload entire class sets at once. Process 50+ documents simultaneously with a Pro or Team plan.' },
        { icon: <Shield className="w-5 h-5" />, title: 'Export & Evidence', desc: 'PDF forensic reports include scan ID, timestamp, model breakdown, and per-sentence scores for grade appeals.' },
        { icon: <Eye className="w-5 h-5" />, title: 'Multi-Language Support', desc: 'Detection works across English, Spanish, French, German, and more — covering international student submissions.' },
      ]}
      useCases={[
        {
          title: 'Essay & Assignment Verification',
          challenge: 'A professor notices unusually uniform prose across a class-set of 30 essays.',
          action: 'She uploads the batch to Aiscern and reviews the per-sentence heatmap for each flagged submission.',
          outcome: '4 essays flagged high-confidence — evidence exported for academic integrity review',
        },
        {
          title: 'Research Paper Pre-Screening',
          challenge: 'A graduate school needs to screen theses before defense without adding reviewer workload.',
          action: 'The API is wired into the submission portal, scanning every thesis automatically on upload.',
          outcome: 'Results attached to institutional review file — zero added reviewer time',
        },
        {
          title: 'Writing Practice Auditing',
          challenge: 'An online tutoring platform wants students practicing genuine writing, not outsourcing to AI.',
          action: 'Submitted writing samples are scanned before feedback is generated.',
          outcome: 'Tutors flagged on submissions scoring above the uncertainty threshold',
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
        { q: 'Can Aiscern detect AI text that has been paraphrased?', a: 'Yes. Our ensemble analyzes perplexity patterns, burstiness, and phrase-level fingerprints that survive light paraphrasing. Heavily rewritten content may reduce confidence, and we report this honestly in the uncertainty zone rather than making false claims.' },
        { q: 'What happens if a student claims a false positive?', a: 'We recommend never acting on a single tool result alone. Aiscern provides per-sentence breakdowns and confidence scores so instructors can make informed decisions. Use our forensic report alongside other evidence in any academic integrity proceedings.' },
        { q: 'Can I integrate Aiscern with my LMS (Canvas, Moodle, Blackboard)?', a: 'API access is available on Pro and Team plans. You can call our detection endpoint from any LMS that supports webhook integrations or custom plugins. Documentation is at /docs/api.' },
        { q: 'Does Aiscern store student submissions?', a: 'We follow a strict data minimization policy. Scan content is processed ephemerally and not stored beyond the session unless you explicitly save a report. See our /transparency page for full details.' },
        { q: 'What languages are supported?', a: 'English detection has the highest accuracy. We support Spanish, French, German, Portuguese, and several other European languages with slightly reduced accuracy. Non-Latin scripts are in development.' },
      ]}
    />
  )
}
