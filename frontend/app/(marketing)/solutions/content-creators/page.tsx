import type { Metadata } from 'next'
import { SolutionPage } from '@/components/SolutionPage'
import { Pen, Shield, Brain, Eye, CheckCircle, FileSearch, BarChart3, Lock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'AI Detection for Content Creators — Aiscern',
  description: 'Prove your work is human-made. Authenticate your writing, art, and media against AI detection. Built for YouTubers, bloggers, artists, and creators.',
  openGraph: {
    title: 'AI Detection for Content Creators — Aiscern',
    url: 'https://aiscern.com/solutions/content-creators',
    siteName: 'Aiscern',
  },
}

export default function ContentCreatorsPage() {
  return (
    <SolutionPage
      industry="Content Creators"
      tagline="Prove Your Originality. Screen Your Submissions."
      description="Creators need to both defend their own authentic work and verify that contributions, ghostwritten content, and user submissions are genuinely human. Aiscern helps on both sides of the authenticity equation."
      heroIcon={<Pen className="w-20 h-20 lg:w-28 lg:h-28 opacity-80" strokeWidth={1} />}
      accentColor="primary"
      ctaLabel="Start Free Creator Account"
      problemTitle="Authenticity Challenges for Creators"
      painPoints={[
        { title: 'Your genuine work is being flagged as AI-generated', desc: 'Overly aggressive AI detectors flag human writers with distinctive styles, complex vocabulary, or non-native English as "AI." Aiscern\'s ensemble reduces these false positives.' },
        { title: 'Ghostwriters and contributors using AI without disclosure', desc: 'If you hire writers, illustrators, or content contributors, AI-generated deliverables undermine your brand voice and can create platform policy violations.' },
        { title: 'Audience trust in human-made creative work is eroding', desc: 'Readers, viewers, and fans are increasingly skeptical about content authenticity. Verified human-made status is becoming a competitive differentiator.' },
        { title: 'Platform demonetization risk from AI content policies', desc: 'YouTube, AdSense, and other platforms are implementing AI content disclosure policies. Unverified AI use can trigger demonetization or account penalties.' },
      ]}
      features={[
        { icon: <Shield className="w-5 h-5" />, title: 'Self-Verification', desc: 'Run your own content through detection before publishing to see how it scores — and address any AI-pattern concerns proactively.' },
        { icon: <Brain className="w-5 h-5" />, title: 'Contributor Screening', desc: 'Scan submissions from ghostwriters, freelancers, and UGC contributors before publishing under your brand.' },
        { icon: <Eye className="w-5 h-5" />, title: 'Visual Content Authentication', desc: 'Verify that commissioned artwork, photography, and graphics are not AI-generated when originality matters.' },
        { icon: <CheckCircle className="w-5 h-5" />, title: 'Authenticity Reports', desc: 'Generate human-authorship reports that can be shared with platforms, sponsors, or audiences as proof of genuine creation.' },
        { icon: <FileSearch className="w-5 h-5" />, title: 'Sentence-Level Analysis', desc: 'See exactly which parts of content score in AI ranges — helpful for editing human-written drafts that may have unintentional AI-pattern language.' },
        { icon: <BarChart3 className="w-5 h-5" />, title: 'Historical Scan Records', desc: 'Signed-in users can access scan history — a record of your authenticated work over time.' },
      ]}
      useCases={[
        { title: 'Ghostwriter Quality Control', desc: 'A newsletter creator with 50,000 subscribers hires freelance writers. Before publishing, all submitted articles are scanned through Aiscern to verify genuine human writing before they appear under the creator\'s byline.' },
        { title: 'Platform Compliance Verification', desc: 'A YouTube educator runs all video scripts through Aiscern before production to verify they will score as human-written under the platform\'s emerging AI disclosure policies.' },
        { title: 'Commissioned Art Authentication', desc: 'A game developer verifying commissioned character artwork scans submissions through Aiscern\'s image detection to confirm AI tools were not used in violation of their creative brief.' },
      ]}
      faqs={[
        { q: 'What if Aiscern flags my own human-written content?', a: 'Our ensemble has a ~3–5% false positive rate. Certain human writing styles — very structured, formulaic, or highly polished — can score in the uncertain zone. A score of 39–61% is uncertain, not a verdict. Only scores ≥62% are classified as AI. We recommend treating uncertain scores as a prompt to review style rather than a definitive finding.' },
        { q: 'Can I share my Aiscern scan report as proof of authenticity?', a: 'Yes. Pro and higher tier users can export timestamped PDF reports with scan IDs. These can be shared with platforms, sponsors, or audiences as technical documentation of human authorship verification.' },
        { q: 'Does Aiscern work on creative writing — fiction, poetry, scripts?', a: 'Yes, though creative writing shows wider variance than formal writing. Experimental, highly original human styles sometimes score in uncertain ranges. We recommend scanning multiple samples of your work to establish a baseline before drawing conclusions.' },
        { q: 'Can I use Aiscern to verify images from stock photo sites are AI?', a: 'Yes — our image detection works on any image regardless of source. Stock photo AI imagery (Midjourney, DALL-E, Stable Diffusion) scores highly on our ensemble. Note that some stock sites clearly label AI-generated images in their metadata.' },
        { q: 'Is there a way to integrate Aiscern into my content submission form?', a: 'Yes via API. You can build a submission workflow that automatically screens incoming content before it enters your review queue. Documentation is at /docs/api.' },
      ]}
    />
  )
}
