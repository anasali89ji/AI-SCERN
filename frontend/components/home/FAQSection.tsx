import { SectionHeader } from '@/components/ui/SectionHeader'
import { FAQAccordion } from '@/components/home/FAQAccordion'

const FAQS = [
  {
    q: 'How accurate is Aiscern\'s AI content detection?',
    a: 'Aiscern uses an ensemble of multiple detection models combined with a RAG-augmented forensic pipeline. Published benchmarks show ~95% accuracy on text, ~91% on images, ~88% on audio, and ~85% on video. Accuracy varies by content type and AI model generation. Our trust verification platform cross-references multiple signals to minimize false positives.',
  },
  {
    q: 'Can AI content detection ever be 100% certain?',
    a: 'No. AI content detection and deepfake detection are probabilistic, not deterministic. Aiscern provides confidence scores and forensic reasoning, not binary guarantees. We recommend human review for high-stakes decisions — our trust verification reports are designed to support, not replace, professional judgment.',
  },
  {
    q: 'How is my data protected during trust verification?',
    a: 'All uploads are encrypted in transit and at rest. Files are stored in isolated Cloudflare R2 buckets with automatic deletion policies. We never use customer content to train our AI detection models. Your data belongs to you — period.',
  },
  {
    q: 'Do you support enterprise API access for automated trust verification?',
    a: 'Yes. Pro and Enterprise plans include REST API access with per-key rate limiting, webhook notifications, and batch processing for high-volume AI content detection workflows. Documentation is available at aiscern.com/docs/api.',
  },
  {
    q: 'Can I detect AI-generated images, audio, and video — not just text?',
    a: 'Yes. Aiscern is a multi-modal trust verification platform supporting all four content types from a single dashboard. Upload directly or use our API to programmatically submit files for deepfake detection and synthetic media analysis.',
  },
]

export default function FAQSection() {
  return (
    <section id="faq" aria-label="Frequently asked questions about AI content detection" className="relative py-24 md:py-32 [overflow:clip]">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHeader headline="Frequently asked questions about trust verification." />
        <FAQAccordion faqs={FAQS} />
      </div>
    </section>
  )
}
