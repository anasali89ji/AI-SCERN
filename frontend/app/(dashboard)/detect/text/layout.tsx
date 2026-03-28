import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free AI Text Detector — Detect ChatGPT, Claude, Gemini Writing',
  description: 'Instantly detect AI-generated text from ChatGPT, Claude, Gemini, GPT-4 and 50+ AI models. Sentence-level heatmap, 85%+ accuracy. Free — no credit card required. Trusted by editors, teachers & researchers.',
  keywords: [
    'ai text detector','chatgpt detector','detect chatgpt','is this ai generated',
    'ai writing detector free','gpt detector','claude detector','gemini detector',
    'ai content checker','chatgpt checker','ai generated text detector',
    'ai essay detector','ai paraphrase detector','turnitin alternative free',
    'detect ai writing','ai or human text','copyleaks alternative',
  ],
  alternates: {
    canonical: 'https://aiscern.com/detect/text',
  },
  openGraph: {
    title: 'Free AI Text Detector — Detect ChatGPT, Claude & Gemini | Aiscern',
    description: 'Paste any text and instantly know if it was written by AI. Detects ChatGPT, Claude, Gemini, GPT-4. 85%+ accuracy. Free.',
    url: 'https://aiscern.com/detect/text',
    images: [{ url: '/og-text.png', width: 1200, height: 630, alt: 'AI Text Detector' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free AI Text Detector — Detect ChatGPT, Claude & Gemini',
    description: 'Paste text and instantly detect if it was written by AI. 85%+ accuracy. Free.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aiscern.com/detect/text',
      'url': 'https://aiscern.com/detect/text',
      'name': 'AI Text Detector | Aiscern',
      'description': 'Detect ChatGPT, Claude, Gemini and other AI-written text with 85%+ accuracy.',
      'isPartOf': { '@id': 'https://aiscern.com/#app' },
      'breadcrumb': {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://aiscern.com' },
          { '@type': 'ListItem', 'position': 2, 'name': 'AI Text Detector', 'item': 'https://aiscern.com/detect/text' }
        ]
      }
    },
    {
      '@type': 'FAQPage',
      'mainEntity': [
                  {
                    "@type": "Question",
                    "name": "How do I detect ChatGPT writing?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Paste the text into Aiscern's AI text detector and click Detect. The tool uses a RoBERTa ensemble to identify ChatGPT, Claude, Gemini and other AI writing with 85%+ accuracy." }
                  },
                  {
                    "@type": "Question",
                    "name": "Is the AI text detector free?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Yes. Aiscern's AI text detector is completely free with no credit card required and no scan limits." }
                  },
                  {
                    "@type": "Question",
                    "name": "Can it detect paraphrased AI text?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Yes. Aiscern analyzes linguistic patterns including burstiness, perplexity and style fingerprinting to detect AI text even when paraphrased or lightly edited." }
                  }
      ]
    }
  ]
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
