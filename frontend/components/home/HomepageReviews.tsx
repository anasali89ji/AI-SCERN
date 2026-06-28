'use client'
import { useState, useEffect, memo } from 'react'
import { Star } from 'lucide-react'

interface Review {
  id?: string | number
  rating?: number; stars?: number
  body?: string;   text?: string
  is_anonymous?: boolean; display_name?: string; tool_used?: string
}

const FALLBACK: Review[] = [
  { id:'f1', rating:5, body:'Caught AI-generated submissions I would have missed entirely. The sentence-level heatmap is what sets it apart from other tools.', display_name:'Dr. Sarah M.',  tool_used:'AI Text Detector'       },
  { id:'f2', rating:5, body:'The deepfake detector saved our editorial team from publishing a manipulated image. Essential for any newsroom doing visual verification.', display_name:'James K.',       tool_used:'Image Detector'           },
  { id:'f3', rating:5, body:'Fast and accurate. I run every audio clip through it before broadcasting. Has saved me from voice clone disinformation twice.',             display_name:'Priya L.',       tool_used:'Audio Detector'           },
]

const ReviewCard = memo(function ReviewCard({ r }: { r: Review }) {
  const stars = r.rating ?? r.stars ?? 5
  const text  = r.body ?? r.text ?? ''
  const name  = r.is_anonymous ? 'Anonymous' : (r.display_name ?? 'Aiscern User')
  const init  = r.is_anonymous ? '?' : name.charAt(0).toUpperCase()

  return (
    <div className="flex flex-col bg-[#141414] border border-[#1E1E1E] rounded-xl p-5 hover:border-[#2A2A2A] transition-all duration-200">
      <div className="flex gap-0.5 mb-3" aria-label={`${stars} out of 5 stars`}>
        {Array.from({ length: stars }).map((_,j) => (
          <Star key={j} className="w-3.5 h-3.5 text-[#FFB800] fill-[#FFB800]" aria-hidden />
        ))}
        {Array.from({ length: 5 - stars }).map((_,j) => (
          <Star key={`e${j}`} className="w-3.5 h-3.5 text-[#3A3A3A]" aria-hidden />
        ))}
      </div>
      <p className="text-sm text-[#A3A3A3] leading-relaxed flex-1 mb-4">&ldquo;{text}&rdquo;</p>
      <div className="flex items-center gap-3 pt-4 border-t border-[#1E1E1E]">
        <div className="w-9 h-9 rounded-full bg-[#2BEE34]/10 border border-[#2BEE34]/20 flex items-center justify-center text-sm font-black text-[#2BEE34] flex-shrink-0" aria-hidden>
          {init}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#E5E5E5]">{name}</p>
          {r.tool_used && <p className="text-[11px] text-[#6B6B6B]">{r.tool_used}</p>}
        </div>
      </div>
    </div>
  )
})

export default function HomepageReviews() {
  const [reviews, setReviews] = useState<Review[]>(FALLBACK)

  useEffect(() => {
    fetch('/api/reviews?limit=3&sort=helpful')
      .then(r => r.json())
      .then(d => { if (d.data?.length >= 3) setReviews(d.data.slice(0, 3)) })
      .catch(() => {})
  }, [])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {reviews.map(r => <ReviewCard key={String(r.id)} r={r} />)}
    </div>
  )
}
