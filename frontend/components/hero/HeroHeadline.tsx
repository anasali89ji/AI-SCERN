'use client'

import { useState } from 'react'

// Module 2.1: rotating/typewriter word animation removed per vibecode ban.
// Modalities are now a static, clickable tab row — no auto-rotation, no
// interval timers, no AnimatePresence entrance/exit on the word itself.
const MODALITIES = ['Text', 'Image', 'Audio', 'Video'] as const

export function HeroHeadline({ initialIndex = 0 }: { initialIndex?: number }) {
  const [active, setActive] = useState<typeof MODALITIES[number]>(MODALITIES[initialIndex])

  return (
    <div className="select-none">
      <h1 className="font-heading font-bold leading-[1.05] tracking-tight text-display text-silver-900">
        Attest any content.
      </h1>
      <p className="font-heading font-semibold leading-[1.1] tracking-tight text-headline text-silver-700 mt-1">
        AI-generated or human-made.
      </p>

      {/* Static modality tab row — replaces the old rotating-word carousel */}
      <div role="tablist" aria-label="Content types" className="flex flex-wrap gap-2 mt-6">
        {MODALITIES.map(m => {
          const isActive = m === active
          return (
            <button
              key={m}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(m)}
              className={
                isActive
                  ? 'px-3.5 py-1.5 rounded-full text-xs font-semibold border border-accent/30 bg-accent/10 text-accent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50'
                  : 'px-3.5 py-1.5 rounded-full text-xs font-semibold border border-white/[0.08] text-silver-600 hover:text-silver-800 hover:border-white/[0.16] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50'
              }
            >
              {m}
            </button>
          )
        })}
      </div>
    </div>
  )
}
