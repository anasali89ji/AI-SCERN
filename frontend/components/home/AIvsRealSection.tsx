'use client'
import { memo } from 'react'
import { motion } from 'framer-motion'
import { Scan, AlertTriangle, CheckCircle, Brain } from 'lucide-react'
import Image from 'next/image'

interface ComparisonCard {
  type: 'text' | 'image'
  label: string
  verdict: 'AI' | 'HUMAN'
  preview?: string
  img?: string
  tag: string
  confidence: number
}

const CARDS: ComparisonCard[] = [
  { type:'text',  label:'AI Essay',              verdict:'AI',    confidence:94, tag:'GPT-4',      preview:'The implementation of advanced machine learning algorithms has fundamentally transformed the paradigm of data processing and cognitive frameworks across all domains…' },
  { type:'text',  label:'Human Writing',         verdict:'HUMAN', confidence:91, tag:'Authentic',  preview:"I burned my toast again. Third time this week. My smoke alarm and I have a complicated relationship at this point — it screams, I wave a dish towel." },
  { type:'image', label:'AI Portrait',           verdict:'AI',    confidence:88, tag:'Midjourney', img:'/compare/ai-portrait-01.webp' },
  { type:'image', label:'Real Photo',            verdict:'HUMAN', confidence:86, tag:'Authentic',  img:'/compare/real-portrait-01.webp' },
  { type:'image', label:'DALL-E 3 Scene',        verdict:'AI',    confidence:92, tag:'DALL-E 3',   img:'/compare/ai-city-01.webp' },
  { type:'image', label:'Real Landscape',        verdict:'HUMAN', confidence:89, tag:'Authentic',  img:'/compare/real-mountain-01.webp' },
  { type:'text',  label:'AI-Polished CV',        verdict:'AI',    confidence:81, tag:'Claude 3',   preview:'Furthermore, my multifaceted skill set enables me to leverage synergistic outcomes across cross-functional teams, driving impactful paradigm shifts in organizational excellence…' },
  { type:'text',  label:'Student Essay',         verdict:'HUMAN', confidence:84, tag:'Authentic',  preview:"ok so i know this is due tomorrow but i literally just figured out what my thesis even means. starting over at midnight felt bad but it's actually going somewhere now" },
  { type:'image', label:'SD XL Art',             verdict:'AI',    confidence:90, tag:'SD XL',      img:'/compare/ai-abstract-01.webp' },
  { type:'image', label:'Real Urban Photo',      verdict:'HUMAN', confidence:87, tag:'Authentic',  img:'/compare/real-street-01.webp' },
]

const Card = memo(function Card({ card, idx }: { card: ComparisonCard; idx: number }) {
  const isAI = card.verdict === 'AI'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ delay: idx * 0.045, duration: 0.45, ease: [0.22,1,0.36,1] }}
      className={`rounded-[12px] border overflow-hidden bg-[#0f0f17]
        ${isAI ? 'border-rose-500/20' : 'border-emerald-500/20'}
        hover:border-white/[0.14] transition-colors duration-200`}
    >
      {/* Preview area */}
      {card.type === 'image' && card.img ? (
        <div className="relative h-32 sm:h-36 bg-[#141420] overflow-hidden">
          <Image
            src={card.img} alt={card.label} fill
            sizes="(max-width:640px) 45vw,(max-width:1024px) 30vw,20vw"
            className="object-cover" loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }}
          />
          {/* Verdict chip on image */}
          <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full
            text-[10px] font-bold text-white backdrop-blur-sm
            ${isAI ? 'bg-rose-500-500/85' : 'bg-emerald-500-600/85'}`}>
            {isAI ? <AlertTriangle className="w-2.5 h-2.5"/> : <CheckCircle className="w-2.5 h-2.5"/>}
            {card.verdict}
          </div>
        </div>
      ) : (
        <div className={`h-32 sm:h-36 p-4 bg-[#0b0b14] flex flex-col justify-between
          border-l-2 ${isAI ? 'border-rose-500/50' : 'border-emerald-500/50'}`}>
          <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-4 italic">
            &ldquo;{card.preview}&rdquo;
          </p>
          <span className={`self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-2
            ${isAI ? 'bg-rose-500-500/10 text-rose-400-400' : 'bg-emerald-500-500/10 text-emerald-400-400'}`}>
            {isAI ? <AlertTriangle className="w-2.5 h-2.5"/> : <CheckCircle className="w-2.5 h-2.5"/>}
            {card.verdict}
          </span>
        </div>
      )}

      {/* Card footer */}
      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-start justify-between gap-1 mb-2">
          <p className="text-[11px] font-semibold text-slate-200 leading-tight">{card.label}</p>
          <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide
            ${isAI ? 'bg-rose-500-500/10 text-rose-400-400 border border-rose-500/20'
                   : 'bg-emerald-500-500/10 text-emerald-400-400 border border-emerald-500/20'}`}>
            {card.tag}
          </span>
        </div>

        {/* Confidence bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-[#1e1e2e] overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.04 + 0.3, duration: 0.8, ease: [0.22,1,0.36,1] }}
              style={{ originX: 0, width: `${card.confidence}%` }}
              className={`h-full rounded-full ${isAI ? 'bg-rose-500-500' : 'bg-emerald-500-500'}`}
            />
          </div>
          <span className={`text-[10px] font-bold tabular-nums shrink-0
            ${isAI ? 'text-rose-400-400' : 'text-emerald-400-400'}`}>
            {card.confidence}%
          </span>
        </div>
      </div>
    </motion.div>
  )
})

export default function AIvsRealSection() {
  return (
    <section className="py-16 sm:py-24 border-t border-white/[0.06] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                          border border-rose-500/25 bg-rose-500-500/[0.06] text-rose-400-400
                          text-xs font-semibold mb-5">
            <Scan className="w-3.5 h-3.5" />
            Real-World Detection Examples
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight mb-3">
            AI vs Authentic Content
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            How Aiscern distinguishes synthetic content from human originals — across text and images.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CARDS.map((card, i) => (
            <Card key={i} card={card} idx={i} />
          ))}
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6 flex items-center justify-center gap-1.5">
          <Brain className="w-3.5 h-3.5" />
          Illustrative examples — confidence scores are approximate. Try the live detector above for real results.
        </p>
      </div>
    </section>
  )
}
