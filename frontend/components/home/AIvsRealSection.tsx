'use client'
/**
 * AIvsRealSection — static comparison grid
 * Static flex-wrap layout, next/image with responsive sizes,
 * no marquee animation, no duplicate DOM nodes.
 */
import Image from 'next/image'
import { memo } from 'react'
import { motion } from 'framer-motion'
import { Scan, AlertTriangle, CheckCircle } from 'lucide-react'

interface ComparisonCard {
  type: 'text' | 'image'
  label: string
  verdict: 'AI' | 'HUMAN'
  preview?: string
  img?: string
  tag: string
}

const CARDS: ComparisonCard[] = [
  { type: 'text',  label: 'AI-Generated Text',      verdict: 'AI',    preview: 'The implementation of advanced machine learning algorithms has fundamentally transformed the paradigm of data processing and cognitive frameworks…', tag: 'GPT-4' },
  { type: 'text',  label: 'Human Writing',           verdict: 'HUMAN', preview: "I burned my toast again this morning. Third time this week. My smoke alarm and I have a complicated relationship at this point.", tag: 'Authentic' },
  { type: 'image', label: 'AI-Generated Portrait',   verdict: 'AI',    img: '/compare/ai-portrait-01.webp',    tag: 'Midjourney' },
  { type: 'image', label: 'Authentic Photo',         verdict: 'HUMAN', img: '/compare/real-portrait-01.webp',  tag: 'Authentic' },
  { type: 'image', label: 'DALL-E 3 Landscape',      verdict: 'AI',    img: '/compare/ai-city-01.webp',        tag: 'DALL-E 3' },
  { type: 'image', label: 'Real Landscape',          verdict: 'HUMAN', img: '/compare/real-mountain-01.webp',  tag: 'Authentic' },
  { type: 'image', label: 'Stable Diffusion Art',    verdict: 'AI',    img: '/compare/ai-abstract-01.webp',    tag: 'SD XL' },
  { type: 'image', label: 'Real Urban Photo',        verdict: 'HUMAN', img: '/compare/real-street-01.webp',    tag: 'Authentic' },
  { type: 'text',  label: 'AI Essay',                verdict: 'AI',    preview: 'Furthermore, the multifaceted implications of this technological advancement necessitate a comprehensive reevaluation of existing frameworks and paradigms…', tag: 'Claude 3' },
  { type: 'text',  label: 'Student Writing',         verdict: 'HUMAN', preview: "ok so i know this essay is due tomorrow but i literally just figured out what my thesis even means. starting over at midnight feels bad", tag: 'Authentic' },
]

const Card = memo(function Card({ card }: { card: ComparisonCard }) {
  const isAI = card.verdict === 'AI'
  const accentBorder = isAI ? 'border-rose-500/20' : 'border-emerald-500/20'
  const accentBg    = isAI ? 'bg-rose-500/10'    : 'bg-emerald-500/10'
  const accentText  = isAI ? 'text-rose-400'     : 'text-emerald-400'

  return (
    <div className={`rounded-xl border ${accentBorder} bg-[#0f0f17] overflow-hidden`} style={{ contain: 'layout style paint' }}>
      {card.type === 'image' && card.img ? (
        <div className="relative h-32 sm:h-40 overflow-hidden bg-[#141420]">
          <Image
            src={card.img}
            alt={card.label}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
            className="object-cover"
            loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${isAI ? 'bg-rose-500/90' : 'bg-emerald-600/90'}`}>
            {isAI ? <AlertTriangle className="w-2.5 h-2.5" /> : <CheckCircle className="w-2.5 h-2.5" />}
            {card.verdict}
          </div>
        </div>
      ) : (
        <div className={`h-32 sm:h-40 p-4 bg-[#141420] flex flex-col justify-center border-l-2 ${isAI ? 'border-rose-500/50' : 'border-emerald-500/50'}`}>
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-4 italic">
            &ldquo;{card.preview}&rdquo;
          </p>
          <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold self-start ${accentBg} ${accentText}`}>
            {isAI ? <AlertTriangle className="w-2.5 h-2.5" /> : <CheckCircle className="w-2.5 h-2.5" />}
            {card.verdict}
          </div>
        </div>
      )}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-100 truncate">{card.label}</p>
          <span className={`text-[10px] font-medium ${accentText}`}>{card.tag}</span>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${accentBg} ${accentText} border ${accentBorder}`}>
          {isAI ? '⚠ AI' : '✓ Real'}
        </span>
      </div>
    </div>
  )
})

export default function AIvsRealSection() {
  return (
    <section className="py-16 sm:py-24 border-t border-white/[0.06] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-500/30 bg-rose-500/5 text-rose-400 text-xs font-semibold mb-4">
            <Scan className="w-3.5 h-3.5" aria-hidden />
            Real-World Detection Examples
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight mb-3">
            AI vs Authentic Content
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            See how Aiscern tells AI-generated content apart from authentic human work — across text and images.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {CARDS.map((card, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}>
              <Card card={card} />
            </motion.div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Illustrative examples — not real detection results. Try the live detector above.
        </p>
      </div>
    </section>
  )
}
