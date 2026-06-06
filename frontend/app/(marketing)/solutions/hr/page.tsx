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
      tagline="Hire People, Not AI-Written Applications"
      description="AI-polished cover letters and fabricated work samples are flooding application pipelines. Aiscern gives HR teams a fast, accurate way to flag AI-generated content before it wastes interview bandwidth."
      heroIcon={<Users className="w-20 h-20 lg:w-28 lg:h-28 opacity-80" strokeWidth={1} />}
      accentColor="cyan"
      ctaLabel="Start Free HR Account"
      problemTitle="The Authenticity Problem in Hiring"
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
        { title: 'Application Screening at Scale', desc: 'An in-house recruiter uploads 200 cover letters from an open role posting. Aiscern flags 38 as high-probability AI-generated, allowing the team to prioritize genuine applications for review.' },
        { title: 'Technical Writing Assessment', desc: 'A SaaS company asks candidates to submit a one-page product strategy writeup. Submissions are scanned before evaluators review them, ensuring assessment scores reflect genuine thinking.' },
        { title: 'Pre-Interview Verification', desc: 'Before scheduling interviews, a staffing agency runs final shortlisted candidates\' materials through Aiscern to confirm consistency between application and self-reported capabilities.' },
      ]}
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
