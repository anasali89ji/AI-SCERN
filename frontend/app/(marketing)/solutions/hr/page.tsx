import type { Metadata } from 'next'
import { SolutionPage } from '@/components/SolutionPage'
import { Users, FileSearch, BarChart3, Shield, Brain, Layers, AlertTriangle, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'AI Detection for HR & Recruiting — Aiscern',
  description: 'Catch AI-generated cover letters, CVs, and work samples before they reach interview stage. Free tier for HR teams and recruiters.',
  openGraph: {
    title: 'AI Detection for HR & Recruiting — Aiscern',
    description: 'Verify authenticity of job applications and work samples with ensemble AI detection.',
    url: 'https://aiscern.com/solutions/hr',
    siteName: 'Aiscern',
  },
}

export default function HRPage() {
  return (
    <SolutionPage
      industry="Human Resources"
      tagline="Screen for Real Candidates, Not AI Drafts"
      description="AI-polished cover letters and work samples are showing up in application pipelines at volume. Aiscern flags likely AI-generated submissions in a batch scan so recruiters spend interview time on candidates, not AI output."
      heroIcon={<Users className="w-20 h-20 lg:w-28 lg:h-28 opacity-80" strokeWidth={1} />}
      accentColor="cyan"
      ctaLabel="Start Free HR Account"
      heroImage="/solutions/hr/hero.webp"
      heroImageAlt="A recruiter reviewing printed resumes at a glass desk in a modern office, city skyline visible at dusk through the window"
      trustBar={[
        { label: 'Ensemble AUC', value: '≥94%' },
        { label: 'Batch Size', value: '500 resumes' },
        { label: 'False Positive Rate', value: '<3%' },
      ]}
      workflow={[
        { title: 'Bulk Upload', desc: 'Drop a folder of applications for the open role.' },
        { title: 'Run Ensemble Screening', desc: 'Cover letters and work samples are scored against the 8-model ensemble.' },
        { title: 'Review Prioritized Queue', desc: 'Sort applicants by confidence score before scheduling interviews.' },
      ]}
      comparisonCompetitorName="Manual review"
      comparisonRows={[
        { feature: 'Time for 500 applications', aiscern: 'Minutes', competitor: 'Days' },
        { feature: 'Consistent scoring criteria', aiscern: true, competitor: false },
        { feature: 'Confidence uncertainty zone', aiscern: true, competitor: 'N/A' },
        { feature: 'ATS-ready API', aiscern: true, competitor: 'N/A' },
        { feature: 'Audit trail export', aiscern: true, competitor: false },
      ]}
      problemTitle="AI Drafts Are Crowding the Funnel"
      painPoints={[
        { title: 'Cover letters are indistinguishable from AI output', desc: 'Candidates routinely use ChatGPT, Claude, and Gemini to generate polished cover letters. HR teams spend hours on applications that don\'t reflect genuine candidate voice.' },
        { title: 'AI-assisted portfolios misrepresent skills', desc: 'Writing samples, case studies, and project summaries submitted for evaluation can be AI-generated, misrepresenting a candidate\'s actual capabilities.' },
        { title: 'No scalable screening process', desc: 'Manual review for AI content doesn\'t scale. A busy recruiter cannot realistically evaluate hundreds of applications for authenticity.' },
        { title: 'Legal exposure from unverified assessments', desc: 'Hiring decisions made on AI-generated work samples can create liability if discovered post-hire.' },
      ]}
      features={[
        { icon: <Brain className="w-5 h-5" />, title: 'Ensemble Text Detection', desc: 'Multi-model analysis flags AI-generated cover letters, personal statements, and written assessments with high confidence.' },
        { icon: <Layers className="w-5 h-5" />, title: 'Batch Upload', desc: 'Drop a folder of applications and screen all cover letters in minutes. Results dashboard shows risk scores at a glance.' },
        { icon: <FileSearch className="w-5 h-5" />, title: 'Work Sample Analysis', desc: 'Analyze longer documents like project write-ups, case study responses, and code documentation for AI generation.' },
        { icon: <BarChart3 className="w-5 h-5" />, title: 'Confidence Scoring', desc: 'Every result shows a confidence breakdown — not just a binary flag. Decide your own threshold for follow-up questioning.' },
        { icon: <CheckCircle className="w-5 h-5" />, title: 'Audit Trails', desc: 'Exportable PDF reports with scan timestamp and model breakdown — defensible records for HR documentation.' },
        { icon: <Shield className="w-5 h-5" />, title: 'Privacy First', desc: 'Candidate data is processed ephemerally. We never train on your submissions. Full data handling details at /transparency.' },
      ]}
      useCases={[
        {
          title: 'Application Screening at Scale',
          challenge: 'An in-house recruiter has 200 cover letters from one role posting and limited review time.',
          action: 'The batch is uploaded to Aiscern before manual review begins.',
          outcome: '38 flagged as high-probability AI-generated, prioritizing genuine applications',
        },
        {
          title: 'Technical Writing Assessment',
          challenge: 'A SaaS company\'s take-home writeup needs to reflect a candidate\'s own thinking.',
          action: 'Submissions are scanned before evaluators score them.',
          outcome: 'Assessment scores now reflect verified original writing',
        },
        {
          title: 'Pre-Interview Verification',
          challenge: 'A staffing agency needs shortlisted candidates\' materials to match their self-reported capabilities.',
          action: 'Final-round materials are scanned before interviews are scheduled.',
          outcome: 'Inconsistencies surfaced before the client interview, not after',
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
        { q: 'Is it fair to reject candidates based on AI detection?', a: 'We recommend using Aiscern as a screening signal, not a final decision. High AI scores should prompt a follow-up conversation or an alternative assessment — not automatic rejection. The tool surfaces patterns; humans make decisions.' },
        { q: 'Can Aiscern analyze PDF resumes?', a: 'Yes. Our batch endpoint accepts PDF, DOCX, and plain text. Text is extracted and analyzed through the full detection ensemble.' },
        { q: 'What about candidates who use AI to polish grammar only?', a: 'Light AI editing (grammar correction, tone adjustment) typically scores in our uncertain zone (39–61%). Full AI generation scores ≥62%. We distinguish between editing assistance and wholesale generation.' },
        { q: 'Do candidates know their applications are being scanned?', a: 'We recommend disclosing in your job posting that applications may be screened with AI verification tools, consistent with your regional privacy laws and HR policies.' },
        { q: 'Can we integrate with ATS platforms like Greenhouse or Lever?', a: 'API access is available on Pro and Team plans. You can integrate our detection endpoint with any ATS that supports custom webhooks or zapier-style automation.' },
      ]}
    />
  )
}
