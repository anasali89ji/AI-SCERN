import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Text Verification — ChatGPT, Claude, Gemini Writing Detection',
  description: 'Enterprise AI text verification for ChatGPT, Claude, Gemini, GPT-4 and 50+ AI models. Sentence-level heatmap, 94%+ accuracy. Trusted by editors, teachers & researchers.',
  keywords: [
    'ai text verification','chatgpt detector','verify chatgpt text','is this ai generated',
    'ai writing verification','gpt detector','claude detector','gemini detector',
    'ai content verification','chatgpt checker','ai generated text verification',
    'ai essay detector','ai paraphrase detector','turnitin alternative free',
    'enterprise text verification','ai or human text','copyleaks alternative',
  ],
  alternates: {
    canonical: 'https://aiscern.com/detect/text',
  },
  openGraph: {
    title: 'AI Text Verification — ChatGPT, Claude & Gemini Detection | Aiscern',
    description: 'Paste any text and get an enterprise-grade verification verdict on ChatGPT, Claude, Gemini, GPT-4 authorship. 94%+ accuracy.',
    url: 'https://aiscern.com/detect/text',
    images: [{ url: 'https://aiscern.com/api/og?title=AI+Text+Verification&tool=Text&color=%237c3aed', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Text Verification — ChatGPT, Claude & Gemini Detection',
    description: 'Paste text and get an enterprise-grade AI verification verdict. 94%+ accuracy.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aiscern.com/detect/text',
      'url': 'https://aiscern.com/detect/text',
      'name': 'AI Text Verification | Aiscern',
      'description': 'Verify ChatGPT, Claude, Gemini and other AI-written text with 94%+ accuracy using enterprise-grade AI text verification.',
      'isPartOf': { '@id': 'https://aiscern.com/#app' },
      'breadcrumb': {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://aiscern.com' },
          { '@type': 'ListItem', 'position': 2, 'name': 'AI Text Verification', 'item': 'https://aiscern.com/detect/text' }
        ]
      }
    },
    {
      '@type': 'FAQPage',
      'mainEntity': [
                  {
                    "@type": "Question",
                    "name": "How do I verify ChatGPT writing?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Paste the text into Aiscern's AI text verification tool and click Analyze. The tool uses a RoBERTa ensemble to verify ChatGPT, Claude, Gemini and other AI writing with 94%+ accuracy." }
                  },
                  {
                    "@type": "Question",
                    "name": "Is the AI text verification tool free?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Aiscern offers a free tier for the AI text verification tool with no credit card required, plus enterprise plans for higher volume and SLA-backed usage." }
                  },
                  {
                    "@type": "Question",
                    "name": "Can it detect paraphrased AI text?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Yes. Aiscern analyzes linguistic patterns including burstiness, perplexity and style fingerprinting to verify AI text even when paraphrased or lightly edited." }
                  }
      ]
    }
  ,
    {
    "@type": "HowTo",
    "name": "How to verify AI-generated text",
    "description": "Use Aiscern's AI text verification tool to check if text was written by ChatGPT, Claude, Gemini, or another AI.",
    "step": [
        {
            "@type": "HowToStep",
            "name": "Paste your text",
            "text": "Paste or type the text you want to check (minimum 50 characters) into the text box."
        },
        {
            "@type": "HowToStep",
            "name": "Run AI verification",
            "text": "Click Analyze. Aiscern runs the text through a RoBERTa ensemble and 7 linguistic signal extractors."
        },
        {
            "@type": "HowToStep",
            "name": "Read the verdict",
            "text": "See the AI/Human verdict with per-sentence heatmap and confidence breakdown."
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
