import type { Metadata } from 'next'
import { Globe } from 'lucide-react'
import { SolutionPage } from '@/components/SolutionPage'

export const metadata: Metadata = {
  title: 'AI Detection for Media & Journalism | Aiscern',
  description: 'Verify images, audio clips, and sources before publication. Detect deepfakes and AI-fabricated quotes in under 10 seconds.',
}

export default function MediaSolutionPage() {
  return (
    <SolutionPage
      industry="Media & Journalism"
      tagline="Publish Truth, Not Synthetic Content"
      description="Aiscern gives journalists and fact-checkers a fast, multi-modal verification layer — checking images, audio recordings and written sources before they reach your audience."
      icon={<Globe className="w-16 h-16" />}
      color="#2563eb"
      heroImage="/solutions/hero-media.jpg"
      actionImage="/solutions/action-media.jpg"
      stats={[
        { value: '~82%', label: 'Image verification accuracy' },
        { value: '~79%', label: 'Audio deepfake detection' },
        { value: '<10s', label: 'Per verification' },
      ]}
      painPoints={[
        {
          problem: 'AI-fabricated quotes and synthetic sources arriving faster than editorial teams can verify.',
          solution: 'Text detection flags AI-drafted press releases, statements and articles before they are cited.',
        },
        {
          problem: 'Deepfake press photos and AI-generated imagery spreading on social media as real news.',
          solution: 'Image forensics pipeline checks for GAN fingerprints, diffusion artifacts and metadata anomalies.',
        },
        {
          problem: 'Voice-cloned audio statements used as fake interview sources.',
          solution: 'Audio deepfake detector analyses waveform anomalies and synthetic vocal patterns.',
        },
        {
          problem: 'No fast, shareable verification report for editorial sign-off.',
          solution: 'Every scan generates a timestamped report link for the editorial chain of custody.',
        },
      ]}
      useCases={[
        { title: 'Press Release Verification', desc: 'Scan incoming press releases for AI generation before quoting or citing them.' },
        { title: 'Image Forensics', desc: 'Check news photographs for GAN/diffusion artifacts and metadata inconsistencies.' },
        { title: 'Audio Source Verification', desc: 'Analyse audio clips for voice cloning or synthetic speech patterns.' },
        { title: 'Social Media Fact-Checking', desc: 'Verify viral images and audio extracted from social posts before debunking coverage.' },
        { title: 'Document Authentication', desc: 'Validate leaked documents and official statements for signs of AI generation.' },
        { title: 'Live Event Coverage', desc: 'Quick-scan breaking news materials during live coverage deadlines.' },
      ]}
      ctaHref="/detect/image"
      ctaLabel="Verify an Image Now"
      toolName="Multi-Modal Detector"
    />
  )
}
