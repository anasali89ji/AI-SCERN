'use client'
import { Check, X, Minus } from 'lucide-react'
import { motion } from 'framer-motion'

const FEATURES = [
  { name: 'Text AI Detection',           detectai: true,  gptzero: true,  turnitin: true,        originality: true  },
  { name: 'Image Deepfake Detection',     detectai: true,  gptzero: false, turnitin: false,       originality: false },
  { name: 'Audio AI Detection',           detectai: true,  gptzero: false, turnitin: false,       originality: false },
  { name: 'Video Deepfake Detection',     detectai: true,  gptzero: false, turnitin: false,       originality: false },
  { name: 'Multi-modal Batch Analysis',   detectai: true,  gptzero: false, turnitin: 'partial',   originality: false },
  { name: 'Sentence-Level Heatmap',       detectai: true,  gptzero: true,  turnitin: false,       originality: true  },
  { name: 'API Access',                   detectai: true,  gptzero: true,  turnitin: true,        originality: true  },
  { name: 'Free Tier Available',          detectai: true,  gptzero: true,  turnitin: false,       originality: false },
  { name: 'Starting Price',               detectai: '$9.99/mo', gptzero: '$10/mo', turnitin: '$30/mo', originality: '$14.95/mo' },
  { name: 'Text Detection Accuracy',      detectai: '94%', gptzero: '98%', turnitin: '85%',       originality: '99%' },
  { name: 'Real-time Detection',          detectai: true,  gptzero: true,  turnitin: false,       originality: true  },
  { name: 'URL Scanner',                  detectai: true,  gptzero: false, turnitin: false,       originality: true  },
  { name: 'PDF Export',                   detectai: true,  gptzero: true,  turnitin: true,        originality: true  },
]

function Cell({ v, isDetectai }: { v: boolean | string; isDetectai?: boolean }) {
  if (typeof v === 'string') return (
    <span className={`text-sm font-semibold ${isDetectai ? 'text-primary' : 'text-text-secondary'}`}>{v}</span>
  )
  if (v === true)  return <Check className={`w-5 h-5 mx-auto ${isDetectai ? 'text-primary' : 'text-green-400'}`} />
  if (v === false) return <X className="w-4 h-4 mx-auto text-text-muted/30" />
  return <Minus className="w-4 h-4 mx-auto text-amber-400" />
}

const COLS = [
  { key: 'detectai',    label: 'DetectAI',     highlight: true  },
  { key: 'gptzero',     label: 'GPTZero',      highlight: false },
  { key: 'turnitin',    label: 'Turnitin',     highlight: false },
  { key: 'originality', label: 'Originality',  highlight: false },
]

export default function ComparisonTable() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center space-y-3">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-widest">
            Competitive Edge
          </div>
          <h2 className="text-3xl md:text-4xl font-black">
            The <span className="gradient-text">Only Platform</span> That Detects All 4 Media Types
          </h2>
          <p className="text-text-muted max-w-xl mx-auto">
            While others focus on text alone, DetectAI covers text, images, audio, and video — all in one platform.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-text-muted text-sm font-medium w-52">Feature</th>
                {COLS.map(col => (
                  <th key={col.key} className={`p-4 text-center ${col.highlight ? 'bg-primary/10 border-x border-primary/20' : ''}`}>
                    <span className={`text-sm font-bold ${col.highlight ? 'text-primary' : 'text-text-secondary'}`}>
                      {col.label}
                    </span>
                    {col.highlight && (
                      <div className="text-xs text-primary/60 font-normal mt-0.5">✦ Our pick</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((row, i) => (
                <tr key={row.name} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-surface/30' : ''}`}>
                  <td className="p-4 text-sm text-text-secondary">{row.name}</td>
                  {COLS.map(col => (
                    <td key={col.key} className={`p-4 text-center ${col.highlight ? 'bg-primary/5 border-x border-primary/10' : ''}`}>
                      <Cell v={(row as any)[col.key]} isDetectai={col.highlight} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <p className="text-center text-xs text-text-muted">
          * Comparison based on publicly available pricing and features as of 2026. Partial = limited functionality.
        </p>
      </div>
    </section>
  )
}
