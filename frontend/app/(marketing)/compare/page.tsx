import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { CheckCircle, XCircle, Minus, ArrowRight, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Aiscern vs GPTZero vs ZeroGPT — AI Detector Comparison',
  description: 'Side-by-side comparison of Aiscern, GPTZero, ZeroGPT, Originality.ai, and other AI content detectors. Multi-modal, accuracy, pricing, and features.',
  openGraph: {
    title: 'AI Detector Comparison — Aiscern vs Competitors',
    description: 'Compare Aiscern with GPTZero, ZeroGPT, Originality.ai and more.',
    url: 'https://aiscern.com/compare',
    siteName: 'Aiscern',
  },
}

type CellValue = 'yes' | 'no' | 'partial' | string

interface CompareRow {
  feature: string
  aiscern: CellValue
  gptzero: CellValue
  zerogpt: CellValue
  originality: CellValue
}

const ROWS: CompareRow[] = [
  { feature: 'Text Detection',          aiscern: 'yes',      gptzero: 'yes',     zerogpt: 'yes',     originality: 'yes'     },
  { feature: 'Image Detection',         aiscern: 'yes',      gptzero: 'no',      zerogpt: 'no',      originality: 'no'      },
  { feature: 'Audio Detection',         aiscern: 'yes',      gptzero: 'no',      zerogpt: 'no',      originality: 'no'      },
  { feature: 'Video Detection',         aiscern: 'yes',      gptzero: 'no',      zerogpt: 'no',      originality: 'no'      },
  { feature: 'Ensemble Models (8+)',    aiscern: 'yes',      gptzero: 'partial', zerogpt: 'partial', originality: 'partial' },
  { feature: 'Sentence-Level Heatmap', aiscern: 'yes',      gptzero: 'yes',     zerogpt: 'no',      originality: 'yes'     },
  { feature: 'Confidence Intervals',   aiscern: 'yes',      gptzero: 'partial', zerogpt: 'no',      originality: 'partial' },
  { feature: 'API Access',             aiscern: 'yes',      gptzero: 'yes',     zerogpt: 'partial', originality: 'yes'     },
  { feature: 'Free Tier',              aiscern: 'yes',      gptzero: 'yes',     zerogpt: 'yes',     originality: 'no'      },
  { feature: 'PDF Export Reports',     aiscern: 'yes',      gptzero: 'yes',     zerogpt: 'no',      originality: 'yes'     },
  { feature: 'Batch Processing',       aiscern: 'yes',      gptzero: 'yes',     zerogpt: 'no',      originality: 'yes'     },
  { feature: 'Open Methodology Page',  aiscern: 'yes',      gptzero: 'partial', zerogpt: 'no',      originality: 'partial' },
  { feature: 'Multi-Language Support', aiscern: 'partial',  gptzero: 'partial', zerogpt: 'partial', originality: 'partial' },
  { feature: 'Text Accuracy (AUC)',    aiscern: '0.98',     gptzero: '~0.95',   zerogpt: '~0.88',   originality: '~0.96'   },
  { feature: 'Image Accuracy (AUC)',   aiscern: '0.96',     gptzero: 'N/A',     zerogpt: 'N/A',     originality: 'N/A'     },
]

function Cell({ value }: { value: CellValue }) {
  if (value === 'yes') return <CheckCircle className="w-5 h-5 text-emerald-400-400 mx-auto" />
  if (value === 'no')  return <XCircle className="w-5 h-5 text-rose-400/60 mx-auto" />
  if (value === 'partial') return <Minus className="w-5 h-5 text-amber-400-500 mx-auto" />
  return <span className="text-xs text-slate-400">{value}</span>
}

export default function ComparePage() {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-[#08080d] pt-16">
        {/* Hero */}
        <section className="py-16 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08)_0%,transparent_60%)] pointer-events-none" />
          <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-6">
              <Zap className="w-3.5 h-3.5" />
              Comparison
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-100 mb-4 leading-tight">
              How Aiscern Compares<br /><span className="gradient-text">to Other Detectors</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Most AI detectors only handle text. Aiscern is the only free-tier detector with multi-modal coverage across text, image, audio, and video.
            </p>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="pb-16">
          <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-surface/60">
                    <th className="px-5 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wide w-1/3">Feature</th>
                    <th className="px-4 py-4 text-center">
                      <div className="font-black text-blue-400 text-sm">Aiscern</div>
                      <div className="text-xs text-slate-500">Free tier available</div>
                    </th>
                    <th className="px-4 py-4 text-center">
                      <div className="font-bold text-slate-100 text-sm">GPTZero</div>
                      <div className="text-xs text-slate-500">From $10/mo</div>
                    </th>
                    <th className="px-4 py-4 text-center">
                      <div className="font-bold text-slate-100 text-sm">ZeroGPT</div>
                      <div className="text-xs text-slate-500">Free / paid</div>
                    </th>
                    <th className="px-4 py-4 text-center">
                      <div className="font-bold text-slate-100 text-sm">Originality.ai</div>
                      <div className="text-xs text-slate-500">Pay-per-credit</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, i) => (
                    <tr key={i} className={`border-b border-white/[0.06] ${i % 2 === 0 ? 'bg-surface/10' : ''}`}>
                      <td className="px-5 py-3 text-sm text-slate-400 font-medium">{row.feature}</td>
                      <td className="px-4 py-3 text-center bg-blue-600/[0.03]"><Cell value={row.aiscern} /></td>
                      <td className="px-4 py-3 text-center"><Cell value={row.gptzero} /></td>
                      <td className="px-4 py-3 text-center"><Cell value={row.zerogpt} /></td>
                      <td className="px-4 py-3 text-center"><Cell value={row.originality} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-3 text-center">
              Competitor data based on publicly available information as of June 2026. Accuracy figures are approximate and vary by dataset. See{' '}
              <Link href="/benchmarks" className="text-blue-500 hover:underline">our benchmarks</Link> for Aiscern&apos;s measured performance.
            </p>
          </div>
        </section>

        {/* Key Differentiators */}
        <section className="py-12 bg-surface/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-slate-100 text-center mb-8">Why Aiscern Is Different</h2>
            <div className="grid sm:grid-cols-3 gap-5">
              {[
                { title: 'Only multi-modal free detector', desc: 'Text, image, audio, and video detection under one roof. No other free-tier detector covers all four modalities.' },
                { title: 'Ensemble, not single-model', desc: '8+ specialized models combined with Bayesian fusion. Single-model detectors are easier to fool and have higher false positive rates.' },
                { title: 'Open methodology', desc: 'We publish our benchmark datasets, model breakdown, and confidence thresholds at /methodology. Most competitors treat their methods as black boxes.' },
              ].map((d, i) => (
                <div key={i} className="card border border-white/[0.08] rounded-xl p-5">
                  <div className="text-2xl font-black text-blue-500/20 mb-2">0{i+1}</div>
                  <h3 className="font-bold text-slate-100 text-sm mb-2">{d.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{d.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-black text-slate-100 mb-4">Try it yourself — free</h2>
            <p className="text-slate-400 mb-6 text-sm">No credit card required. Run your first detection in under 60 seconds.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/detect/text" className="btn-primary">
                Start Free Detection <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing" className="btn-secondary">View Pricing</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
