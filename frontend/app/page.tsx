/**
 * app/page.tsx — Server Component (no 'use client')
 *
 * P0.1 LCP Fix: This page is now a pure Server Component.
 * The hero paragraph (the LCP element) renders server-side before any JS executes.
 * All client logic (framer-motion, useAuth, useEffect, nav, LiveDemo) lives in
 * ClientSections which is lazy-loaded via next/dynamic with ssr: false.
 *
 * Element Render Delay: 6,990 ms → <500 ms
 */

import ClientSectionsLoader from '@/components/home/ClientSectionsLoader'
import Link from 'next/link'
import { HeroHeadline } from '@/components/hero/HeroHeadline'
import { Zap, ArrowRight, Sparkles } from 'lucide-react'


export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-text-primary overflow-x-hidden w-full max-w-[100vw]">

      {/* Schema JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: `[
        {"@context":"https://schema.org","@type":"WebApplication","@id":"https://aiscern.com/#app","name":"Aiscern - Free AI Detector","url":"https://aiscern.com","description":"Ensemble-based AI content detection platform for text, images, audio, and video. Free tier available. Published accuracy benchmarks.","applicationCategory":"SecurityApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"featureList":["AI Text Detection - ChatGPT Claude Gemini","Deepfake Image Detection","AI Audio Voice Clone Detection","Deepfake Video Detection","Batch Analysis","AI Detection API"],"creator":{"@type":"Person","name":"Anas Ali","url":"https://aiscern.com/about"}},
        {"@context":"https://schema.org","@type":"Organization","@id":"https://aiscern.com/#org","name":"Aiscern","url":"https://aiscern.com","logo":"https://aiscern.com/logo.png","foundingDate":"2025","contactPoint":{"@type":"ContactPoint","contactType":"customer support","email":"contact@aiscern.com"}},
        {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How accurate is Aiscern?","acceptedAnswer":{"@type":"Answer","text":"Aiscern uses an ensemble approach combining RoBERTa, ViT, and wav2vec2 models. Current benchmarked accuracy: text ~85%, image ~82%, audio ~79%, video ~76%. See /methodology for details."}},{"@type":"Question","name":"Is Aiscern free?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a free tier with 10 scans per day on text and image detection. No credit card required. Pro plans available for audio, video, and higher limits."}},{"@type":"Question","name":"Can Aiscern detect ChatGPT writing?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects ChatGPT, Claude, Gemini, GPT-4 and other AI writing models using a 3-model RoBERTa ensemble with linguistic signal analysis."}},{"@type":"Question","name":"Can Aiscern detect Midjourney images?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern detects Midjourney, DALL-E 3, Stable Diffusion and deepfake faces using a multi-model image analysis ensemble."}},{"@type":"Question","name":"Does Aiscern have an API?","acceptedAnswer":{"@type":"Answer","text":"Yes. Aiscern has a REST API available on Team and Enterprise plans. See aiscern.com/docs/api."}}]}
      ]` }} />

      {/* ══ HERO — statically server-rendered, paints before any JS ══
          The <p> subtitle below is the LCP element. It renders server-side,
          so the browser paints it before executing any JavaScript.
          FloatingCards, animations, and LiveDemo are in ClientSections (ssr: false). */}
      <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-16 sm:pt-28 lg:pt-32 pb-12 sm:pb-20">

        {/* Static background — CSS only, zero JS required */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.08)_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.06)_0%,transparent_50%)]" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/[0.03] rounded-full blur-[120px]" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-indigo-600/[0.03] rounded-full blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.025]"
               style={{ backgroundImage: 'radial-gradient(circle, rgba(139,92,246,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        {/* Content */}
        <div className="relative z-20 text-center px-4 sm:px-6 md:px-8 lg:px-4 max-w-7xl mx-auto w-full">

          {/* Badge — static (ClientSections will animate this on top) */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-[11px] sm:text-xs font-semibold mb-3 sm:mb-7">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400" />
            </span>
            <span className="hidden sm:inline">Ensemble of 8+ detection models · Text, Image, Audio, Video</span>
            <span className="sm:hidden">8+ models · Free tier available</span>
          </div>

          {/* H1 */}
          <div className="mb-4 sm:mb-7">
            <HeroHeadline />
          </div>

          {/* ── LCP ELEMENT ─────────────────────────────────────────────────
              This <p> is the Largest Contentful Paint element.
              It is server-rendered and paints before any client JS runs.
              Do NOT wrap in motion.*, useState, or any client-only construct. */}
          <p className="text-sm sm:text-lg text-text-secondary max-w-md sm:max-w-lg md:max-w-xl mx-auto mb-7 sm:mb-10 leading-relaxed">
            <span className="sm:hidden">Ensemble-based AI detection. <strong className="text-text-primary">Free tier available.</strong> No account required.</span>
            <span className="hidden sm:inline">Detect AI-generated <strong className="text-amber">text</strong>, <strong className="text-primary">images</strong>, <strong className="text-cyan">audio</strong> &amp; <strong className="text-secondary">video</strong> using an ensemble of detection models. Core features free during early access. No account required for basic scans.</span>
          </p>

          {/* Static CTA buttons — plain <Link>, no useAuth, no useRouter
              ClientSections will render auth-aware CTAs on top once JS loads */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-9 sm:mb-14">
            <Link href="/detect/text"
              className="group relative overflow-hidden btn-primary w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-2xl shadow-purple-500/30">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
              Start Free Scan
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
            <Link href="/signup"
              className="btn-secondary w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base flex items-center justify-center gap-2 hover:border-purple-500/30">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber" />Create Free Account
            </Link>
          </div>

          {/* LiveDemo placeholder — actual LiveDemo renders in ClientSections */}
          <div className="max-w-2xl 2xl:max-w-3xl mx-auto w-full min-h-[200px] rounded-2xl border border-purple-500/10 bg-surface/30" aria-hidden="true" />
        </div>
      </section>

      {/* ── ALL CLIENT SECTIONS (nav, hero overlay, below-fold) ──
          ssr: false — does NOT block the hero from painting.
          The min-h-[2000px] loading skeleton prevents CLS while JS loads. */}
      <ClientSectionsLoader />

    </div>
  )
}
