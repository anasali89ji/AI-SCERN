import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about Aiscern\u2019s enterprise AI trust verification platform: pricing, accuracy, supported file types, API access, and data privacy.',
  alternates: { canonical: 'https://aiscern.com/faq' },
  openGraph: {
    title: 'FAQ — Aiscern Enterprise AI Verification Platform',
    description: 'Answers about Aiscern\u2019s enterprise AI trust verification platform: pricing, accuracy, supported file types, API access, and data privacy.',
    url: 'https://aiscern.com/faq',
  },
}

// Mirrors FAQ_SECTIONS in page.tsx. The visible accordion only puts an answer
// in the DOM after the user clicks (useState-gated in FAQItem), so this
// schema is what actually carries the answer text to crawlers and AI answer
// engines that don't execute JS / click through the UI. Keep in sync with
// page.tsx by hand if FAQ_SECTIONS changes — no shared source of truth yet.
const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'Is there really a free plan?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The free tier includes 10 scans per day on text and image verification. No credit card required.' } },
    { '@type': 'Question', name: 'What happens if I hit my daily limit?', acceptedAnswer: { '@type': 'Answer', text: 'You can wait for the next day or upgrade to Pro instantly. Your scan count resets every 24 hours.' } },
    { '@type': 'Question', name: 'Can I cancel anytime?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Monthly plans cancel anytime with no hidden fees. You keep Pro access until the end of your billing period.' } },
    { '@type': 'Question', name: 'Will the free tier stay?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. We believe everyone deserves access to basic AI verification. The free tier is permanent.' } },
    { '@type': 'Question', name: 'Why do you charge for Pro and Team?', acceptedAnswer: { '@type': 'Answer', text: 'Running ensemble AI models across text, image, audio, and video requires significant GPU compute. Paid plans help us improve accuracy, add new modalities, and keep the service running \u2014 without selling your data or showing ads.' } },
    { '@type': 'Question', name: 'How accurate is Aiscern?', acceptedAnswer: { '@type': 'Answer', text: 'Our latest benchmarks show approximately 94% accuracy on text, 98% on images (14-layer ensemble including physics-based signals), 92% on audio, and 90% on video. Accuracy varies by content type, generator, and compression level. These are measured on public held-out test sets, not cherry-picked results.' } },
    { '@type': 'Question', name: 'Can I use Aiscern for legal or academic decisions?', acceptedAnswer: { '@type': 'Answer', text: 'No. Verification results are probabilistic, not definitive. Always use human judgment for high-stakes decisions. Never use a single result as sole evidence in legal proceedings or academic integrity cases.' } },
    { '@type': 'Question', name: 'What AI generators can you detect?', acceptedAnswer: { '@type': 'Answer', text: 'Our models are updated quarterly. We verify content from major generators including ChatGPT, GPT-4, Claude, Midjourney, DALL-E, Stable Diffusion, ElevenLabs, and common TTS tools. Novel generators released after our last update may evade detection until the next fine-tune.' } },
    { '@type': 'Question', name: 'How does the ensemble work?', acceptedAnswer: { '@type': 'Answer', text: 'We run content through multiple independent verification signals and combine them into a single confidence score. No single model makes the final call \u2014 results are cross-verified before delivering a verdict.' } },
    { '@type': 'Question', name: 'What does an "Uncertain" verdict mean?', acceptedAnswer: { '@type': 'Answer', text: 'An "Uncertain" result means the ensemble did not reach \u226562% confidence to label AI, nor \u226438% to label human. This is not a failure \u2014 it means the content is genuinely ambiguous. Try running a longer sample or checking a different modality.' } },
    { '@type': 'Question', name: 'Does Aiscern work on languages other than English?', acceptedAnswer: { '@type': 'Answer', text: 'Text verification was primarily trained on English-language data. Non-English text may produce higher false-positive rates. Treat non-English results with extra caution. Multilingual support is on the roadmap.' } },
    { '@type': 'Question', name: 'What happens to my uploads?', acceptedAnswer: { '@type': 'Answer', text: 'Files are processed for verification and deleted within 24 hours. We do not train our models on your content without explicit opt-in. Scan results are stored in your history for 12 months.' } },
    { '@type': 'Question', name: 'Do you sell my data?', acceptedAnswer: { '@type': 'Answer', text: 'No. We do not sell, share, or use your submitted content for any purpose other than providing the verification service to you.' } },
    { '@type': 'Question', name: 'Who built Aiscern?', acceptedAnswer: { '@type': 'Answer', text: 'Aiscern is built by Anas Ali, a solo founder based in Mandi Bahauddin, Pakistan. It is an early-stage project \u2014 actively developed, transparent about limitations, and not VC-funded.' } },
    { '@type': 'Question', name: 'Do you have an API?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. API access is available on Team and Enterprise plans. Documentation is available at /docs/api.' } },
    { '@type': 'Question', name: 'What file types do you support?', acceptedAnswer: { '@type': 'Answer', text: 'Text (paste or URL), images (JPG, PNG, WEBP), audio (MP3, WAV, M4A), and video (MP4, MOV, WEBM).' } },
  ],
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }} />
      {children}
    </>
  )
}
