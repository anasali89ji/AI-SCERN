'use client'
import { Check, X, Minus } from 'lucide-react'
import { motion } from 'framer-motion'

const FEATURES = [
  { name: 'Text AI Detection',           aiscern: true,  gptzero: true,  turnitin: true,        originality: true  },
  { name: 'Image Deepfake Detection',     aiscern: true,  gptzero: false, turnitin: false,       originality: false },
  { name: 'Audio AI Detection',           aiscern: true,  gptzero: false, turnitin: false,       originality: false },
  { name: 'Video Deepfake Detection',     aiscern: true,  gptzero: false, turnitin: false,       originality: false },
  { name: 'Multi-modal Batch Analysis',   aiscern: true,  gptzero: false, turnitin: 'partial',   originality: false },
  { name: 'Sentence-Level Heatmap',       aiscern: true,  gptzero: true,  turnitin: false,       originality: true  },
  { name: 'API Access',                   aiscern: true,  gptzero: true,  turnitin: true,        originality: true  },
  { name: 'Free Tier Available',          aiscern: true,  gptzero: true,  turnitin: false,       originality: false },
  { name: 'Starting Price',               aiscern: 'Free', gptzero: '$10/mo', turnitin: '$30/mo', originality: '$14.95/mo' },
  { name: 'Text Detection Accuracy',      aiscern: '85%+', gptzero: '98%', turnitin: '85%',      originality: '99%' },
  { name: 'Real-time Detection',          aiscern: true,  gptzero: true,  turnitin: false,       originality: true  },
  { name: 'URL Scanner',                  aiscern: true,  gptzero: false, turnitin: false,       originality: true  },
  { name: 'PDF Export',                   aiscern: true,  gptzero: true,  turnitin: true,        originality: true  },
]

function Cell({ v, isDetectai }: { v: boolean | string; isDetectai?: boolean }) {
  if (typeof v === 'string') return (
    <span className={`text-sm font-semibold ${isDetectai ? 'text-blue-400' : 'text-slate-400'}`}>{v}</span>
  )
  if (v === true)  return <Check className={`w-5 h-5 mx-auto ${isDetectai ? 'text-blue-400' : 'text-green-400'}`} />
  if (v === false) return <X className="w-4 h-4 mx-auto text-slate-500/30" />
  return <Minus className="w-4 h-4 mx-auto text-amber-400" />
}

const COLS = [
  { key: 'aiscern',     label: 'Aiscern',      highlight: true  },
  { key: 'gptzero',     label: 'GPTZero',      highlight: false },
  { key: 'turnitin',    label: 'Turnitin',     highlight: false },
  { key: 'originality', label: 'Originality',  highlight: false },
]

export default function ComparisonTable() {
  return (
    <section className="py-20 px-4 sm:px-6 2xl:px-10">
      <div className="max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto space-y-8">
        <div className="overflow-x-auto">
          <div className="inline-block px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-widest">
            Competitive Edge
          </div>
          <h2 className="text-3xl md:text-4xl font-black">
            The <span className="gradient-text">Only Platform</span> That Detects All 4 Media Types
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            While others focus on text alone, Aiscern covers text, images, audio, and video — all in one platform.
          </p>
        </div>

        <div className="min-w-[640px] w-full">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left p-4 text-slate-500 text-sm font-medium w-52">Feature</th>
                {COLS.map(col => (
                  <th key={col.key} className={`p-4 text-center ${col.highlight ? 'bg-blue-500/10 border-x border-blue-500/20' : ''}`}>
                    <span className={`text-sm font-bold ${col.highlight ? 'text-blue-400' : 'text-slate-400'}`}>
                      {col.label}
                    </span>
                    {col.highlight && (
                      <div className="text-xs text-blue-500/60 font-normal mt-0.5">✦ Our pick</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((row, i) => (
                <tr key={row.name} className={`border-b border-white/[0.08] ${i % 2 === 0 ? 'bg-surface/30' : ''}`}>
                  <td className="p-4 text-sm text-slate-400">{row.name}</td>
                  {COLS.map(col => (
                    <td key={col.key} className={`p-4 text-center ${col.highlight ? 'bg-blue-500/5 border-x border-blue-500/10' : ''}`}>
                      <Cell v={(row as any)[col.key]} isDetectai={col.highlight} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-slate-500">
          * Comparison based on publicly available pricing and features as of 2026. Partial = limited functionality.
        </p>
      </div>
    </section>
  )
}
