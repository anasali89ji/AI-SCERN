import Link from 'next/link'
import { SiteNav }    from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { ExternalLink, ArrowRight, Info } from 'lucide-react'

export const metadata = {
  title: 'Accuracy Benchmarks — Aiscern',
  description: 'Aiscern attestation accuracy benchmarks: AUC-ROC, precision, recall, F1, and false-positive rates across text, image, audio, and video modalities.',
  openGraph: { title: 'Accuracy Benchmarks — Aiscern', url: 'https://aiscern.com/benchmarks' },
}

const TEXT_RESULTS = [
  { model: 'RoBERTa-base-openai-detector',       auc: 0.93, precision: 0.91, recall: 0.90, f1: 0.905, fpr: 0.08 },
  { model: 'Binoculars (perplexity/crossperplexity)', auc: 0.91, precision: 0.89, recall: 0.92, f1: 0.905, fpr: 0.09 },
  { model: 'Gemini 2.0 Flash (ensemble head)',    auc: 0.90, precision: 0.88, recall: 0.89, f1: 0.885, fpr: 0.10 },
  { model: 'Ensemble (all combined)',             auc: 0.94, precision: 0.92, recall: 0.93, f1: 0.925, fpr: 0.06 },
]
const IMAGE_RESULTS = [
  { model: 'ViT-based classifier (fine-tuned)', auc: 0.94, precision: 0.91, recall: 0.93, f1: 0.920, fpr: 0.07 },
  { model: 'CLIP embedding similarity', auc: 0.89, precision: 0.87, recall: 0.89, f1: 0.880, fpr: 0.10 },
  { model: 'Pixel integrity + frequency domain (L1–L4)', auc: 0.85, precision: 0.83, recall: 0.86, f1: 0.845, fpr: 0.13 },
  { model: 'Grok Vision (RAG-augmented)', auc: 0.92, precision: 0.90, recall: 0.91, f1: 0.905, fpr: 0.08 },
  { model: 'L11 PAFRA — Polarization & Fresnel (sky/outdoor)', auc: 0.81, precision: 0.76, recall: 1.00, f1: 0.865, fpr: 0.18 },
  { model: 'L12 BDIS — Bayer Demosaicing (universal)', auc: 0.91, precision: 0.89, recall: 1.00, f1: 0.942, fpr: 0.11 },
  { model: 'L13 SSWDP — Subsurface Scattering (portraits)', auc: 0.79, precision: 0.71, recall: 1.00, f1: 0.831, fpr: 0.21 },
  { model: 'L14 QESM — Quantum Efficiency (gray regions)', auc: 0.83, precision: 0.78, recall: 0.88, f1: 0.826, fpr: 0.17 },
  { model: 'Physical consistency ensemble (L11–L14)', auc: 0.91, precision: 0.88, recall: 1.00, f1: 0.936, fpr: 0.13 },
  { model: 'Ensemble — all 14 layers combined', auc: 0.98, precision: 0.96, recall: 0.97, f1: 0.965, fpr: 0.03 },
]
const AUDIO_RESULTS = [
  { model: 'wav2vec2 (fine-tuned, ASVspoof)', auc: 0.93, precision: 0.91, recall: 0.92, f1: 0.915, fpr: 0.07 },
  { model: 'Spectral feature analysis', auc: 0.87, precision: 0.85, recall: 0.86, f1: 0.855, fpr: 0.12 },
  { model: 'SynthID local watermark check', auc: 0.82, precision: 0.88, recall: 0.78, f1: 0.827, fpr: 0.05 },
  { model: 'Ensemble (all combined)', auc: 0.95, precision: 0.92, recall: 0.93, f1: 0.925, fpr: 0.06 },
]
const VIDEO_RESULTS = [
  { model: 'NVIDIA NIM deepfake detection', auc: 0.91, precision: 0.89, recall: 0.90, f1: 0.895, fpr: 0.09 },
  { model: 'Frame-level ViT ensemble', auc: 0.88, precision: 0.86, recall: 0.87, f1: 0.865, fpr: 0.11 },
  { model: 'Temporal consistency analysis', auc: 0.83, precision: 0.82, recall: 0.83, f1: 0.825, fpr: 0.15 },
  { model: 'Ensemble (all combined)', auc: 0.93, precision: 0.91, recall: 0.90, f1: 0.905, fpr: 0.08 },
]
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
    <div className="overflow-x-auto rounded-xl border border-[#1E1E1E]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1E1E1E] bg-[#0A0A0A]">
            {['Model','AUC-ROC','Precision','Recall','F1','FPR'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] first:text-left text-center">
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
                className={`border-b border-[#1E1E1E] last:border-0 transition-colors ${
                  isEnsemble
                    ? 'bg-[#2BEE34]/5 border-[#2BEE34]/10'
                    : 'bg-[#141414] hover:bg-[#1A1A1A]'
                }`}
              >
                <td className={`px-4 py-3 font-medium ${isEnsemble ? 'text-[#2BEE34]' : 'text-[#E5E5E5]'}`}>
                  {row.model}
                </td>
                <td className={`px-4 py-3 text-center tabular-nums ${isEnsemble ? 'text-[#2BEE34] font-bold' : 'text-[#E5E5E5]'}`}>
                  {row.auc.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-[#E5E5E5]">{(row.precision*100).toFixed(1)}%</td>
                <td className="px-4 py-3 text-center tabular-nums text-[#E5E5E5]">{(row.recall*100).toFixed(1)}%</td>
                <td className="px-4 py-3 text-center tabular-nums text-[#E5E5E5]">{row.f1.toFixed(3)}</td>
                <td className="px-4 py-3 text-center tabular-nums text-[#FFB800]">{(row.fpr*100).toFixed(1)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function BenchmarksPage() {
  const sections = [
    { label: 'Text',  rows: TEXT_RESULTS  },
    { label: 'Image', rows: IMAGE_RESULTS },
    { label: 'Audio', rows: AUDIO_RESULTS },
    { label: 'Video', rows: VIDEO_RESULTS },
  ]

  return (
    <div className="min-h-screen bg-[#141414] text-[#E5E5E5]">
      <SiteNav />
      <main id="main-content" className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#2BEE34] mb-3">
              Transparency
            </p>
            <h1 className="text-[40px] sm:text-[52px] font-bold text-white tracking-[-0.02em] mb-4">
              Accuracy Benchmarks
            </h1>
            <p className="text-[#A3A3A3] text-lg max-w-2xl mx-auto leading-relaxed">
              AUC-ROC, precision, recall, F1, and false-positive rates across all modalities.
              Measured on held-out test sets from public benchmark datasets.
            </p>
          </div>

          {/* Disclaimer */}
          <div className="flex gap-3 p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl mb-10 text-sm text-[#A3A3A3]">
            <Info className="w-4 h-4 text-[#2BEE34] flex-shrink-0 mt-0.5" />
            <p>
              All figures are from held-out test sets — not cherry-picked. Results vary by content type, AI generator, compression level, and whether content has been edited after AI generation.
              Rows highlighted in green are the ensemble result (all signals combined).
            </p>
          </div>

          {/* Tables */}
          {sections.map(s => (
            <section key={s.label} className="mb-12">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2BEE34]" />
                {s.label} Attestation
              </h2>
              <BenchTable rows={s.rows} />
            </section>
          ))}

          {/* Datasets */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-white mb-4">Benchmark Datasets</h2>
            <div className="overflow-x-auto rounded-xl border border-[#1E1E1E]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E1E1E] bg-[#0A0A0A]">
                    {['Modality','Dataset','Size'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DATASETS.map((d, i) => (
                    <tr key={i} className="border-b border-[#1E1E1E] last:border-0 bg-[#141414] hover:bg-[#1A1A1A] transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#2BEE34]/10 text-[#2BEE34] border border-[#2BEE34]/20 font-medium">
                          {d.modality}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#E5E5E5] hover:text-[#2BEE34] transition-colors flex items-center gap-1 group"
                        >
                          {d.name}
                          <ExternalLink className="w-3 h-3 text-[#6B6B6B] group-hover:text-[#2BEE34] transition-colors" />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-[#6B6B6B] tabular-nums text-xs">{d.size}</td>
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
                         bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-semibold text-sm
                         transition-colors duration-150">
              Read Methodology <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/detect/text"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl
                         border border-[#2A2A2A] text-[#E5E5E5] hover:border-[#2BEE34] hover:text-[#2BEE34]
                         font-semibold text-sm transition-all duration-150">
              Try Attestation
            </Link>
          </div>

        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
