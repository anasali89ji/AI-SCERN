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
      tagline="Audit Content for Authenticity, Not Just Quality"
      description="FTC endorsement guidance requires disclosure of AI-generated content in sponsored posts. Aiscern screens UGC, influencer deliverables, and agency content so your brand isn't caught publishing unverified AI material."
      heroIcon={<Megaphone className="w-20 h-20 lg:w-28 lg:h-28 opacity-80" strokeWidth={1} />}
      accentColor="amber"
      ctaLabel="Start Free Marketing Account"
      heroImage="/solutions/marketing/hero.webp"
      heroImageAlt="A marketing director standing in a warehouse-style war room reviewing a large digital wall of campaign content"
      trustBar={[
        { label: 'Ensemble AUC', value: '≥94%' },
        { label: 'Batch Size', value: '1,000 posts' },
        { label: 'Modalities', value: 'Text + image' },
      ]}
      workflow={[
        { title: 'Import Campaign Content', desc: 'Pull in UGC submissions, influencer drafts, or agency deliverables.' },
        { title: 'Run Multi-Modal Scan', desc: 'Text and image ensembles score each item for AI-generation confidence.' },
        { title: 'Review Authenticity Dashboard', desc: 'Sort flagged content by risk score before publishing or paying out.' },
      ]}
      comparisonCompetitorName="Copyleaks"
      comparisonRows={[
        { feature: 'Modalities covered', aiscern: 'Text + image', competitor: 'Text-focused' },
        { feature: 'Bulk campaign scanning', aiscern: '1,000 posts/batch', competitor: 'Limited batch size' },
        { feature: 'Confidence uncertainty zone', aiscern: true, competitor: false },
        { feature: 'Influencer deliverable workflow', aiscern: true, competitor: false },
        { feature: 'Free tier', aiscern: true, competitor: false },
      ]}
      problemTitle="Unverified AI Content Is a Brand Risk"
      painPoints={[
        { title: 'Influencers delivering AI-generated captions and reviews', desc: 'Paid partners and micro-influencers increasingly use AI to produce sponsored content, violating authenticity guidelines and FTC disclosure requirements.' },
        { title: 'UGC campaigns contaminated with synthetic submissions', desc: 'Customer stories, reviews, and photo contest entries can be AI-generated, undermining the genuine social proof that UGC campaigns depend on.' },
        { title: 'Agency content with AI filler reducing brand differentiation', desc: 'Content agencies billing for creative work that is largely AI-generated deliver generic output that erodes brand voice over time.' },
        { title: 'Deepfake imagery in competitor analysis and industry research', desc: 'Synthetic images circulating on social media can be misidentified as real product photos, misleading competitive intelligence.' },
      ]}
      features={[
        { icon: <Brain className="w-5 h-5" />, title: 'Text Content Detection', desc: 'Identify AI-generated blog posts, product descriptions, social captions, and UGC submissions with ≥94% ensemble AUC.' },
        { icon: <Eye className="w-5 h-5" />, title: 'Image Authenticity', desc: 'Detect AI-generated brand imagery, synthetic product photos, and fabricated lifestyle content.' },
        { icon: <Layers className="w-5 h-5" />, title: 'Bulk Content Audits', desc: 'Scan entire content libraries, campaign submissions, or agency deliverable batches simultaneously.' },
        { icon: <BarChart3 className="w-5 h-5" />, title: 'Risk Scoring Dashboard', desc: 'Sort and filter scanned content by AI confidence score to prioritize human review of highest-risk items.' },
        { icon: <FileSearch className="w-5 h-5" />, title: 'Influencer Content Review', desc: 'Analyze deliverable packages from influencer partners before approving payment or publishing.' },
        { icon: <CheckCircle className="w-5 h-5" />, title: 'Audit Reports', desc: 'Generate documentation for content authenticity audits, FTC compliance records, and agency performance reviews.' },
      ]}
      useCases={[
        {
          title: 'UGC Campaign Verification',
          challenge: 'A consumer brand\'s "real customer stories" campaign depends on genuine customer voices.',
          action: 'All 2,000 written submissions are scanned before any are featured.',
          outcome: 'Only verified-human submissions make it into campaign materials',
        },
        {
          title: 'Influencer Deliverable Auditing',
          challenge: 'A brand manager needs sponsored posts from 50 micro-influencers to be genuinely theirs.',
          action: 'Every draft is scanned before approval and payout.',
          outcome: '12 posts flagged high-probability AI-generated, triggering revision requests',
        },
        {
          title: 'Agency Content Quality Control',
          challenge: 'A marketing director audits monthly deliverables from a retained content agency.',
          action: 'Blog posts and email copy are scanned before sign-off.',
          outcome: 'AI-generated boilerplate identified and sent back for rework',
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
        { q: 'Can Aiscern detect AI content that has been edited by a human?', a: 'Human editing reduces AI confidence scores, particularly extensive editing. Lightly edited AI content typically scores 45–75%. Heavily edited content may fall below our 62% AI threshold. We report confidence ranges, not binary verdicts, to reflect this nuance.' },
        { q: 'How does detection work for short-form content like social captions?', a: 'Short texts (under 150 words) have wider confidence intervals because there is less linguistic signal to analyze. We recommend supplementing with longer form analysis when assessing short-form content.' },
        { q: 'Can we use Aiscern results in influencer contract disputes?', a: 'Our reports are technical analysis documents, not legal evidence. We recommend using them alongside your contract terms and legal counsel\'s guidance in any dispute resolution process.' },
        { q: 'Does Aiscern detect AI-generated product images from tools like Midjourney?', a: 'Yes. Our image ensemble is trained on output from Midjourney, DALL-E, Stable Diffusion, Ideogram, and other major generators. Benchmark accuracy for diffusion model imagery is ≥98% AUC on our test datasets (14-layer ensemble).' },
        { q: 'Is there a way to screen content before it is submitted by influencers?', a: 'Yes — our API can be integrated into submission portals, content management platforms, and influencer management tools to screen content at upload time.' },
      ]}
    />
  )
}
