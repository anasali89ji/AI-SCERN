'use client'

import { useState } from 'react'
import { ShieldCheck, Copy, Check, ExternalLink } from 'lucide-react'

interface SealBadgeProps {
  sealNumber:     string
  sealVerifyUrl?: string | null
}

/** Shows the signed integrity seal issued for a scan, with copy + public verify link. */
export function SealBadge({ sealNumber, sealVerifyUrl }: SealBadgeProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sealNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable — non-fatal */ }
  }

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 rounded-xl border border-silver-300 bg-surface/50 px-4 py-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-silver-600">Integrity seal</p>
          <p className="font-mono text-sm text-white truncate">{sealNumber}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-silver-600 hover:text-white transition-colors border border-silver-300 rounded-lg px-3 py-1.5 hover:border-white/[0.12]"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        {sealVerifyUrl && (
          <a
            href={sealVerifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-silver-600 hover:text-white transition-colors border border-silver-300 rounded-lg px-3 py-1.5 hover:border-white/[0.12]"
          >
            <ExternalLink className="w-3 h-3" /> Verify
          </a>
        )}
      </div>
    </div>
  )
}

export default SealBadge
