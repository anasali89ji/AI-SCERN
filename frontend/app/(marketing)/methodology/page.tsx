import Link from 'next/link'
import { SiteFooter } from '@/components/site-footer'
import { CheckCircle2, AlertTriangle, BarChart3, Cpu, FlaskConical, ArrowRight } from 'lucide-react'
import { SiteNav } from '@/components/SiteNav'

export const metadata = {
  title: 'Detection Methodology | Aiscern',
  description: 'How Aiscern detects AI-generated content — models, signals, accuracy benchmarks, known limitations, and how to interpret confidence scores.',
  openGraph: { title: 'Detection Methodology | Aiscern', url: 'https://aiscern.com/methodology' },
}

const ACCURACY = [
  { type: 'Text',  score: 85, model: 'HuggingFace roberta-base-openai-detector + Gemini 2.0 Flash ensemble' },
  { type: 'Image', score: 82, model: 'EfficientNet-B4 fine-tuned on Midjourney/DALL-E/SD datasets'          },
  { type: 'Audio', score: 79, model: 'Wav2Vec2 + spectral fingerprint classifier'                           },
  { type: 'Video', score: 76, model: 'Frame-sampled image detection + temporal consistency analysis'         },
]

const SIGNALS_TEXT = [
  { name: 'Perplexity score',     desc: 'Measures how statistically predictable each word choice is. AI text scores low; human writing scores high.' },
  { name: 'Burstiness',           desc: 'Variation in sentence length and complexity. Human writing has high burstiness; AI tends toward uniformity.' },
  { name: 'Vocabulary diversity', desc: 'Ratio of unique words to total words. AI frequently reuses high-frequency vocabulary.' },
  { name: 'Structural patterns',  desc: 'AI text tends toward balanced paragraph lengths and consistent heading hierarchies uncommon in natural writing.' },
  { name: 'Model fingerprint',    desc: 'Specific token-choice patterns associated with known LLMs, detected via trained classifier.' },
]

const SIGNALS_IMAGE = [
  { name: 'Frequency artifacts',   desc: 'Fourier-domain analysis reveals the periodic artifacts left by diffusion model upsampling steps.' },
  { name: 'Facial geometry',       desc: 'Geometric consistency of landmarks — eye spacing, ear symmetry, catchlight positions.' },
  { name: 'Background coherence',  desc: 'Shadows, reflections, and perspective consistency between foreground subjects and background.' },
  { name: 'EXIF metadata',         desc: 'AI images lack camera EXIF data. Absence of shutter speed, ISO, and GPS is a strong signal.' },
  { name: 'Compression signature', desc: 'JPEG blocking artifacts appear in atypical locations in AI images vs. real photography.' },
]

const LIMITATIONS = [
  'Short text (under 150 words) has insufficient signal for reliable classification',
  'Non-native English speakers may trigger false positives due to constrained vocabulary patterns',
  'Heavily compressed images (< 50 KB) lose frequency artifacts detectors rely on',
  'AI content edited by humans after generation reduces detectability significantly',
  'Hybrid content (AI inpainting on real photos) is currently below 70% accuracy',
  'Very short audio clips (< 5 seconds) provide insufficient spectral data',
  'Novel AI generators released after our last model update may evade detection until the next fine-tune',
]

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-[#141414] text-[#E5E5E5]">
      <SiteNav />
      <main id="main-content" className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#2BEE34]/20 bg-[#2BEE34]/5 text-[#2BEE34] text-xs font-semibold mb-4">
              <FlaskConical className="w-3 h-3" /> Transparency
            </div>
            <h1 className="text-[40px] sm:text-[52px] font-bold text-white tracking-[-0.02em] mb-4">
              Detection Methodology
            </h1>
            <p className="text-[#A3A3A3] text-lg max-w-2xl mx-auto leading-relaxed">
              How Aiscern detects AI-generated content — the models, signals, accuracy benchmarks, and known limitations explained openly.
            </p>
          </div>

          {/* Accuracy benchmarks */}
          <section className="mb-12">
            <div className="flex items-center justify-between gap-2 mb-5 flex-wrap">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#2BEE34]" />
                <h2 className="text-xl font-semibold text-white">Accuracy Benchmarks</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full border border-[#2A2A2A] bg-[#1A1A1A] text-[#6B6B6B] font-mono">v4.0.0</span>
                <span className="text-xs px-2.5 py-1 rounded-full border border-[#2BEE34]/20 bg-[#2BEE34]/5 text-[#2BEE34] font-semibold">Last validated: April 2026</span>
              </div>
            </div>
            <p className="text-sm text-[#A3A3A3] leading-relaxed mb-6">
              All figures are measured on held-out test sets from publicly available benchmark datasets.
              These are conservative, honest numbers — not cherry-picked accuracy on easy samples.
            </p>
            <div className="space-y-3">
              {ACCURACY.map(m => (
                <div key={m.type} className="bg-[#141414] border border-[#1E1E1E] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-sm font-semibold text-white">{m.type} Detection</span>
                      <p className="text-xs text-[#6B6B6B] mt-0.5">{m.model}</p>
                    </div>
                    <span className="text-2xl font-black text-[#2BEE34]">{m.score}%</span>
                  </div>
                  <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2BEE34] rounded-full"
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#6B6B6B] mt-3 leading-relaxed">
              * Accuracy is the percentage of samples correctly classified on public benchmark datasets. Individual results may vary based on content type, compression, and AI generator used.
            </p>
          </section>

          {/* Ensemble pipeline */}
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <Cpu className="w-5 h-5 text-[#2BEE34]" />
              <h2 className="text-xl font-semibold text-white">Ensemble Pipeline</h2>
            </div>
            <div className="bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl p-6 mb-4">
              <p className="text-sm text-[#A3A3A3] leading-relaxed">
                Aiscern runs every scan through multiple independent detection signals. Rather than relying on a single model,
                results are combined using a weighted voting mechanism — models with higher validated accuracy on that modality
                receive more weight in the final verdict. This ensemble approach reduces false positives and improves robustness
                against adversarial inputs.
              </p>
            </div>

            {/* Text signals */}
            <h3 className="text-sm font-semibold text-white mb-3">Text Detection Signals</h3>
            <div className="space-y-2 mb-6">
              {SIGNALS_TEXT.map(s => (
                <div key={s.name} className="flex gap-3 p-4 bg-[#141414] border border-[#1E1E1E] rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-[#2BEE34] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-white">{s.name}</span>
                    <p className="text-xs text-[#A3A3A3] mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Image signals */}
            <h3 className="text-sm font-semibold text-white mb-3">Image Detection Signals</h3>
            <div className="space-y-2">
              {SIGNALS_IMAGE.map(s => (
                <div key={s.name} className="flex gap-3 p-4 bg-[#141414] border border-[#1E1E1E] rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-[#2BEE34] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-white">{s.name}</span>
                    <p className="text-xs text-[#A3A3A3] mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Confidence scores */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-5">How to Interpret Confidence Scores</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { range: '0 – 39%',  label: 'Likely Human',    color: 'text-[#2BEE34]', border: 'border-[#2BEE34]/20', bg: 'bg-[#2BEE34]/5',  desc: 'Strong signals of human authorship. Low probability of AI generation.' },
                { range: '40 – 69%', label: 'Uncertain',       color: 'text-[#FFB800]', border: 'border-[#FFB800]/20', bg: 'bg-[#FFB800]/5',  desc: 'Mixed signals. Use additional context and human judgment before acting.' },
                { range: '70 – 100%',label: 'Likely AI',       color: 'text-[#FF4444]', border: 'border-[#FF4444]/20', bg: 'bg-[#FF4444]/5',  desc: 'Strong signals of AI generation. High-confidence ensemble verdict.' },
              ].map(c => (
                <div key={c.range} className={`rounded-xl border ${c.border} ${c.bg} p-5`}>
                  <div className={`text-lg font-black ${c.color} mb-1`}>{c.range}</div>
                  <div className="text-sm font-semibold text-white mb-2">{c.label}</div>
                  <p className="text-xs text-[#A3A3A3] leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Known limitations */}
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <AlertTriangle className="w-5 h-5 text-[#FFB800]" />
              <h2 className="text-xl font-semibold text-white">Known Limitations</h2>
            </div>
            <div className="bg-[#FFB800]/5 border border-[#FFB800]/20 rounded-xl p-5 mb-4">
              <p className="text-sm text-[#A3A3A3] leading-relaxed">
                AI detection is a probabilistic task. We publish our limitations openly so you can make informed decisions about when to trust — and when to double-check — these results.
              </p>
            </div>
            <div className="space-y-2">
              {LIMITATIONS.map((l, i) => (
                <div key={i} className="flex gap-3 p-4 bg-[#141414] border border-[#1E1E1E] rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-[#FFB800] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#A3A3A3] leading-relaxed">{l}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Links */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/benchmarks"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl
                         bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-semibold text-sm
                         transition-colors duration-150">
              View Full Benchmarks <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/detect/text"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl
                         border border-[#2A2A2A] text-[#E5E5E5] hover:border-[#2BEE34] hover:text-[#2BEE34]
                         font-semibold text-sm transition-all duration-150">
              Try the Detector
            </Link>
          </div>

        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
