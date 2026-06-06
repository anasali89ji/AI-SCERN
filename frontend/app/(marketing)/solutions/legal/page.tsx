import type { Metadata } from 'next'
import { Scale } from 'lucide-react'
import { SolutionPage } from '@/components/SolutionPage'

export const metadata: Metadata = {
  title: 'AI Detection for Legal & Compliance | Aiscern',
  description: 'Authenticate legal documents, evidence and contracts. Detect AI-drafted filings and deepfake recordings before they enter proceedings.',
}

export default function LegalSolutionPage() {
  return (
    <SolutionPage
      industry="Legal & Compliance"
      tagline="Authentic Evidence. Verified Documents."
      description="Aiscern helps legal professionals authenticate documents, contracts and audio/video evidence — producing shareable detection reports you can attach to case files. Results are probabilistic; always apply professional judgment."
      icon={Scale}
      color="#059669"
      heroImage="/solutions/hero-legal.jpg"
      actionImage="/solutions/action-legal.jpg"
      stats={[
        { value: '~85%', label: 'Document text accuracy' },
        { value: '~82%', label: 'Image authentication' },
        { value: 'PDF', label: 'Export available' },
      ]}
      painPoints={[
        {
          problem: 'AI-drafted contracts and filings submitted without disclosure creating compliance risk.',
          solution: 'Text detection flags AI-generated legal prose in contracts, briefs and correspondence.',
        },
        {
          problem: 'Deepfake audio recordings presented as evidence in proceedings.',
          solution: 'Audio forensics detects voice cloning artifacts and synthetic speech patterns.',
        },
        {
          problem: 'Forged or AI-manipulated documentary evidence entering discovery.',
          solution: 'Image forensics checks pixel-level integrity and metadata consistency.',
        },
        {
          problem: 'No shareable, defensible audit trail when challenging evidence authenticity.',
          solution: 'Timestamped, permalink reports can be referenced in motions and case files.',
        },
      ]}
      useCases={[
        { title: 'Contract Authenticity Review', desc: 'Scan contracts and agreements for AI-generated clauses or fully synthetic drafts.' },
        { title: 'Evidence Authentication', desc: 'Check photographic and documentary evidence for signs of manipulation or AI generation.' },
        { title: 'Audio Recording Verification', desc: 'Analyse call recordings and witness audio for voice cloning artifacts.' },
        { title: 'Disclosure Compliance', desc: 'Flag AI-generated content in submitted documents before filing deadlines.' },
        { title: 'Expert Witness Report Review', desc: 'Verify that expert reports are human-authored, not AI-drafted with a name attached.' },
        { title: 'Due Diligence Scanning', desc: 'Batch-scan M&A documents and data room materials for synthetic content at scale.' },
      ]}
      ctaHref="/detect/text"
      ctaLabel="Scan a Document"
      toolName="Multi-Modal Detector"
    />
  )
}
