import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Voice & Audio Verification — ElevenLabs & Voice Cloning Detection',
  description: 'Enterprise AI voice and audio verification for ElevenLabs audio, voice cloning and deepfake speech. 92%+ accuracy. Free tier available.',
  keywords: [
    'ai audio verification','voice clone verification','elevenlabs detector',
    'deepfake audio verification','ai voice detector','synthetic voice detector',
    'tts detector','text to speech detector','voice cloning verification',
    'verify fake voice','ai speech verification','audio authenticity verification',
    'deepfake voice checker','suno detector','enterprise audio verification',
  ],
  alternates: { canonical: 'https://aiscern.com/detect/audio' },
  openGraph: {
    title: 'AI Voice & Audio Verification — ElevenLabs & TTS Detection | Aiscern',
    description: 'Upload audio and get an enterprise-grade verification verdict: AI-synthesised or voice-cloned. Verifies ElevenLabs, Suno, Udio. 92%+ accuracy.',
    url: 'https://aiscern.com/detect/audio',
    images: [{ url: 'https://aiscern.com/api/og?title=AI+Voice+%26+Audio+Verification&tool=Audio&color=%230ea5e9', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Voice & Audio Verification — ElevenLabs, Voice Cloning',
    description: 'Get an enterprise-grade verification verdict on AI-synthesised voice and voice cloning. 92%+ accuracy.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aiscern.com/detect/audio',
      'url': 'https://aiscern.com/detect/audio',
      'name': 'AI Voice & Audio Verification | Aiscern',
      'description': 'Verify ElevenLabs, voice cloning and AI-synthesised audio with 92%+ accuracy using enterprise-grade AI audio verification.',
      'isPartOf': { '@id': 'https://aiscern.com/#app' },
      'breadcrumb': {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://aiscern.com' },
          { '@type': 'ListItem', 'position': 2, 'name': 'AI Audio Verification', 'item': 'https://aiscern.com/detect/audio' }
        ]
      }
    },
    {
      '@type': 'FAQPage',
      'mainEntity': [
                  {
                    "@type": "Question",
                    "name": "How do I verify ElevenLabs voice cloning?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Upload an MP3 or WAV file to Aiscern. Aiscern's audio verification engine analyzes prosody, spectral patterns and acoustic signatures to verify ElevenLabs and other AI voice synthesis with 92%+ accuracy." }
                  },
                  {
                    "@type": "Question",
                    "name": "What audio formats are supported?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Aiscern supports MP3, WAV, M4A and OGG audio files for AI voice detection. Maximum file size is 50MB." }
                  }
      ]
    }
  ,
    {
    "@type": "HowTo",
    "name": "How to verify AI-generated audio and voice clones",
    "description": "Use Aiscern's enterprise audio verification tool to determine if a voice recording is real or AI-synthesised.",
    "step": [
        {
            "@type": "HowToStep",
            "name": "Upload your audio",
            "text": "Drag and drop or click to upload an MP3, WAV, or M4A file up to 50MB."
        },
        {
            "@type": "HowToStep",
            "name": "Run verification",
            "text": "Click Analyze. Aiscern checks spectral features and voice patterns against TTS model signatures."
        },
        {
            "@type": "HowToStep",
            "name": "Read the verdict",
            "text": "See whether the audio is real human speech or AI-generated, with a confidence score."
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
