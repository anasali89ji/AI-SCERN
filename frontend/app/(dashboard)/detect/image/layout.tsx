import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Image Verification — Midjourney, DALL-E & Deepfake Detection',
  description: 'Enterprise AI image verification for Midjourney, DALL-E 3, Stable Diffusion, Adobe Firefly and deepfakes. 98%+ accuracy. Free tier available, no credit card required.',
  keywords: [
    'ai image verification','deepfake verification','verify midjourney image','verify dall-e image',
    'stable diffusion detector','ai generated image checker','fake image detector',
    'deepfake face detector','ai art detector','image authenticity verification',
    'is this image real','verify adobe firefly image','grok image detector',
    'enterprise image verification','synthetic image detector','deepfake check',
  ],
  alternates: { canonical: 'https://aiscern.com/detect/image' },
  openGraph: {
    title: 'AI Image Verification — Midjourney, DALL-E & Deepfake Detection | Aiscern',
    description: 'Upload any image and get an enterprise-grade verification verdict: AI-generated or authentic. 98%+ accuracy.',
    url: 'https://aiscern.com/detect/image',
    images: [{ url: 'https://aiscern.com/api/og?title=AI+Image+Verification&tool=Image&color=%237c3aed', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Enterprise AI Image Verification — Midjourney, DALL-E, Stable Diffusion',
    description: 'Upload any image and get an enterprise-grade AI verification verdict. 98%+ accuracy. Free tier available.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aiscern.com/detect/image',
      'url': 'https://aiscern.com/detect/image',
      'name': 'AI Image Verification | Aiscern',
      'description': 'Verify Midjourney, DALL-E, Stable Diffusion and deepfake images with 98%+ accuracy using enterprise-grade AI image verification.',
      'isPartOf': { '@id': 'https://aiscern.com/#app' },
      'breadcrumb': {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://aiscern.com' },
          { '@type': 'ListItem', 'position': 2, 'name': 'AI Image Verification', 'item': 'https://aiscern.com/detect/image' }
        ]
      }
    },
    {
      '@type': 'FAQPage',
      'mainEntity': [
                  {
                    "@type": "Question",
                    "name": "How do I verify a Midjourney image?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Upload the image to Aiscern's AI image verification tool. Aiscern analyzes GAN artifacts, pixel patterns and frequency signatures to verify whether an image came from Midjourney, DALL-E or another generator." }
                  },
                  {
                    "@type": "Question",
                    "name": "Can it detect deepfake faces?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Yes. Aiscern verifies deepfake face swaps and AI-generated faces with 98%+ accuracy using ensemble vision models trained on real and synthetic face datasets." }
                  }
      ]
    }
  ,
    {
    "@type": "HowTo",
    "name": "How to verify AI-generated images",
    "description": "Use Aiscern's enterprise AI image verification tool to determine if an image was created by AI or is a deepfake.",
    "step": [
        {
            "@type": "HowToStep",
            "name": "Upload your image",
            "text": "Drag and drop or click to upload any JPG, PNG, or WebP image up to 10MB."
        },
        {
            "@type": "HowToStep",
            "name": "Run AI verification",
            "text": "Click Analyze. Aiscern runs the image through 3 neural classifiers and pixel-level signal extractors."
        },
        {
            "@type": "HowToStep",
            "name": "Read the verdict",
            "text": "See the AI/Human verdict with confidence score and full signal breakdown."
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
