'use client'
/**
 * ToolCard — C.1 refactor
 *
 * Extracted from app/(dashboard)/chat/page.tsx.
 * Renders a collapsible result card for each ARIA detection tool event.
 * Shared between the ARIA chat page and any future surfaces (e.g. scan history detail).
 */
import { useState } from 'react'

// ── Inline micro-icons (no external import needed) ───────────────────────────
const Ico = {
  Scan:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="7" height="5" x="7" y="7" rx="1"/><rect width="7" height="5" x="10" y="12" rx="1"/></svg>,
  ChevRight: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="m9 18 6-6-6-6"/></svg>,
  Copy:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  Check:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M20 6 9 17l-5-5"/></svg>,
}

// ── Tool metadata — must stay in sync with chat/route.ts TOOL_META ────────────
export const TOOL_META: Record<string, { label: string; color: string; Ic: () => React.ReactElement }> = {
  detect_text:  { label: 'Text Analysis',   color: '#818cf8', Ic: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/></svg> },
  detect_image: { label: 'Image Forensics', color: '#34d399', Ic: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg> },
  detect_audio: { label: 'Audio Analysis',  color: '#22d3ee', Ic: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
  detect_video: { label: 'Video Analysis',  color: '#f472b6', Ic: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg> },
  scrape_url:   { label: 'Web Scraper',     color: '#fb923c', Ic: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> },
}

interface ToolCardProps {
  tool:   string
  result: Record<string, unknown>
}

export function ToolCard({ tool, result }: ToolCardProps) {
  const [open,   setOpen]   = useState(false)
  const [copied, setCopied] = useState(false)
  const meta    = TOOL_META[tool] || { label: tool, color: '#6b7280', Ic: Ico.Scan }
  const { Ic: TIc } = meta
  const verdict = (result?.verdict || result?.result || 'Analysis complete') as string
  const conf    = (result?.confidence_pct ?? result?.confidence) as number | undefined
  const bad     = verdict?.toLowerCase().match(/ai-|deepfake|synthetic|clone/)

  const copyResult = (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = `${meta.label}\nVerdict: ${verdict}${conf != null ? `\nConfidence: ${conf}%` : ''}\n${JSON.stringify(result, null, 2)}`
    navigator.clipboard?.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="my-3 rounded-xl border overflow-hidden" style={{ borderColor:`${meta.color}28`, background:`${meta.color}07` }}>
      <button className="w-full flex items-center justify-between px-3 sm:px-4 py-3.5 hover:bg-white/4 transition-colors text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background:`${meta.color}18`, color:meta.color }}>
            <TIc />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color:`${meta.color}cc` }}>{meta.label}</div>
            <div className="text-sm font-bold text-white mt-0.5 truncate">{verdict}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
          {conf != null && (
            <div className="text-right">
              <div className="text-xs text-gray-600 hidden sm:block">Confidence</div>
              <div className="text-lg sm:text-xl font-black tabular-nums" style={{ color: bad ? '#f87171' : '#34d399' }}>{conf}%</div>
            </div>
          )}
          <div className={`text-gray-600 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}><Ico.ChevRight /></div>
        </div>
      </button>
      {open && (
        <div className="px-3 sm:px-4 pb-4 border-t" style={{ borderColor:`${meta.color}18` }}>
          {(result?.key_findings as string[] | undefined)?.length && (
            <div className="mt-3 mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{color:`${meta.color}cc`}}>Key Findings</div>
              <div className="space-y-1.5">
                {(result.key_findings as string[]).map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{background:meta.color}} />{f}
                  </div>
                ))}
              </div>
            </div>
          )}
          {result?.recommendation && (
            <div className="mt-2 mb-3 px-3 py-2.5 rounded-lg text-xs text-gray-300 border" style={{background:`${meta.color}0a`,borderColor:`${meta.color}20`}}>
              <span className="font-semibold" style={{color:meta.color}}>Recommendation: </span>{result.recommendation as string}
            </div>
          )}
          <div className="mt-2 space-y-2">
            {Object.entries(result || {}).map(([k, v]) => {
              if (['verdict','result','confidence_pct','confidence','key_findings','recommendation'].includes(k)) return null
              if (v === null || v === undefined || v === '') return null
              if (k === 'vila_analysis' || k === 'raw') return (
                <div key={k}>
                  <div className='text-xs font-semibold uppercase tracking-wider mb-2' style={{color:`${meta.color}cc`}}>Full Analysis</div>
                  <div className='text-xs text-gray-300 leading-relaxed p-3 rounded-lg border whitespace-pre-wrap max-h-48 overflow-y-auto' style={{background:`${meta.color}08`,borderColor:`${meta.color}20`}}>{String(v)}</div>
                </div>
              )
              if (['engine','analysis_model','analysis_focus','nvidia_powered'].includes(k)) return null
              if (typeof v === 'object' && !Array.isArray(v)) return (
                <div key={k}>
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">{k.replace(/_/g,' ')}</div>
                  <div className="space-y-1 pl-2 border-l-2" style={{ borderColor:`${meta.color}30` }}>
                    {Object.entries(v as Record<string, unknown>).map(([kk, vv]) => (
                      <div key={kk} className="flex justify-between text-xs gap-4">
                        <span className="text-gray-600 capitalize">{kk.replace(/_/g,' ')}</span>
                        <span className="text-gray-300 font-medium text-right">{String(vv)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
              if (Array.isArray(v)) {
                if (!v.length) return null
                return (
                  <div key={k}>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">{k.replace(/_/g,' ')}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(v as unknown[]).map((item, i) => (
                        <span key={i} className="px-2 py-1 rounded-md text-xs font-medium" style={{ background:`${meta.color}15`, color:meta.color }}>{String(item)}</span>
                      ))}
                    </div>
                  </div>
                )
              }
              return (
                <div key={k} className="flex justify-between text-xs gap-4">
                  <span className="text-gray-600 capitalize">{k.replace(/_/g,' ')}</span>
                  <span className="text-gray-300 font-medium text-right">{String(v)}</span>
                </div>
              )
            })}
          </div>
          <button onClick={copyResult} className="mt-3 flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
            {copied ? <Ico.Check /> : <Ico.Copy />}
            {copied ? 'Copied' : 'Copy result'}
          </button>
        </div>
      )}
    </div>
  )
}
