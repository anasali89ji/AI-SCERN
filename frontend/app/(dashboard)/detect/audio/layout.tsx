import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free AI Voice & Audio Detector — Detect ElevenLabs & Voice Cloning',
  description: 'Detect AI-synthesised voice, ElevenLabs audio, voice cloning and deepfake speech. 91% accuracy. Upload MP3, WAV or M4A — free, instant detection. No signup required.',
  keywords: [
    'ai audio detector','voice clone detector','elevenlabs detector',
    'deepfake audio detector','ai voice detector','synthetic voice detector',
    'tts detector','text to speech detector','voice cloning detector',
    'detect fake voice','ai speech detector','audio authenticity checker',
    'deepfake voice checker','suno detector','udio audio detector',
  ],
  alternates: { canonical: 'https://aiscern.com/detect/audio' },
  openGraph: {
    title: 'Free AI Audio & Voice Clone Detector — ElevenLabs, TTS | Aiscern',
    description: 'Upload audio and detect if it is AI-synthesised or voice-cloned. Detects ElevenLabs, Suno, Udio. 91% accuracy. Free.',
    url: 'https://aiscern.com/detect/audio',
    images: [{ url: '/og-audio.png', width: 1200, height: 630, alt: 'AI Audio & Voice Clone Detector' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free AI Voice & Audio Detector — ElevenLabs, Voice Cloning',
    description: 'Detect AI-synthesised voice and voice cloning. 91% accuracy. Free.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aiscern.com/detect/audio',
      'url': 'https://aiscern.com/detect/audio',
      'name': 'AI Voice & Audio Detector | Aiscern',
      'description': 'Detect ElevenLabs, voice cloning and AI-synthesised audio with 91% accuracy.',
      'isPartOf': { '@id': 'https://aiscern.com/#app' },
      'breadcrumb': {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://aiscern.com' },
          { '@type': 'ListItem', 'position': 2, 'name': 'AI Audio Detector', 'item': 'https://aiscern.com/detect/audio' }
        ]
      }
    },
    {
      '@type': 'FAQPage',
      'mainEntity': [
                  {
                    "@type": "Question",
                    "name": "How do I detect ElevenLabs voice cloning?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Upload an MP3 or WAV file to Aiscern. Aiscern's audio detection engine analyzes prosody, spectral patterns and acoustic signatures to detect ElevenLabs and other AI voice synthesis with 91% accuracy." }
                  },
                  {
                    "@type": "Question",
                    "name": "What audio formats are supported?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Aiscern supports MP3, WAV, M4A and OGG audio files for AI voice detection. Maximum file size is 50MB." }
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
