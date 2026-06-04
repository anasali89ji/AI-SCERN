import type { Metadata } from 'next'
import { SolutionPage } from '@/components/SolutionPage'
import { Megaphone, Eye, Brain, Layers, BarChart3, Shield, FileSearch, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'AI Detection for Marketing & Brand — Aiscern',
  description: 'Audit UGC, influencer deliverables, and agency content for AI generation. Protect your brand voice with ensemble-based detection.',
  openGraph: {
    title: 'AI Detection for Marketing — Aiscern',
    url: 'https://aiscern.com/solutions/marketing',
    siteName: 'Aiscern',
  },
}

export default function MarketingPage() {
  return (
    <SolutionPage
      industry="Marketing & Brand"
      tagline="Verify Your Content Is Genuinely Human"
      description="Brand authenticity depends on genuine human creativity. Aiscern helps marketing teams verify that UGC campaigns, influencer deliverables, and agency content reflect real human effort — not AI-generated filler."
      heroIcon={Megaphone}
      accentColor="amber"
      ctaLabel="Start Free Marketing Account"
      problemTitle="The Brand Authenticity Problem"
      painPoints={[
        { title: 'Influencers delivering AI-generated captions and reviews', desc: 'Paid partners and micro-influencers increasingly use AI to produce sponsored content, violating authenticity guidelines and FTC disclosure requirements.' },
        { title: 'UGC campaigns contaminated with synthetic submissions', desc: 'Customer stories, reviews, and photo contest entries can be AI-generated, undermining the genuine social proof that UGC campaigns depend on.' },
        { title: 'Agency content with AI filler reducing brand differentiation', desc: 'Content agencies billing for creative work that is largely AI-generated deliver generic output that erodes brand voice over time.' },
        { title: 'Deepfake imagery in competitor analysis and industry research', desc: 'Synthetic images circulating on social media can be misidentified as real product photos, misleading competitive intelligence.' },
      ]}
      features={[
        { icon: Brain, title: 'Text Content Detection', desc: 'Identify AI-generated blog posts, product descriptions, social captions, and UGC submissions with ≥96% ensemble AUC.' },
        { icon: Eye, title: 'Image Authenticity', desc: 'Detect AI-generated brand imagery, synthetic product photos, and fabricated lifestyle content.' },
        { icon: Layers, title: 'Bulk Content Audits', desc: 'Scan entire content libraries, campaign submissions, or agency deliverable batches simultaneously.' },
        { icon: BarChart3, title: 'Risk Scoring Dashboard', desc: 'Sort and filter scanned content by AI confidence score to prioritize human review of highest-risk items.' },
        { icon: FileSearch, title: 'Influencer Content Review', desc: 'Analyze deliverable packages from influencer partners before approving payment or publishing.' },
        { icon: CheckCircle, title: 'Audit Reports', desc: 'Generate documentation for content authenticity audits, FTC compliance records, and agency performance reviews.' },
      ]}
      useCases={[
        { title: 'UGC Campaign Verification', desc: 'A consumer brand running a "real customer stories" campaign scans all 2,000 written submissions through Aiscern before featuring them, ensuring only genuine customer voices appear in campaign materials.' },
        { title: 'Influencer Deliverable Auditing', desc: 'A brand manager runs all sponsored post drafts from 50 micro-influencers through Aiscern before approving. 12 posts score as high-probability AI-generated, triggering revision requests and contract clause enforcement.' },
        { title: 'Agency Content Quality Control', desc: 'A marketing director audits monthly content deliverables from a retained content agency using Aiscern, ensuring that blog posts and email copy reflect genuine creative work rather than AI-generated boilerplate.' },
      ]}
      faqs={[
        { q: 'Can Aiscern detect AI content that has been edited by a human?', a: 'Human editing reduces AI confidence scores, particularly extensive editing. Lightly edited AI content typically scores 45–75%. Heavily edited content may fall below our 62% AI threshold. We report confidence ranges, not binary verdicts, to reflect this nuance.' },
        { q: 'How does detection work for short-form content like social captions?', a: 'Short texts (under 150 words) have wider confidence intervals because there is less linguistic signal to analyze. We recommend supplementing with longer form analysis when assessing short-form content.' },
        { q: 'Can we use Aiscern results in influencer contract disputes?', a: 'Our reports are technical analysis documents, not legal evidence. We recommend using them alongside your contract terms and legal counsel\'s guidance in any dispute resolution process.' },
        { q: 'Does Aiscern detect AI-generated product images from tools like Midjourney?', a: 'Yes. Our image ensemble is trained on output from Midjourney, DALL-E, Stable Diffusion, Ideogram, and other major generators. Benchmark accuracy for diffusion model imagery is ≥93% AUC on our test datasets.' },
        { q: 'Is there a way to screen content before it is submitted by influencers?', a: 'Yes — our API can be integrated into submission portals, content management platforms, and influencer management tools to screen content at upload time.' },
      ]}
    />
  )
}
