'use client'
/**
 * AIvsRealSection — lazy-loaded chunk
 * Extracted from app/page.tsx for route-based code splitting.
 * Loaded via next/dynamic + IntersectionObserver — only fetched when
 * the user scrolls near this section.
 */
import { motion } from 'framer-motion'
import { Scan, AlertTriangle, CheckCircle } from 'lucide-react'

// ─── Data ──────────────────────────────────────────────────────────────────
const COMPARISON_CARDS = [
  { type: 'text',  label: 'AI-Generated Text',       verdict: 'AI',    color: '#f43f5e', preview: 'The implementation of advanced machine learning algorithms has fundamentally transformed the paradigm of data processing...', tag: 'GPT-4',                   icon: 'text'  },
  { type: 'text',  label: 'Human Writing',             verdict: 'HUMAN', color: '#10b981', preview: "I burned my toast again this morning. Third time this week. My smoke alarm and I have a complicated relationship at this point...", tag: 'Authentic',              icon: 'text'  },
  { type: 'image', label: 'AI-Generated Portrait',     verdict: 'AI',    color: '#f43f5e', img: '/compare/ai-portrait-01.webp',      tag: 'Midjourney',              icon: 'image' },
  { type: 'image', label: 'Authentic Photo',           verdict: 'HUMAN', color: '#10b981', img: '/compare/real-portrait-01.webp',    tag: 'Authentic',               icon: 'image' },
  { type: 'image', label: 'DALL-E 3 Landscape',        verdict: 'AI',    color: '#f43f5e', img: '/compare/ai-city-01.webp',          tag: 'DALL-E 3',                icon: 'image' },
  { type: 'image', label: 'Real Landscape',            verdict: 'HUMAN', color: '#10b981', img: '/compare/real-mountain-01.webp',   tag: 'Authentic',               icon: 'image' },
  { type: 'image', label: 'Stable Diffusion Art',      verdict: 'AI',    color: '#f43f5e', img: '/compare/ai-abstract-01.webp',     tag: 'SD XL',                   icon: 'image' },
  { type: 'image', label: 'Real Urban Photo',          verdict: 'HUMAN', color: '#10b981', img: '/compare/real-street-01.webp',     tag: 'Authentic',               icon: 'image' },
  { type: 'text',  label: 'AI Essay',                  verdict: 'AI',    color: '#f43f5e', preview: 'Furthermore, the multifaceted implications of this technological advancement necessitate a comprehensive reevaluation of existing frameworks and paradigms...', tag: 'Claude 3', icon: 'text' },
  { type: 'text',  label: 'Student Writing',           verdict: 'HUMAN', color: '#10b981', preview: "ok so i know this essay is due tomorrow but i literally just figured out what my thesis even means. starting over at midnight feels bad but here we are lol", tag: 'Authentic', icon: 'text' },
  { type: 'image', label: 'AI Nature Scene',           verdict: 'AI',    color: '#f43f5e', img: '/compare/ai-nature-01.webp',       tag: 'Firefly',                 icon: 'image' },
  { type: 'image', label: 'Real Forest',               verdict: 'HUMAN', color: '#10b981', img: '/compare/real-forest-01.webp',     tag: 'Authentic',               icon: 'image' },
  { type: 'image', label: 'AI Portrait',               verdict: 'AI',    color: '#f43f5e', img: '/compare/ai-face-01.webp',         tag: 'ThisPersonDoesNotExist',  icon: 'image' },
  { type: 'image', label: 'Real Portrait',             verdict: 'HUMAN', color: '#10b981', img: '/compare/real-face-01.webp',       tag: 'Authentic',               icon: 'image' },
  { type: 'image', label: 'AI Architecture',           verdict: 'AI',    color: '#f43f5e', img: '/compare/ai-architecture-01.webp', tag: 'Midjourney',              icon: 'image' },
  { type: 'image', label: 'Real Architecture',         verdict: 'HUMAN', color: '#10b981', img: '/compare/real-architecture-01.webp', tag: 'Authentic',             icon: 'image' },
  { type: 'text',  label: 'AI Product Desc.',          verdict: 'AI',    color: '#f43f5e', preview: 'Experience unparalleled innovation with our cutting-edge solution that seamlessly integrates advanced AI-powered functionality to deliver exceptional results...', tag: 'GPT-3.5', icon: 'text' },
  { type: 'text',  label: 'Real Review',               verdict: 'HUMAN', color: '#10b981', preview: "shipped faster than expected, packaging was a bit beat up but the actual item inside was totally fine. would buy again if the price drops", tag: 'Authentic', icon: 'text' },
  { type: 'image', label: 'AI Food Photo',             verdict: 'AI',    color: '#f43f5e', img: '/compare/ai-food-01.webp',         tag: 'DALL-E 3',                icon: 'image' },
  { type: 'image', label: 'Real Food Photo',           verdict: 'HUMAN', color: '#10b981', img: '/compare/real-food-01.webp',       tag: 'Authentic',               icon: 'image' },
]

// ─── Card ──────────────────────────────────────────────────────────────────
function ComparisonCard({ card }: { card: typeof COMPARISON_CARDS[0] }) {
  const isAI = card.verdict === 'AI'
  return (
    <div className="flex-shrink-0 w-60 sm:w-64 lg:w-72 bg-surface border border-border/60 rounded-xl sm:rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 group">
      {card.type === 'image' && card.img ? (
        <div className="relative h-28 sm:h-36 lg:h-44 overflow-hidden bg-surface-active">
          <div className="absolute inset-0" style={{
            background: isAI ? 'linear-gradient(135deg,#4c1d9580,#1e1b4b50)' : 'linear-gradient(135deg,#064e3b80,#052e1650)',
          }} />
          <img src={card.img} alt={card.label}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 relative z-10"
            loading="lazy" width={288} height={176}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent z-20" />
          <div className={`absolute top-2.5 right-2.5 z-30 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-white backdrop-blur-sm ${isAI ? 'bg-rose/80 border border-rose/40' : 'bg-emerald/80 border border-emerald/40'}`}>
            {isAI ? <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
            {card.verdict}
          </div>
        </div>
      ) : (
        <div className="h-28 sm:h-36 lg:h-44 p-2 sm:p-4 bg-surface-active flex flex-col justify-center relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-1 h-full ${isAI ? 'bg-rose' : 'bg-emerald'}`} />
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed line-clamp-4 italic pl-3">
            &ldquo;{card.preview}&rdquo;
          </p>
          <div className={`absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isAI ? 'bg-rose/10 text-rose border border-rose/20' : 'bg-emerald/10 text-emerald border border-emerald/20'}`}>
            {isAI ? <AlertTriangle className="w-2.5 h-2.5" /> : <CheckCircle className="w-2.5 h-2.5" />}
            {card.verdict}
          </div>
        </div>
      )}
      <div className="p-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-sm font-semibold text-text-primary truncate">{card.label}</p>
          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 ${isAI ? 'bg-rose/10 text-rose' : 'bg-emerald/10 text-emerald'}`}>
            {card.tag}
          </span>
        </div>
        <div className="flex-shrink-0 ml-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${isAI ? 'bg-rose/10 text-rose border border-rose/20' : 'bg-emerald/10 text-emerald border border-emerald/20'}`}>
            {isAI ? '⚠ AI' : '✓ Real'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Section (default export) ──────────────────────────────────────────────
export default function AIvsRealSection() {
  return (
    <section className="py-10 sm:py-16 lg:py-24 overflow-hidden">
      <div className="max-w-7xl 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 2xl:px-10">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose/30 bg-rose/5 text-rose text-[11px] sm:text-xs font-semibold mb-3">
            <Scan className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            Real-World Detection Examples
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black mb-3">
            AI vs <span className="gradient-text">Authentic</span>
          </h2>
          <p className="text-text-muted text-sm sm:text-base lg:text-lg max-w-xl mx-auto px-2">
            See how Aiscern tells AI-generated content apart from authentic human work.
          </p>
        </motion.div>

        <div className="space-y-2 sm:space-y-3">
          <div className="relative overflow-hidden">
            <div className="flex gap-2 sm:gap-3 animate-scroll-left" style={{ width: 'max-content' }}>
              {[...COMPARISON_CARDS.slice(0, 10), ...COMPARISON_CARDS.slice(0, 10)].map((card, i) => (
                <ComparisonCard key={i} card={card} />
              ))}
            </div>
            <div className="absolute left-0 inset-y-0 w-6 sm:w-16 lg:w-28 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 inset-y-0 w-6 sm:w-16 lg:w-28 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          </div>
          <div className="relative overflow-hidden">
            <div className="flex gap-2 sm:gap-3 animate-scroll-right" style={{ width: 'max-content' }}>
              {[...COMPARISON_CARDS.slice(10), ...COMPARISON_CARDS.slice(10)].map((card, i) => (
                <ComparisonCard key={i} card={card} />
              ))}
            </div>
            <div className="absolute left-0 inset-y-0 w-6 sm:w-16 lg:w-28 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 inset-y-0 w-6 sm:w-16 lg:w-28 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          </div>
          <p className="text-center text-xs text-text-muted pt-2">⚠️ Illustrative examples — not real detection results. Try the live detector above.</p>
        </div>
      </div>
    </section>
  )
}
