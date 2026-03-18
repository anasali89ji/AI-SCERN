import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free Deepfake Video Detector Online — Frame-by-Frame AI Analysis',
  description: 'Detect deepfake videos with frame-by-frame AI analysis. Identify face swaps, synthetic faces and AI-generated video content. 88% accuracy. Free. No signup required.',
  keywords: [
    'deepfake video detector','deepfake detector online free','ai video detector',
    'detect deepfake','face swap detector','synthetic video detector',
    'deepfake checker','video authenticity checker','ai generated video detector',
    'deepfake face swap','sora detector','detect ai video','fake video detector',
    'deepfake detection tool','video forensics free',
  ],
  alternates: { canonical: 'https://aiscern.com/detect/video' },
  openGraph: {
    title: 'Free Deepfake Video Detector — Frame-by-Frame AI Analysis | Aiscern',
    description: 'Upload a video and detect deepfakes frame by frame. Identifies face swaps and AI-generated content. 88% accuracy. Free.',
    url: 'https://aiscern.com/detect/video',
    images: [{ url: '/og-video.png', width: 1200, height: 630, alt: 'Deepfake Video Detector' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Deepfake Video Detector — Frame Analysis',
    description: 'Detect deepfake videos frame by frame. 88% accuracy. Free.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aiscern.com/detect/video',
      'url': 'https://aiscern.com/detect/video',
      'name': 'Deepfake Video Detector | Aiscern',
      'description': 'Detect deepfake videos with frame-by-frame AI analysis and 88% accuracy.',
      'isPartOf': { '@id': 'https://aiscern.com/#app' },
      'breadcrumb': {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://aiscern.com' },
          { '@type': 'ListItem', 'position': 2, 'name': 'Deepfake Video Detector', 'item': 'https://aiscern.com/detect/video' }
        ]
      }
    },
    {
      '@type': 'FAQPage',
      'mainEntity': [
                  {
                    "@type": "Question",
                    "name": "How does deepfake video detection work?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Aiscern extracts frames from your video and analyzes each frame with our proprietary vision engine for facial inconsistencies, temporal artifacts and GAN signatures. Results show per-frame AI scores." }
                  },
                  {
                    "@type": "Question",
                    "name": "What video formats are supported?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Aiscern supports MP4, WebM, MOV and AVI files for deepfake detection. Upload up to 100MB." }
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
