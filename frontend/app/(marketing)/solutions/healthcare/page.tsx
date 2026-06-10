import type { Metadata } from 'next'
import { Heart } from 'lucide-react'
import { SolutionPage } from '@/components/SolutionPage'

export const metadata: Metadata = {
  title: 'AI Detection for Healthcare | Aiscern',
  description: 'Verify medical research authenticity and protect against AI-hallucinated citations and synthetic clinical notes.',
}

export default function HealthcareSolutionPage() {
  return (
    <SolutionPage
      industry="Healthcare"
      tagline="Authentic Medical Content. Every Time."
      description="Aiscern helps healthcare professionals and medical publishers verify the authenticity of research papers, clinical notes and patient communications — protecting against AI hallucinations and synthetic citations."
      icon={<Heart className="w-16 h-16" />}
      color="#db2777"
      heroImage="/solutions/hero-healthcare.jpg"
      actionImage="/solutions/action-healthcare.jpg"
      stats={[
        { value: '~85%', label: 'Text detection accuracy' },
        { value: '<3s',  label: 'Per document scan' },
        { value: 'HIPAA', label: 'Conscious design' },
      ]}
      painPoints={[
        {
          problem: 'AI-hallucinated citations appearing in medical literature reviews and research papers.',
          solution: 'Text detection flags AI-generated passages and statistically unusual fluency in academic prose.',
        },
        {
          problem: 'Synthetic clinical notes and patient records submitted by AI-assisted staff without disclosure.',
          solution: 'Sentence-level heatmap highlights which sections of notes are likely AI-generated vs authored.',
        },
        {
          problem: 'AI-generated medical content published to patient portals without editorial review.',
          solution: 'Batch scan patient-facing content before it goes live — flagging synthetic health information.',
        },
        {
          problem: 'No audit trail when authenticity of clinical documentation is challenged.',
          solution: 'Timestamped, shareable detection reports for inclusion in compliance and audit files.',
        },
      ]}
      useCases={[
        { title: 'Research Paper Review', desc: 'Scan submitted manuscripts and preprints for AI-generated sections before peer review.' },
        { title: 'Clinical Note Verification', desc: 'Check clinical documentation for AI-generated content that lacks human clinical judgment.' },
        { title: 'Patient Communication Audit', desc: 'Verify authenticity of patient-facing health content before publishing to portals.' },
        { title: 'Grant Application Review', desc: 'Flag AI-drafted grant narratives and literature reviews in funding applications.' },
        { title: 'CME Content Validation', desc: 'Authenticate continuing medical education materials for accreditation compliance.' },
        { title: 'Regulatory Filing Review', desc: 'Scan clinical trial reports and regulatory submissions for AI-generated prose.' },
      ]}
      ctaHref="/detect/text"
      ctaLabel="Scan Medical Content"
      toolName="AI Text Detector"
    />
  )
}
