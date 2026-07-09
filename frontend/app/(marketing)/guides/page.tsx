import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { BookOpen, ArrowRight, FileText, Eye, Music, Video, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'User Guides — Aiscern',
  description: 'Step-by-step guides on how to attest AI text, verify deepfake images, check audio for voice cloning, and more. Free resources for all users.',
  openGraph: {
    title: 'User Guides — Aiscern',
    url: 'https://aiscern.com/guides',
    siteName: 'Aiscern',
  },
}

const GUIDES = [
  {
    icon: FileText,
    color: 'primary',
    title: 'How to Attest AI-Generated Text',
    desc: 'A step-by-step guide to identifying AI-written content using Aiscern\'s text attestation ensemble. Covers paste, upload, URL examination, and interpreting integrity ratings.',
    steps: ['Paste or upload your text', 'Review overall confidence score', 'Examine sentence-level heatmap', 'Export report if needed'],
    href: '/detect/text',
    cta: 'Try Text Attestation',
  },
  {
    icon: Eye,
    color: 'blue',
    title: 'How to Verify Deepfake Images',
    desc: 'Learn how to upload images for AI generation attestation, understand the pixel-integrity analysis, and interpret results for synthetic images from Midjourney, DALL-E, Stable Diffusion, and more.',
    steps: ['Upload image (JPG, PNG, WebP)', 'Review ViT classifier confidence', 'Check pixel integrity signals', 'Review per-generator fingerprint analysis'],
    href: '/detect/image',
    cta: 'Try Image Attestation',
  },
  {
    icon: Music,
    color: 'emerald',
    title: 'How to Attest AI-Cloned Audio',
    desc: 'Understand how Aiscern analyzes audio files for voice synthesis signatures. Guide covers supported formats, spectral analysis, and interpreting voice clone attestation results.',
    steps: ['Upload audio file (MP3, WAV, M4A)', 'Wait for spectral analysis (8–15s)', 'Review voice synthesis confidence', 'Check ASVspoof benchmark comparison'],
    href: '/detect/audio',
    cta: 'Try Audio Attestation',
  },
  {
    icon: Video,
    color: 'amber',
    title: 'How to Attest Deepfake Video',
    desc: 'A complete guide to video deepfake attestation using Aiscern\'s frame-level ViT ensemble and temporal consistency analysis. Covers face-swap, lip-sync, and full-body synthesis attestation.',
    steps: ['Upload video file (MP4, MOV, WebM)', 'Frame extraction and analysis begins', 'Temporal consistency check runs', 'Review frame-level confidence breakdown'],
    href: '/detect/video',
    cta: 'Try Video Attestation',
  },
  {
    icon: Zap,
    color: 'rose',
    title: 'How to Use Batch Processing',
    desc: 'Speed up bulk content verification with Aiscern\'s batch analysis. This guide covers how to upload multiple files, interpret batch results, and export bulk reports.',
    steps: ['Navigate to /batch (Pro+ required)', 'Drag and drop multiple files', 'Monitor job progress dashboard', 'Export results CSV or individual PDFs'],
    href: '/batch',
    cta: 'Open Batch Analyzer',
  },
  {
    icon: BookOpen,
    color: 'primary',
    title: 'Understanding Confidence Scores',
    desc: 'A deep dive into what Aiscern\'s confidence percentages actually mean, how to interpret uncertain results, and when not to act on a single attestation result.',
    steps: ['≥62% = AI classification', '39–61% = Uncertain zone', '≤38% = Human classification', 'Always use alongside human judgment'],
    href: '/methodology',
    cta: 'Read Full Methodology',
  },
]

const colorMap: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
  primary: { bg: 'bg-[#2BEE34]/10', border: 'border-[#2BEE34]/20', icon: 'text-[#2BEE34]', badge: 'text-[#2BEE34] bg-[#2BEE34]/10 border-[#2BEE34]/20' },
  blue:    { bg: 'bg-[#2BEE34]/10', border: 'border-[#2BEE34]/20', icon: 'text-[#2BEE34]', badge: 'text-[#2BEE34] bg-[#2BEE34]/10 border-[#2BEE34]/20' },
  cyan:    { bg: 'bg-[#2BEE34]/10', border: 'border-[#2BEE34]/20', icon: 'text-[#2BEE34]', badge: 'text-[#2BEE34] bg-[#2BEE34]/10 border-[#2BEE34]/20' },
  emerald: { bg: 'bg-[#2BEE34]/10', border: 'border-[#2BEE34]/20', icon: 'text-[#2BEE34]', badge: 'text-[#2BEE34] bg-[#2BEE34]/10 border-[#2BEE34]/20' },
  amber:   { bg: 'bg-[#FFB800]/10',   border: 'border-[#FFB800]/20',   icon: 'text-[#FFB800]',   badge: 'text-[#FFB800] bg-[#FFB800]/10 border-[#FFB800]/20'   },
  rose:    { bg: 'bg-[#FF4444]/10',    border: 'border-[#FF4444]/20',    icon: 'text-[#FF4444]',    badge: 'text-[#FF4444] bg-[#FF4444]/10 border-[#FF4444]/20'     },
}

export default function GuidesPage() {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-[#08080d] pt-16">
        {/* Hero */}
        <section className="py-16 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08)_0%,transparent_60%)] pointer-events-none" />
          <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2BEE34]/10 border border-[#2BEE34]/20 text-xs font-semibold text-[#2BEE34] mb-6">
              <BookOpen className="w-3.5 h-3.5" />
              User Guides
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              How to Use<br /><span className="text-[#2BEE34]">Aiscern</span>
            </h1>
            <p className="text-lg text-[#A3A3A3] max-w-2xl mx-auto">
              Step-by-step guides for every attestation modality. Learn how to get the most accurate results and interpret what the scores mean.
            </p>
          </div>
        </section>

        {/* Guides Grid */}
        <section className="pb-20">
          <div className="max-w-5xl 2xl:max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="grid sm:grid-cols-2 gap-6">
              {GUIDES.map((guide, i) => {
                const GIcon = guide.icon
                const c = colorMap[guide.color]
                return (
                  <div key={i} className="card border border-[#1E1E1E] rounded-xl p-6 flex flex-col gap-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0`}>
                        <GIcon className={`w-5 h-5 ${c.icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-white mb-1">{guide.title}</h2>
                        <p className="text-sm text-[#6B6B6B] leading-relaxed">{guide.desc}</p>
                      </div>
                    </div>

                    {/* Steps */}
                    <ol className="space-y-2">
                      {guide.steps.map((step, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-xs text-[#A3A3A3]">
                          <span className={`w-5 h-5 rounded-full ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${c.icon}`}>
                            {j + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>

                    <Link href={guide.href} className={`inline-flex items-center gap-1.5 text-xs font-semibold ${c.icon} hover:underline mt-auto`}>
                      {guide.cta} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )
              })}
            </div>

            {/* More Resources */}
            <div className="mt-12 p-6 rounded-xl border border-[#2BEE34]/20 bg-[#2BEE34]/5 text-center">
              <h2 className="text-lg font-bold text-white mb-2">Need more help?</h2>
              <p className="text-sm text-[#6B6B6B] mb-4">Check our FAQ, read the API docs, or contact our support team.</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/faq" className="btn-secondary text-sm">FAQ</Link>
                <Link href="/docs/api" className="btn-secondary text-sm">API Docs</Link>
                <Link href="/contact" className="btn-secondary text-sm">Contact Support</Link>
                <Link href="/methodology" className="btn-secondary text-sm">Methodology</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
