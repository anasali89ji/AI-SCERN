import Link from 'next/link'
import { SiteNav }    from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { SquareArrowOutUpRight, ArrowRight, Info, AlertTriangle } from 'lucide-react'
import { fetchBenchmarks, type BenchmarkRow } from '@/lib/benchmarks'

// Disable static generation — the page must render fresh per request so the
// `measured` flag reflects the current state of the `model_accuracy_30d` view.
export const dynamic = 'force-dynamic'
export const revalidate = 60

export const metadata = {
  title: 'AI Verification Accuracy Benchmarks | Aiscern',
  description: 'Aiscern verification accuracy benchmarks: AUC-ROC, precision, recall, F1, and false-positive rates for AI content detection across text, image, audio, and video modalities.',
  openGraph: { title: 'AI Verification Accuracy Benchmarks | Aiscern', url: 'https://aiscern.com/benchmarks' },
}

// The hardcoded TEXT_RESULTS / IMAGE_RESULTS / AUDIO_RESULTS / VIDEO_RESULTS
// arrays that previously lived here have been moved to
// `frontend/lib/benchmarks.ts` as FALLBACK_TARGETS — the single source of
// truth shared with /api/benchmarks/csv/route.ts. When Supabase returns no
// rows from model_accuracy_30d, fetchBenchmarks() returns FALLBACK_TARGETS
// with measured:false and the page renders the "target values" banner.
const DATASETS = [
  { modality:'Text',  name:'PAN25 Authorship Verification',   url:'https://pan.webis.de/clef25/pan25-web/authorship-verification.html', size:'~500K samples' },
  { modality:'Text',  name:'PERSUADE Corpus 2.0',             url:'https://github.com/scrosseye/persuade_corpus_2.0',                  size:'~25K essays'   },
  { modality:'Text',  name:'M4 Benchmark',                    url:'https://github.com/mbzuai-nlp/M4',                                  size:'122K samples'  },
  { modality:'Image', name:'CIFAKE',                           url:'https://www.kaggle.com/datasets/birdy654/cifake-real-and-ai-generated-synthetic-images', size:'120K images'   },
  { modality:'Image', name:'GenImage',                         url:'https://github.com/GenImage-Dataset/GenImage',                      size:'1.3M images'   },
  { modality:'Audio', name:'ASVspoof 2019 (LA track)',         url:'https://www.asvspoof.org/',                                         size:'121K clips'    },
  { modality:'Audio', name:'ASVspoof 2021',                    url:'https://www.asvspoof.org/',                                         size:'181K clips'    },
  { modality:'Audio', name:'ADD 2023',                         url:'https://addchallenge.cn/',                                          size:'~330K clips'   },
  { modality:'Video', name:'FaceForensics++',                  url:'https://github.com/ondyari/FaceForensics',                          size:'5K videos'     },
  { modality:'Video', name:'DFDC Preview Dataset (Meta)',      url:'https://ai.meta.com/datasets/dfdc/',                                size:'19K videos'    },
]

function BenchTable({ rows }: { rows: { model: string; auc: number; precision: number; recall: number; f1: number; fpr: number }[] }) {
  return (
    <>
      {/* Mobile (<640px): one card per model — a 6-column table (Model + 5 metrics)
          only has overflow-x-auto with no fallback, so the model name scrolls
          off-screen from the numbers it describes. Cards keep name and metrics
          in the same view. */}
      <div className="sm:hidden space-y-2.5">
        {rows.map((row, i) => {
          const isEnsemble = row.model.startsWith('Ensemble')
          return (
            <div key={i} className={`rounded-xl border p-4 ${isEnsemble ? 'bg-accent/5 border-accent/20' : 'bg-surface border-silver-300'}`}>
              <p className={`text-sm font-medium mb-3 ${isEnsemble ? 'text-accent' : 'text-silver-800'}`}>{row.model}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'AUC-ROC',   value: row.auc.toFixed(2), accent: isEnsemble },
                  { label: 'Precision', value: `${(row.precision*100).toFixed(1)}%` },
                  { label: 'Recall',    value: `${(row.recall*100).toFixed(1)}%` },
                  { label: 'F1',        value: row.f1.toFixed(3) },
                  { label: 'FPR',       value: `${(row.fpr*100).toFixed(1)}%`, warn: true },
                ].map(m => (
                  <div key={m.label} className="bg-depth-bg rounded-lg py-2 px-1">
                    <p className={`text-sm font-bold tabular-nums ${m.warn ? 'text-warning' : m.accent ? 'text-accent' : 'text-silver-800'}`}>{m.value}</p>
                    <p className="text-[9px] text-silver-600 uppercase tracking-wide mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tablet & up: table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-silver-300">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-silver-300 bg-depth-bg">
            {['Model','AUC-ROC','Precision','Recall','F1','FPR'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-silver-600 first:text-left text-center">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isEnsemble = row.model.startsWith('Ensemble')
            return (
              <tr
                key={i}
                className={`border-b border-silver-300 last:border-0 transition-colors ${
                  isEnsemble
                    ? 'bg-accent/5 border-accent/10'
                    : 'bg-surface hover:bg-surface-elevated'
                }`}
              >
                <td className={`px-4 py-3 font-medium ${isEnsemble ? 'text-accent' : 'text-silver-800'}`}>
                  {row.model}
                </td>
                <td className={`px-4 py-3 text-center tabular-nums ${isEnsemble ? 'text-accent font-bold' : 'text-silver-800'}`}>
                  {row.auc.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-silver-800">{(row.precision*100).toFixed(1)}%</td>
                <td className="px-4 py-3 text-center tabular-nums text-silver-800">{(row.recall*100).toFixed(1)}%</td>
                <td className="px-4 py-3 text-center tabular-nums text-silver-800">{row.f1.toFixed(3)}</td>
                <td className="px-4 py-3 text-center tabular-nums text-warning">{(row.fpr*100).toFixed(1)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </>
  )
}

export default async function BenchmarksPage() {
  // Fetch live measured numbers from the model_accuracy_30d Supabase view.
  // Falls back to FALLBACK_TARGETS (the historical hardcoded values) with
  // `measured: false` when the view is empty or Supabase is unavailable.
  // Shared with /api/benchmarks/csv/route.ts via frontend/lib/benchmarks.ts
  // so the page and the API route never drift.
  const payload = await fetchBenchmarks()
  const measured = payload.measured
  const measuredAt = payload.measuredAt

  // Group by modality — works for both live rows and fallback targets.
  const groupByModality = (rows: BenchmarkRow[]) => {
    const map = new Map<string, BenchmarkRow[]>()
    for (const r of rows) {
      const k = r.modality
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    }
    return ['Text', 'Image', 'Audio', 'Video']
      .filter(k => map.has(k))
      .map(k => ({ label: k, rows: map.get(k)! }))
  }
  const sections = groupByModality(payload.models)

  return (
    <div className="min-h-screen bg-surface text-silver-800">
      <SiteNav />
      <main id="main-content" className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent mb-3">
              Transparency
            </p>
            <h1 className="text-[32px] sm:text-[52px] font-bold text-white tracking-[-0.02em] mb-3 sm:mb-4">
              Accuracy Benchmarks
            </h1>
            <p className="text-silver-700 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              AUC-ROC, precision, recall, F1, and false-positive rates across all modalities.
              {measured
                ? ' Measured on trailing-30-day user-feedback-validated scans.'
                : ' Target values from held-out test sets — live numbers below.'}
            </p>
          </div>

          {/* Measured-status banner — only renders when numbers are NOT yet measured */}
          {!measured && (
            <div className="flex gap-3 p-4 bg-warning/5 border border-warning/30 rounded-xl mb-8 sm:mb-10 text-sm text-silver-700">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-warning mb-1">These are target values, not measured values.</p>
                <p className="text-silver-700">
                  Live accuracy will appear here once 1,000+ user-feedback-validated scans accumulate
                  in the <code className="px-1 py-0.5 bg-surface-elevated rounded text-xs">model_accuracy_30d</code>{' '}
                  Supabase view. Until then, the numbers below are the engine&apos;s design targets on
                  held-out test sets from public benchmark datasets — not measurements of live traffic.
                </p>
              </div>
            </div>
          )}

          {/* Live-measured banner — only renders when numbers ARE measured */}
          {measured && measuredAt && (
            <div className="flex gap-3 p-4 bg-accent/5 border border-accent/30 rounded-xl mb-8 sm:mb-10 text-sm text-silver-700">
              <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-accent mb-1">Live measured accuracy (trailing 30 days).</p>
                <p className="text-silver-700">
                  Computed from <code className="px-1 py-0.5 bg-surface-elevated rounded text-xs">model_predictions</code>{' '}
                  × <code className="px-1 py-0.5 bg-surface-elevated rounded text-xs">scan_feedback</code>.
                  Last updated: {new Date(measuredAt).toLocaleString()}. Note: AUC column reflects
                  classification accuracy (verdict-vs-ground-truth) as a proxy — a true AUC requires
                  raw scores, see <Link href="/methodology" className="text-accent underline">methodology</Link>.
                </p>
              </div>
            </div>
          )}

          {/* Disclaimer — always shown */}
          <div className="flex gap-3 p-4 bg-surface-elevated border border-silver-400 rounded-xl mb-8 sm:mb-10 text-sm text-silver-700">
            <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <p>
              All figures are from held-out test sets — not cherry-picked. Results vary by content type, AI generator, compression level, and whether content has been edited after AI generation.
              Rows highlighted in green are the ensemble result (all signals combined).
            </p>
          </div>

          {/* Tables */}
          {sections.map(s => (
            <section key={s.label} className="mb-12">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                {s.label} Detection
              </h2>
              <BenchTable rows={s.rows} />
            </section>
          ))}

          {/* Datasets */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-white mb-4">Benchmark Datasets</h2>
            <div className="overflow-x-auto rounded-xl border border-silver-300">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-silver-300 bg-depth-bg">
                    {['Modality','Dataset','Size'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-silver-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DATASETS.map((d, i) => (
                    <tr key={i} className="border-b border-silver-300 last:border-0 bg-surface hover:bg-surface-elevated transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
                          {d.modality}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-silver-800 hover:text-accent transition-colors flex items-center gap-1 group"
                        >
                          {d.name}
                          <SquareArrowOutUpRight className="w-3 h-3 text-silver-600 group-hover:text-accent transition-colors" />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-silver-600 tabular-nums text-xs">{d.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Links */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/methodology"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl
                         bg-accent hover:bg-accent-hover text-depth-bg font-semibold text-sm
                         transition-colors duration-150">
              Read Methodology <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/detect/text"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl
                         border border-silver-400 text-silver-800 hover:border-accent hover:text-accent
                         font-semibold text-sm transition-all duration-150">
              Try Free Detection
            </Link>
          </div>

        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
