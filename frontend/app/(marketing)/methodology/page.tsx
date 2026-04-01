import Link from 'next/link'
import { SiteFooter } from '@/components/site-footer'
import { CheckCircle2, AlertTriangle, BarChart3, Cpu, FlaskConical } from 'lucide-react'

export const metadata = {
  title: 'Detection Methodology | Aiscern',
  description: 'How Aiscern detects AI-generated content — models, signals, accuracy benchmarks, known limitations, and how to interpret confidence scores.',
  openGraph: { title: 'Detection Methodology | Aiscern', url: 'https://aiscern.com/methodology' },
}

const ACCURACY = [
  { type: 'Text',  score: 85, model: 'HuggingFace roberta-base-openai-detector + Gemini 2.0 Flash ensemble', color: 'bg-violet-500' },
  { type: 'Image', score: 82, model: 'EfficientNet-B4 fine-tuned on Midjourney/DALL-E/SD datasets',          color: 'bg-blue-500'   },
  { type: 'Audio', score: 79, model: 'Wav2Vec2 + spectral fingerprint classifier',                          color: 'bg-emerald-500' },
  { type: 'Video', score: 76, model: 'Frame-sampled image detection + temporal consistency analysis',        color: 'bg-orange-500'  },
]

const SIGNALS_TEXT = [
  { name: 'Perplexity score',    desc: 'Measures how statistically predictable each word choice is. AI text scores low; human writing scores high.' },
  { name: 'Burstiness',          desc: 'Variation in sentence length and complexity. Human writing has high burstiness; AI tends toward uniformity.' },
  { name: 'Vocabulary diversity',desc: 'Ratio of unique words to total words. AI frequently reuses high-frequency vocabulary.' },
  { name: 'Structural patterns', desc: 'AI text tends toward balanced paragraph lengths and consistent heading hierarchies uncommon in natural writing.' },
  { name: 'Model fingerprint',   desc: 'Specific token-choice patterns associated with known LLMs, detected via trained classifier.' },
]

const SIGNALS_IMAGE = [
  { name: 'Frequency artifacts',     desc: 'Fourier-domain analysis reveals the periodic artifacts left by diffusion model upsampling steps.' },
  { name: 'Facial geometry',         desc: 'Geometric consistency of landmarks — eye spacing, ear symmetry, catchlight positions.' },
  { name: 'Background coherence',    desc: 'Shadows, reflections, and perspective consistency between foreground subjects and background.' },
  { name: 'EXIF metadata',           desc: 'AI images lack camera EXIF data. Absence of shutter speed, ISO, and GPS is a strong signal.' },
  { name: 'Compression signature',   desc: 'JPEG blocking artifacts appear in atypical locations in AI images vs. real photography.' },
]

const LIMITATIONS = [
  'Short text (under 150 words) has insufficient signal for reliable classification',
  'Non-native English speakers may trigger false positives due to constrained vocabulary patterns',
  'Heavily compressed images (< 50KB) lose frequency artifacts detectors rely on',
  'AI content edited by humans after generation reduces detectability significantly',
  'Hybrid content (AI inpainting on real photos) is currently below 70% accuracy',
  'Very short audio clips (< 5 seconds) provide insufficient spectral data',
  'Novel AI generators released after our last model update may evade detection until the next fine-tune',
]

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto h-full px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Aiscern" className="w-8 h-6 object-contain" />
            <span className="font-black text-lg gradient-text">Aiscern</span>
          </Link>
          <Link href="/" className="text-sm text-text-muted hover:text-text-primary transition-colors">← Home</Link>
        </div>
      </nav>

      <main className="pt-24 pb-20 max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-4">
            <FlaskConical className="w-3 h-3" /> Transparency
          </div>
          <h1 className="text-3xl sm:text-5xl font-black mb-4">
            Detection <span className="gradient-text">Methodology</span>
          </h1>
          <p className="text-text-muted text-base sm:text-lg max-w-2xl mx-auto">
            How Aiscern detects AI-generated content — the models, signals, accuracy benchmarks, and known limitations explained openly.
          </p>
        </div>

        {/* Accuracy benchmarks */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-black">Accuracy Benchmarks</h2>
          </div>
          <p className="text-text-muted text-sm mb-6 leading-relaxed">
            Benchmarks measured on held-out test sets not used during training. Figures represent overall accuracy (true positive rate + true negative rate averaged). Test sets include content from all major AI generators available at the time of evaluation.
          </p>
          <div className="space-y-4">
            {ACCURACY.map(({ type, score, model, color }) => (
              <div key={type} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-text-primary">{type} Detection</span>
                    <p className="text-xs text-text-muted mt-0.5">{model}</p>
                  </div>
                  <span className="text-2xl font-black text-text-primary">~{score}%</span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-disabled mt-4">
            * Accuracy varies by content type, generator, and compression level. See Limitations section below.
          </p>
        </section>

        {/* How it works — ensemble */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <Cpu className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-black">Ensemble Approach</h2>
          </div>
          <p className="text-text-muted text-sm leading-relaxed mb-6">
            No single signal reliably distinguishes AI content from human content across all edge cases. Aiscern combines multiple independent signals through a trained ensemble model. Each signal is weighted based on its empirically measured reliability for the specific content type, then combined into a single confidence score.
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-400" /> Text Signals
              </h3>
              <div className="space-y-3">
                {SIGNALS_TEXT.map(s => (
                  <div key={s.name}>
                    <p className="text-xs font-semibold text-text-primary mb-0.5">{s.name}</p>
                    <p className="text-xs text-text-muted leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" /> Image Signals
              </h3>
              <div className="space-y-3">
                {SIGNALS_IMAGE.map(s => (
                  <div key={s.name}>
                    <p className="text-xs font-semibold text-text-primary mb-0.5">{s.name}</p>
                    <p className="text-xs text-text-muted leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Confidence score interpretation */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-black">Interpreting Confidence Scores</h2>
          </div>
          <div className="space-y-3">
            {[
              { range: '90–100%', label: 'Very High — AI',    color: 'border-red-500/40 bg-red-500/5',    desc: 'Strong ensemble agreement. Multiple independent signals all point to AI generation.' },
              { range: '70–89%',  label: 'High — Likely AI', color: 'border-orange-500/40 bg-orange-500/5', desc: 'Most signals indicate AI. Some ambiguity — review flagged signals before acting.' },
              { range: '45–69%',  label: 'Uncertain',         color: 'border-yellow-500/40 bg-yellow-500/5', desc: 'Signals are mixed. Do not use this result as evidence of AI use without additional review.' },
              { range: '20–44%',  label: 'Likely Human',      color: 'border-blue-500/40 bg-blue-500/5',  desc: 'Most signals point to human authorship. Low probability of AI generation.' },
              { range: '0–19%',   label: 'Very High — Human', color: 'border-emerald-500/40 bg-emerald-500/5', desc: 'Strong ensemble agreement on human origin. Multiple signals confirm natural content.' },
            ].map(({ range, label, color, desc }) => (
              <div key={range} className={`rounded-xl border ${color} p-4 flex gap-4`}>
                <div className="w-20 shrink-0">
                  <p className="text-xs font-mono font-bold text-text-primary">{range}</p>
                  <p className="text-xs font-semibold text-text-muted mt-0.5">{label}</p>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Limitations */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-black">Known Limitations</h2>
          </div>
          <p className="text-text-muted text-sm leading-relaxed mb-5">
            We publish these limitations openly because we believe responsible use of AI detection requires honest understanding of what it cannot do.
            <strong className="text-text-primary"> Never use a single detection result as sole evidence for high-stakes decisions.</strong>
          </p>
          <ul className="space-y-2">
            {LIMITATIONS.map(l => (
              <li key={l} className="flex items-start gap-3 text-sm text-text-muted">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                {l}
              </li>
            ))}
          </ul>
        </section>

        {/* Model update cadence */}
        <section className="rounded-2xl border border-border bg-surface p-6 mb-10">
          <h2 className="font-black text-lg mb-3">Model Update Cadence</h2>
          <p className="text-text-muted text-sm leading-relaxed">
            Detection models are retrained quarterly or whenever a major new AI generator reaches significant market penetration. Model versions are tracked in our changelog. The accuracy figures on this page reflect the most recent production model. Fine-tuning data is sourced from public benchmarks, synthetic test sets, and anonymized user feedback (opt-in only).
          </p>
        </section>

        {/* CTA */}
        <div className="text-center">
          <Link href="/detect/text"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors">
            Try Detection Free →
          </Link>
          <p className="text-xs text-text-disabled mt-3">No account required. All modalities free forever.</p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
