import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Video Verification — Frame-by-Frame Deepfake Detection',
  description: 'Enterprise AI video verification with frame-by-frame deepfake analysis. Identify face swaps, synthetic faces and AI-generated video content. 90%+ accuracy.',
  keywords: [
    'ai video verification','deepfake verification online','ai video detector',
    'verify deepfake video','face swap detector','synthetic video detector',
    'deepfake checker','video authenticity verification','ai generated video verification',
    'deepfake face swap','sora detector','verify ai video','fake video detector',
    'enterprise video verification','video deepfake detection',
  ],
  alternates: { canonical: 'https://aiscern.com/detect/video' },
  openGraph: {
    title: 'AI Video Verification — Frame-by-Frame Deepfake Detection | Aiscern',
    description: 'Upload a video and get an enterprise-grade frame-by-frame verification verdict on deepfakes and AI-generated content. 90%+ accuracy.',
    url: 'https://aiscern.com/detect/video',
    images: [{ url: 'https://aiscern.com/api/og?title=AI+Video+Verification&tool=Video&color=%23f43f5e', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Video Verification — Frame Analysis',
    description: 'Get an enterprise-grade verification verdict on deepfake video, frame by frame. 90%+ accuracy.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aiscern.com/detect/video',
      'url': 'https://aiscern.com/detect/video',
      'name': 'AI Video Verification | Aiscern',
      'description': 'Verify deepfake videos with frame-by-frame AI analysis and 90%+ accuracy using enterprise-grade AI video verification.',
      'isPartOf': { '@id': 'https://aiscern.com/#app' },
      'breadcrumb': {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://aiscern.com' },
          { '@type': 'ListItem', 'position': 2, 'name': 'AI Video Verification', 'item': 'https://aiscern.com/detect/video' }
        ]
      }
    },
    {
      '@type': 'FAQPage',
      'mainEntity': [
                  {
                    "@type": "Question",
                    "name": "How does deepfake video verification work?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Aiscern extracts frames from your video and analyzes each frame with an ensemble vision model for facial inconsistencies, temporal artifacts and GAN signatures to verify authenticity. Results show per-frame AI scores." }
                  },
                  {
                    "@type": "Question",
                    "name": "What video formats are supported?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Aiscern supports MP4, WebM, MOV and AVI files for deepfake detection. Upload up to 100MB." }
                  }
      ]
    }
  ,
    {
    "@type": "HowTo",
    "name": "How to verify deepfake videos",
    "description": "Use Aiscern's enterprise video verification tool to analyze video frames for AI manipulation.",
    "step": [
        {
            "@type": "HowToStep",
            "name": "Upload your video",
            "text": "Open in Chrome or Edge. Drag and drop or upload an MP4, WebM, or MOV file up to 500MB."
        },
        {
            "@type": "HowToStep",
            "name": "Frame extraction",
            "text": "Aiscern automatically extracts key frames from the video using canvas capture."
        },
        {
            "@type": "HowToStep",
            "name": "Read the verdict",
            "text": "See per-frame AI scores and an overall deepfake verdict with confidence percentage."
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
