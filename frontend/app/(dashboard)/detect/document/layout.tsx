import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VerifyDoc — Enterprise Document AI & Originality Verification',
  description: 'VerifyDoc is Aiscern\u2019s enterprise document verification tool: every embedded image is checked for AI generation, every paragraph for AI writing, and the whole document for originality risk — all in parallel.',
  keywords: [
    'document ai verification', 'pdf ai verification', 'verify document', 'verifydoc',
    'verify ai generated images in pdf', 'verify ai text in word document',
    'enterprise document verification', 'ai content verification document', 'powerpoint ai detector',
    'docx ai detector', 'academic integrity checker', 'ai image and text verification',
  ],
  alternates: {
    canonical: 'https://aiscern.com/detect/document',
  },
  openGraph: {
    title: 'VerifyDoc — Full Document AI & Originality Verification | Aiscern',
    description: 'Upload a PDF, Word doc, or PowerPoint. VerifyDoc scans every embedded image for AI generation and every paragraph for AI writing — in parallel — plus an originality/plagiarism-risk pass.',
    url: 'https://aiscern.com/detect/document',
    images: [{ url: 'https://aiscern.com/api/og?title=VerifyDoc&tool=Document&color=%2306b6d4', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VerifyDoc — Full Document AI & Originality Verification',
    description: 'Scan PDFs, Word docs, and PowerPoints for AI-generated images, AI-written text, and plagiarism risk — all at once.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aiscern.com/detect/document',
      'url': 'https://aiscern.com/detect/document',
      'name': 'VerifyDoc | Aiscern',
      'description': 'Enterprise verification for PDF, DOCX, and PPTX documents: AI-generated images, AI-written text, and originality/plagiarism risk — in parallel.',
      'isPartOf': { '@id': 'https://aiscern.com/#app' },
      'breadcrumb': {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://aiscern.com' },
          { '@type': 'ListItem', 'position': 2, 'name': 'VerifyDoc', 'item': 'https://aiscern.com/detect/document' },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      'mainEntity': [
        {
          '@type': 'Question',
          'name': 'What file types does VerifyDoc support?',
          'acceptedAnswer': { '@type': 'Answer', 'text': 'VerifyDoc accepts PDF, Word (.docx), and PowerPoint (.pptx) files up to 25MB.' },
        },
        {
          '@type': 'Question',
          'name': 'How does VerifyDoc check images inside a document?',
          'acceptedAnswer': { '@type': 'Answer', 'text': 'Every embedded image is extracted and run through the same detection pipeline used by Aiscern\u2019s standalone image detector, including GAN-fingerprint analysis and physical-consistency forensics (illumination, shadow, and reflection physics) that catch AI generation even when compression has stripped other metadata.' },
        },
        {
          '@type': 'Question',
          'name': 'Does VerifyDoc check plagiarism against the internet?',
          'acceptedAnswer': { '@type': 'Answer', 'text': 'VerifyDoc\u2019s originality check is an offline heuristic: it looks for internal duplication, low lexical diversity, common boilerplate phrasing, and citation density within the document itself. It does not currently crawl external websites, so it reports an originality-risk score rather than a definitive plagiarism match.' },
        },
        {
          '@type': 'Question',
          'name': 'What happens if my document only has images, or only has text?',
          'acceptedAnswer': { '@type': 'Answer', 'text': 'VerifyDoc only runs the branches that have content: an image-only PDF skips text analysis, and a text-only document skips image analysis, so you never wait on a branch with nothing to check.' },
        },
      ],
    },
  ],
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
