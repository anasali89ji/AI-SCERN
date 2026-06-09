import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { BookOpen, ArrowRight, FileText, Eye, Music, Video, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'User Guides — Aiscern',
  description: 'Step-by-step guides on how to detect AI text, verify deepfake images, check audio for voice cloning, and more. Free resources for all users.',
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
    title: 'How to Detect AI-Generated Text',
    desc: 'A step-by-step guide to identifying AI-written content using Aiscern\'s text detection ensemble. Covers paste, upload, URL scan, and interpreting confidence scores.',
    steps: ['Paste or upload your text', 'Review overall confidence score', 'Examine sentence-level heatmap', 'Export report if needed'],
    href: '/detect/text',
    cta: 'Try Text Detection',
  },
  {
    icon: Eye,
    color: 'blue',
    title: 'How to Verify Deepfake Images',
    desc: 'Learn how to upload images for AI generation detection, understand the pixel-integrity analysis, and interpret results for synthetic images from Midjourney, DALL-E, Stable Diffusion, and more.',
    steps: ['Upload image (JPG, PNG, WebP)', 'Review ViT classifier confidence', 'Check pixel integrity signals', 'Review per-generator fingerprint analysis'],
    href: '/detect/image',
    cta: 'Try Image Detection',
  },
  {
    icon: Music,
    color: 'emerald',
    title: 'How to Detect AI-Cloned Audio',
    desc: 'Understand how Aiscern analyzes audio files for voice synthesis signatures. Guide covers supported formats, spectral analysis, and interpreting voice clone detection results.',
    steps: ['Upload audio file (MP3, WAV, M4A)', 'Wait for spectral analysis (8–15s)', 'Review voice synthesis confidence', 'Check ASVspoof benchmark comparison'],
    href: '/detect/audio',
    cta: 'Try Audio Detection',
  },
  {
    icon: Video,
    color: 'amber',
    title: 'How to Detect Deepfake Video',
    desc: 'A complete guide to video deepfake detection using Aiscern\'s frame-level ViT ensemble and temporal consistency analysis. Covers face-swap, lip-sync, and full-body synthesis detection.',
    steps: ['Upload video file (MP4, MOV, WebM)', 'Frame extraction and analysis begins', 'Temporal consistency check runs', 'Review frame-level confidence breakdown'],
    href: '/detect/video',
    cta: 'Try Video Detection',
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
    desc: 'A deep dive into what Aiscern\'s confidence percentages actually mean, how to interpret uncertain results, and when not to act on a single detection result.',
    steps: ['≥62% = AI classification', '39–61% = Uncertain zone', '≤38% = Human classification', 'Always use alongside human judgment'],
    href: '/methodology',
    cta: 'Read Full Methodology',
  },
]

const colorMap: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
  primary: { bg: 'bg-primary/8', border: 'border-primary/20', icon: 'text-primary', badge: 'text-primary bg-primary/10 border-primary/20' },
  cyan:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: 'text-blue-400',    badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20'         },
  emerald: { bg: 'bg-emerald/8', border: 'border-emerald/20', icon: 'text-emerald', badge: 'text-emerald bg-emerald/10 border-emerald/20' },
  amber:   { bg: 'bg-amber/8',   border: 'border-amber/20',   icon: 'text-amber',   badge: 'text-amber bg-amber/10 border-amber/20'       },
  rose:    { bg: 'bg-rose/8',    border: 'border-rose/20',    icon: 'text-rose',    badge: 'text-rose bg-rose/10 border-rose/20'           },
}

export default function GuidesPage() {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-background pt-16">
        {/* Hero */}
        <section className="py-16 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08)_0%,transparent_60%)] pointer-events-none" />
          <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-6">
              <BookOpen className="w-3.5 h-3.5" />
              User Guides
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-text-primary mb-4 leading-tight">
              How to Use<br /><span className="gradient-text">Aiscern</span>
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              Step-by-step guides for every detection modality. Learn how to get the most accurate results and interpret what the scores mean.
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
                  <div key={i} className="card border border-white/[0.08] rounded-xl p-6 flex flex-col gap-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0`}>
                        <GIcon className={`w-5 h-5 ${c.icon}`} />
                      </div>
                      <div>
                        <h2 className="font-bold text-text-primary mb-1">{guide.title}</h2>
                        <p className="text-sm text-text-muted leading-relaxed">{guide.desc}</p>
                      </div>
                    </div>

                    {/* Steps */}
                    <ol className="space-y-2">
                      {guide.steps.map((step, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-xs text-text-secondary">
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
            <div className="mt-12 p-6 rounded-xl border border-primary/20 bg-primary/5 text-center">
              <h2 className="text-lg font-bold text-text-primary mb-2">Need more help?</h2>
              <p className="text-sm text-text-muted mb-4">Check our FAQ, read the API docs, or contact our support team.</p>
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
