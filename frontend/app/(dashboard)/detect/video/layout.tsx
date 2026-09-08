import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free Deepfake Video Detector Online — Frame-by-Frame AI Analysis',
  description: 'Detect deepfake videos with frame-by-frame AI analysis. Identify face swaps, synthetic faces and AI-generated video content. 90%+ accuracy. Free. No credit card required.',
  keywords: [
    'deepfake video detector','deepfake detector online free','ai video detector',
    'detect deepfake','face swap detector','synthetic video detector',
    'deepfake checker','video authenticity checker','ai generated video detector',
    'deepfake face swap','sora detector','detect ai video','fake video detector',
    'deepfake detection tool','video deepfake detection',
  ],
  alternates: { canonical: 'https://aiscern.com/detect/video' },
  openGraph: {
    title: 'Free Deepfake Video Detector — Frame-by-Frame AI Analysis | Aiscern',
    description: 'Upload a video and detect deepfakes frame by frame. Identifies face swaps and AI-generated content. 90%+ accuracy. Free.',
    url: 'https://aiscern.com/detect/video',
    images: [{ url: 'https://aiscern.com/api/og?title=Free+Deepfake+Video+Detector&tool=Video&color=%23f43f5e', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Deepfake Video Detector — Frame Analysis',
    description: 'Detect deepfake videos frame by frame. 90%+ accuracy. Free.',
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
      'description': 'Detect deepfake videos with frame-by-frame AI analysis and 90%+ accuracy.',
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
                    "acceptedAnswer": { "@type": "Answer", "text": "Aiscern extracts frames from your video and analyzes each frame with an ensemble vision model for facial inconsistencies, temporal artifacts and GAN signatures. Results show per-frame AI scores." }
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
    "name": "How to detect deepfake videos",
    "description": "Use Aiscern's free deepfake detector to analyze video frames for AI manipulation.",
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
