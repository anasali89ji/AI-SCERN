import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free AI Image Detector — Detect Midjourney, DALL-E & Deepfakes',
  description: 'Detect AI-generated images from Midjourney, DALL-E 3, Stable Diffusion, Adobe Firefly and deepfakes. 82%+ accuracy. Upload any image — free, instant results. No credit card required.',
  keywords: [
    'ai image detector','deepfake detector','detect midjourney','detect dall-e',
    'stable diffusion detector','ai generated image checker','fake image detector',
    'deepfake face detector','ai art detector','image authenticity checker',
    'is this image real','detect adobe firefly','grok image detector',
    'ai photo detector free','synthetic image detector','deepfake check',
  ],
  alternates: { canonical: 'https://aiscern.com/detect/image' },
  openGraph: {
    title: 'Free AI Image Detector — Detect Midjourney, DALL-E & Deepfakes | Aiscern',
    description: 'Upload any image and instantly know if it was AI-generated or a deepfake. 82%+ accuracy. Free.',
    url: 'https://aiscern.com/detect/image',
    images: [{ url: '/og-image-detect.png', width: 1200, height: 630, alt: 'AI Image & Deepfake Detector' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Deepfake & AI Image Detector — Midjourney, DALL-E, Stable Diffusion',
    description: 'Upload any image and detect if it was AI-generated or deepfaked. 82%+ accuracy. Free.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aiscern.com/detect/image',
      'url': 'https://aiscern.com/detect/image',
      'name': 'AI Image & Deepfake Detector | Aiscern',
      'description': 'Detect Midjourney, DALL-E, Stable Diffusion and deepfake images with 82%+ accuracy.',
      'isPartOf': { '@id': 'https://aiscern.com/#app' },
      'breadcrumb': {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://aiscern.com' },
          { '@type': 'ListItem', 'position': 2, 'name': 'AI Image Detector', 'item': 'https://aiscern.com/detect/image' }
        ]
      }
    },
    {
      '@type': 'FAQPage',
      'mainEntity': [
                  {
                    "@type": "Question",
                    "name": "How do I detect a Midjourney image?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Upload the image to Aiscern's AI image detector. Aiscern analyzes GAN artifacts, pixel patterns and frequency signatures to detect Midjourney, DALL-E and other AI-generated images." }
                  },
                  {
                    "@type": "Question",
                    "name": "Can it detect deepfake faces?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Yes. Aiscern detects deepfake face swaps and AI-generated faces with 82%+ accuracy using ensemble vision models trained on real and synthetic face datasets." }
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
