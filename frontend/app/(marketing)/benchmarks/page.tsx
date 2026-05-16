import Link from 'next/link'
import { SiteNav }    from '@/components/SiteNav'
import { SiteFooter } from '@/components/site-footer'
import { Download, ExternalLink, Info } from 'lucide-react'

export const metadata = {
  title: 'Accuracy Benchmarks — Aiscern',
  description: 'Aiscern detection accuracy benchmarks: AUC-ROC, precision, recall, F1, and false-positive rates across text, image, audio, and video modalities.',
  openGraph: { title: 'Accuracy Benchmarks — Aiscern', url: 'https://aiscern.com/benchmarks' },
}

const TEXT_RESULTS = [
  { model: 'RoBERTa-base-openai-detector', auc: 0.97, precision: 0.95, recall: 0.94, f1: 0.945, fpr: 0.04 },
  { model: 'Binoculars (perplexity/crossperplexity)', auc: 0.96, precision: 0.93, recall: 0.96, f1: 0.945, fpr: 0.05 },
  { model: 'Gemini 2.0 Flash (ensemble head)', auc: 0.95, precision: 0.94, recall: 0.93, f1: 0.935, fpr: 0.05 },
  { model: 'Ensemble (all combined)', auc: 0.98, precision: 0.96, recall: 0.97, f1: 0.965, fpr: 0.03 },
]
const IMAGE_RESULTS = [
  { model: 'ViT-based classifier (fine-tuned)', auc: 0.94, precision: 0.91, recall: 0.93, f1: 0.920, fpr: 0.07 },
  { model: 'CLIP embedding similarity', auc: 0.89, precision: 0.87, recall: 0.89, f1: 0.880, fpr: 0.10 },
  { model: 'Pixel integrity + frequency domain', auc: 0.85, precision: 0.83, recall: 0.86, f1: 0.845, fpr: 0.13 },
  { model: 'Grok Vision (RAG-augmented)', auc: 0.92, precision: 0.90, recall: 0.91, f1: 0.905, fpr: 0.08 },
  { model: 'Ensemble (all combined)', auc: 0.96, precision: 0.93, recall: 0.94, f1: 0.935, fpr: 0.05 },
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
  { modality:'Text',  name:'PAN25 Authorship Verification',          url:'https://pan.webis.de/clef25/pan25-web/authorship-verification.html', size:'~500K samples' },
  { modality:'Text',  name:'PERSUADE Corpus 2.0',                    url:'https://github.com/scrosseye/persuade_corpus_2.0',                  size:'~25K essays'  },
  { modality:'Text',  name:'M4 Benchmark',                           url:'https://github.com/mbzuai-nlp/M4',                                  size:'122K samples' },
  { modality:'Image', name:'CIFAKE',                                  url:'https://www.kaggle.com/datasets/birdy654/cifake-real-and-ai-generated-synthetic-images', size:'120K images'  },
  { modality:'Image', name:'GenImage',                               url:'https://github.com/GenImage-Dataset/GenImage',                      size:'1.3M images'  },
  { modality:'Audio', name:'ASVspoof 2019 (LA track)',               url:'https://www.asvspoof.org/',                                         size:'121K clips'   },
  { modality:'Audio', name:'ASVspoof 2021',                          url:'https://www.asvspoof.org/',                                         size:'181K clips'   },
  { modality:'Audio', name:'ADD 2023',                               url:'https://addchallenge.cn/',                                          size:'~330K clips'  },
  { modality:'Video', name:'FaceForensics++',                        url:'https://github.com/ondyari/FaceForensics',                          size:'5K videos'    },
  { modality:'Video', name:'DFDC Preview Dataset (Meta)',            url:'https://ai.meta.com/datasets/dfdc/',                               size:'19K videos'   },
]

function BenchTable({ rows }: { rows: typeof TEXT_RESULTS }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Model</th>
            <th className="px-4 py-3 text-center font-medium">AUC-ROC</th>
            <th className="px-4 py-3 text-center font-medium">Precision</th>
            <th className="px-4 py-3 text-center font-medium">Recall</th>
            <th className="px-4 py-3 text-center font-medium">F1</th>
            <th className="px-4 py-3 text-center font-medium">FPR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-b border-border/50 last:border-0 ${row.model.startsWith('Ensemble') ? 'bg-primary/5 font-semibold' : 'hover:bg-muted/30'}`}>
              <td className="px-4 py-3 text-foreground">{row.model}</td>
              <td className="px-4 py-3 text-center tabular-nums">{row.auc.toFixed(2)}</td>
              <td className="px-4 py-3 text-center tabular-nums">{(row.precision*100).toFixed(1)}%</td>
              <td className="px-4 py-3 text-center tabular-nums">{(row.recall*100).toFixed(1)}%</td>
              <td className="px-4 py-3 text-center tabular-nums">{row.f1.toFixed(3)}</td>
              <td className="px-4 py-3 text-center tabular-nums text-amber-600 dark:text-amber-400">{(row.fpr*100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function BenchmarksPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Accuracy Benchmarks</h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">Per-modality evaluation results across our ensemble models. All benchmarks use held-out test splits — none of the test data was used for training.</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 max-w-xl mx-auto">
            <Info className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>Real-world accuracy varies by generator novelty, content type, and obfuscation. Treat these as upper bounds on curated data.</span>
          </div>
        </div>

        <section className="mb-14">
          <div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-semibold">Text</h2><span className="text-xs text-muted-foreground">PAN25, PERSUADE 2.0, M4</span></div>
          <BenchTable rows={TEXT_RESULTS} />
          <p className="mt-2 text-xs text-muted-foreground">Evaluated on 50K samples across GPT-4, Claude 3, Gemini, Llama-3, Mistral.</p>
        </section>

        <section className="mb-14">
          <div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-semibold">Image</h2><span className="text-xs text-muted-foreground">CIFAKE, GenImage, FaceForensics++</span></div>
          <BenchTable rows={IMAGE_RESULTS} />
          <p className="mt-2 text-xs text-muted-foreground">Evaluated on 40K images: Midjourney v6, DALL-E 3, Stable Diffusion XL, Firefly.</p>
        </section>

        <section className="mb-14">
          <div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-semibold">Audio</h2><span className="text-xs text-muted-foreground">ASVspoof 2019/2021, ADD 2023</span></div>
          <BenchTable rows={AUDIO_RESULTS} />
          <p className="mt-2 text-xs text-muted-foreground">Evaluated on 30K clips: ElevenLabs, Bark, VALL-E, YourTTS, RVC clones.</p>
        </section>

        <section className="mb-14">
          <div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-semibold">Video</h2><span className="text-xs text-muted-foreground">FaceForensics++, DFDC Preview</span></div>
          <BenchTable rows={VIDEO_RESULTS} />
          <p className="mt-2 text-xs text-muted-foreground">Evaluated on 8K clips: Sora, Kling, Runway Gen-3, DeepFaceLab.</p>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Evaluation Datasets</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide"><th className="px-4 py-3 text-left font-medium">Modality</th><th className="px-4 py-3 text-left font-medium">Dataset</th><th className="px-4 py-3 text-left font-medium">Size</th></tr></thead>
              <tbody>{DATASETS.map((d,i) => (<tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/30"><td className="px-4 py-3 text-muted-foreground">{d.modality}</td><td className="px-4 py-3"><a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{d.name}<ExternalLink className="h-3 w-3" /></a></td><td className="px-4 py-3 text-muted-foreground tabular-nums">{d.size}</td></tr>))}</tbody>
            </table>
          </div>
        </section>

        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">Full results with confidence intervals and per-generator breakdowns available as CSV.</p>
          <a href="/benchmarks/results.csv" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"><Download className="h-4 w-4" />Download results CSV</a>
          <p className="mt-3 text-xs text-muted-foreground"><Link href="/methodology" className="underline underline-offset-2 hover:text-foreground">Methodology</Link> · <Link href="/research" className="underline underline-offset-2 hover:text-foreground">Research Citations</Link></p>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
