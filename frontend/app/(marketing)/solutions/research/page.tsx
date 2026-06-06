import type { Metadata } from 'next'
import { Microscope } from 'lucide-react'
import { SolutionPage } from '@/components/SolutionPage'

export const metadata: Metadata = {
  title: 'AI Detection for Research & Academia | Aiscern',
  description: 'Verify paper authenticity, validate citations and detect AI-generated sections before journal submission.',
}

export default function ResearchSolutionPage() {
  return (
    <SolutionPage
      industry="Research"
      tagline="Validate Research. Protect Scientific Integrity."
      description="Aiscern helps researchers, journal editors and academic institutions check papers for AI-generated passages, hallucinated citations and synthetic data narratives before they enter the scientific record."
      icon={Microscope}
      color="#0891b2"
      heroImage="/solutions/hero-research.jpg"
      actionImage="/solutions/action-research.jpg"
      stats={[
        { value: '~85%', label: 'Academic text accuracy' },
        { value: '3+',   label: 'Model ensemble' },
        { value: 'PDF',  label: 'Upload supported' },
      ]}
      painPoints={[
        {
          problem: 'AI-hallucinated citations appearing in literature reviews without authors noticing.',
          solution: 'Text detection flags suspiciously fluent AI prose that may contain fabricated references.',
        },
        {
          problem: 'Graduate students submitting AI-drafted thesis sections without disclosure.',
          solution: 'Sentence-level heatmap pinpoints exactly which paragraphs are likely AI-generated.',
        },
        {
          problem: 'Journal editors unable to screen high submission volumes for AI-generated content.',
          solution: 'Batch upload PDFs for rapid screening before editorial assignment.',
        },
        {
          problem: 'No defensible record when authors dispute AI-use allegations post-publication.',
          solution: 'Timestamped, permalinked reports for editorial records and retraction investigations.',
        },
      ]}
      useCases={[
        { title: 'Pre-Submission Paper Check', desc: 'Authors verify their own work before submitting to journals or conferences.' },
        { title: 'Journal Editorial Screening', desc: 'Editors batch-screen incoming manuscripts for AI-generated content at first review.' },
        { title: 'Thesis & Dissertation Review', desc: 'Examine graduate research chapter by chapter with sentence-level detail.' },
        { title: 'Literature Review Validation', desc: 'Detect AI-generated background sections that may contain hallucinated citations.' },
        { title: 'Grant Proposal Audit', desc: 'Verify research narratives and methodology descriptions in funding applications.' },
        { title: 'Conference Paper Screening', desc: 'Programme committees scan submissions for AI-generated content before acceptance.' },
      ]}
      ctaHref="/detect/text"
      ctaLabel="Scan a Research Paper"
      toolName="AI Text Detector"
    />
  )
}
