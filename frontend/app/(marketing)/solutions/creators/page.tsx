import type { Metadata } from 'next'
import { Pen } from 'lucide-react'
import { SolutionPage } from '@/components/SolutionPage'

export const metadata: Metadata = {
  title: 'AI Detection for Content Creators | Aiscern',
  description: 'Prove your content is human-made with shareable authenticity certificates. Protect your creative reputation.',
}

export default function CreatorsSolutionPage() {
  return (
    <SolutionPage
      industry="Content Creators"
      tagline="Prove Your Work is Genuinely Yours"
      description="Aiscern gives writers, artists and creators a way to certify their content as human-made — protecting their creative reputation and standing out in a world flooded with AI-generated content."
      icon={Pen}
      color="#7c3aed"
      heroImage="/solutions/hero-creators.jpg"
      actionImage="/solutions/action-creators.jpg"
      stats={[
        { value: '~85%', label: 'Text detection accuracy' },
        { value: '~82%', label: 'Image authentication' },
        { value: 'Free', label: 'Tier available' },
      ]}
      painPoints={[
        {
          problem: 'Human creators accused of using AI when they haven\'t — losing client trust and contracts.',
          solution: 'Run your work through Aiscern and share the report showing low AI probability as evidence.',
        },
        {
          problem: 'Platforms and clients increasingly demanding proof of human authorship.',
          solution: 'Timestamped detection reports serve as a shareable authenticity certificate for any piece of work.',
        },
        {
          problem: 'AI-generated content flooding the same markets — driving down rates for genuine creatives.',
          solution: 'Differentiate your services by proactively certifying the human quality of your work.',
        },
        {
          problem: 'Stock image platforms rejecting AI-generated submissions — hard to know if your work will pass.',
          solution: 'Check your images against Aiscern\'s detection pipeline before submission to stock platforms.',
        },
      ]}
      useCases={[
        { title: 'Writing Portfolio Certification', desc: 'Attach Aiscern report links to writing samples to prove human authorship to clients.' },
        { title: 'Freelance Contract Compliance', desc: 'Meet client requirements for human-authored deliverables with verifiable reports.' },
        { title: 'Image Portfolio Verification', desc: 'Confirm your photography and digital art passes AI detection before submitting to platforms.' },
        { title: 'Social Media Content Audit', desc: 'Verify your own posts ahead of platforms introducing AI labelling requirements.' },
        { title: 'Client Deliverable Sign-Off', desc: 'Include an Aiscern authenticity link in every deliverable for premium positioning.' },
        { title: 'Ghost-Writing Disclosure', desc: 'Check ghost-written content you\'re publishing under your name stays within policy.' },
      ]}
      ctaHref="/detect/text"
      ctaLabel="Certify My Content"
      toolName="AI Text Detector"
    />
  )
}
