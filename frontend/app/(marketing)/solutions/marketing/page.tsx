import type { Metadata } from 'next'
import { Megaphone } from 'lucide-react'
import { SolutionPage } from '@/components/SolutionPage'

export const metadata: Metadata = {
  title: 'AI Detection for Marketing | Aiscern',
  description: 'Audit UGC campaigns, influencer content and brand assets for undisclosed AI generation before they go live.',
}

export default function MarketingSolutionPage() {
  return (
    <SolutionPage
      industry="Marketing"
      tagline="Keep Your Brand Authentically Human"
      description="Aiscern helps marketing teams audit user-generated content, influencer deliverables and campaign assets for undisclosed AI generation — protecting brand trust and FTC compliance."
      icon={Megaphone}
      color="#d97706"
      heroImage="/solutions/hero-marketing.jpg"
      actionImage="/solutions/action-marketing.jpg"
      stats={[
        { value: '~85%', label: 'UGC text accuracy' },
        { value: '~82%', label: 'Image forensics' },
        { value: 'Bulk', label: 'Scan available' },
      ]}
      painPoints={[
        {
          problem: 'Influencers submitting AI-generated content as authentic product reviews violating FTC guidelines.',
          solution: 'Text detection and image forensics flag AI-generated testimonials and product photography.',
        },
        {
          problem: 'UGC campaigns flooded with AI-generated fake reviews and synthetic community content.',
          solution: 'Batch scan incoming UGC submissions before they are approved for brand channels.',
        },
        {
          problem: 'Brand-generated content indistinguishable from competitor AI spam, hurting SEO authority.',
          solution: 'Audit your own content pipeline and certify human-authored pieces for transparency.',
        },
        {
          problem: 'No documentation process when platforms flag brand content as AI-generated.',
          solution: 'Shareable detection reports show which content passed authenticity checks before publication.',
        },
      ]}
      useCases={[
        { title: 'UGC Review Campaigns', desc: 'Batch-scan incoming user submissions before approving them for brand promotion.' },
        { title: 'Influencer Deliverable Audit', desc: 'Check influencer copy, images and video scripts for AI generation before paying out.' },
        { title: 'Review Authenticity', desc: 'Verify customer reviews on your site or third-party platforms for synthetic content.' },
        { title: 'Content Pipeline QA', desc: 'Scan your own content team outputs to maintain authentic brand voice.' },
        { title: 'Social Listening', desc: 'Analyse competitor brand mentions and viral content for AI-generated engagement.' },
        { title: 'Ad Copy Verification', desc: 'Ensure agency-produced ad copy meets human-authored authenticity standards.' },
      ]}
      ctaHref="/detect/text"
      ctaLabel="Audit UGC Content"
      toolName="AI Text Detector"
    />
  )
}
