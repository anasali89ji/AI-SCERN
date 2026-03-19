'use client'
export const dynamic = 'force-dynamic'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { ReviewSuggestion } from '@/components/ReviewSuggestion'


const STORAGE_KEY = 'detectai_chats_v2'

// ── Icons ──────────────────────────────────────────────────────────────────
const Ico = {
  Send: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  Plus: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>,
  Trash: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>,
  TrashAll: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>,
  Copy: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  Check: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M20 6 9 17l-5-5"/></svg>,
  Menu: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
  Close: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Chat: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Brain: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.98-3 2.5 2.5 0 0 1-1.32-4.24 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.1-2.88"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.98-3 2.5 2.5 0 0 0 1.32-4.24 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.1-2.88"/></svg>,
  Shield: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Image: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>,
  FileText: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/></svg>,
  Music: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  Video: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>,
  Clip: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  Stop: () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>,
  Spin: () => <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin"><circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>,
  Globe: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
  ChevRight: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="m9 18 6-6-6-6"/></svg>,
  DB: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>,
  Scan: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="7" height="5" x="7" y="7" rx="1"/><rect width="7" height="5" x="10" y="12" rx="1"/></svg>,
  Home: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Download: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  Search: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Attachment { name: string; type: string; data: string; preview?: string; size: number }
interface AttachmentMeta { name: string; type: string; size: number } // stored without base64
interface ToolEvent  { tool: string; status: 'running' | 'done'; result?: any }
interface Message    { id: string; role: 'user'|'assistant'; content: string; timestamp: string; attachments?: Attachment[]; toolEvents?: ToolEvent[]; isStreaming?: boolean }
interface Chat       { id: string; title: string; messages: Message[]; createdAt: string; updatedAt: string }

const TOOL_META: Record<string,{label:string;color:string;Ic:()=>JSX.Element}> = {
  detect_image_with_vila: { label:'Vision Analysis',  color:'#7c3aed', Ic: Ico.Image },
  detect_text:            { label:'Text Analysis',    color:'#7c3aed', Ic: Ico.FileText },
  detect_image:           { label:'Image Analysis',   color:'#2563eb', Ic: Ico.Image },
  detect_audio:           { label:'Audio Analysis',   color:'#0891b2', Ic: Ico.Music },
  detect_video:           { label:'Video Analysis',   color:'#059669', Ic: Ico.Video },
  get_pipeline_stats:     { label:'Detection Stats',  color:'#d97706', Ic: Ico.DB },
  analyze_url:            { label:'URL Analysis',     color:'#d97706', Ic: Ico.Globe },
}

// ── localStorage helpers ────────────────────────────────────────────────────
function saveChats(chats: Chat[]) {
  try {
    // Strip large base64 data from attachments before saving
    const slim = chats.map(c => ({
      ...c,
      messages: c.messages.map(m => ({
        ...m,
        isStreaming: false, // never persist streaming state
        attachments: m.attachments?.map(a => ({ name: a.name, type: a.type, size: a.size })),
      }))
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
  } catch (e) {
    // Quota exceeded — trim oldest chats and retry
    try {
      const trimmed = chats.slice(0, 20).map(c => ({
        ...c,
        messages: c.messages.slice(-30).map(m => ({ ...m, isStreaming: false, attachments: undefined }))
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    } catch { /* silent */ }
  }
}

function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c: any) => c?.id && c?.messages)
  } catch { return [] }
}

// ── Markdown renderer ───────────────────────────────────────────────────────
// Sanitize HTML to prevent XSS — only allow safe tags and attributes
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, 'blocked:')
    .replace(/<a\s/gi, '<a rel="noopener noreferrer" target="_blank" ')
}

function Markdown({ content }: { content: string }) {
  const lines = content.split('\n')
  let html = ''
  let inCode = false
  let codeLang = ''
  let codeLines: string[] = []

  for (const line of lines) {
    const codeMatch = line.match(/^```(\w+)?$/)
    if (codeMatch) {
      if (!inCode) {
        inCode = true
        codeLang = codeMatch[1] || ''
        codeLines = []
      } else {
        const escaped = codeLines.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        html += `<pre class="bg-black/40 border border-white/8 rounded-xl p-4 my-3 overflow-x-auto text-xs font-mono text-emerald-300 leading-relaxed whitespace-pre"><code>${escaped}</code></pre>`
        inCode = false
        codeLines = []
      }
      continue
    }
    if (inCode) { codeLines.push(line); continue }

    let l = line
    l = l.replace(/`([^`]+)`/g, (_m: string, c: string) =>
      `<code class="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 text-xs font-mono">${c.replace(/</g, '&lt;')}</code>`)
    if (l.startsWith('### ')) { html += `<h3 class="text-sm font-bold text-white mt-5 mb-1.5">${l.slice(4)}</h3>`; continue }
    if (l.startsWith('## '))  { html += `<h2 class="text-base font-bold text-white mt-5 mb-2">${l.slice(3)}</h2>`; continue }
    if (l.startsWith('# '))   { html += `<h1 class="text-lg font-bold text-white mt-5 mb-3">${l.slice(2)}</h1>`; continue }
    if (l.startsWith('- '))   { html += `<li class="flex gap-2 items-start py-0.5"><span class="mt-2 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0"></span><span>${l.slice(2)}</span></li>`; continue }
    if (/^\d+\. /.test(l)) {
      const m = l.match(/^(\d+)\. (.+)/)
      if (m) { html += `<li class="flex gap-2 items-start py-0.5"><span class="text-violet-400 text-xs font-mono mt-0.5 w-4 shrink-0">${m[1]}.</span><span>${m[2]}</span></li>`; continue }
    }
    l = l.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    l = l.replace(/\*(.+?)\*/g, '<em class="text-gray-300 italic">$1</em>')
    l = l.replace(/\[(.+?)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-violet-400 hover:text-violet-300 underline">$1</a>')
    if (l === '') { html += '<br/>'; continue }
    html += `<span>${l}</span><br/>`
  }

  const safeHtml = sanitizeHtml(html)
  return (
    <div className="text-sm leading-relaxed text-gray-300"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}


// ── Tool result card ─────────────────────────────────────────────────────
function ToolCard({ tool, result }: { tool: string; result: any }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const meta = TOOL_META[tool] || { label: tool, color: '#6b7280', Ic: Ico.Scan }
  const { Ic: TIc } = meta
  const verdict = result?.verdict || result?.result || 'Analysis complete'
  const conf = result?.confidence_pct ?? result?.confidence
  const bad = verdict?.toLowerCase().match(/ai-|deepfake|synthetic|clone/)

  const copyResult = (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = `${meta.label}\nVerdict: ${verdict}${conf != null ? `\nConfidence: ${conf}%` : ''}\n${JSON.stringify(result, null, 2)}`
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
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
          {/* Key findings as tags */}
          {result?.key_findings?.length > 0 && (
            <div className="mt-3 mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{color:`${meta.color}cc`}}>Key Findings</div>
              <div className="space-y-1.5">
                {result.key_findings.map((f: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{background:meta.color}} />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
          {result?.recommendation && (
            <div className="mt-2 mb-3 px-3 py-2.5 rounded-lg text-xs text-gray-300 border" style={{background:`${meta.color}0a`,borderColor:`${meta.color}20`}}>
              <span className="font-semibold" style={{color:meta.color}}>Recommendation: </span>{result.recommendation}
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
                    {Object.entries(v as Record<string,any>).map(([kk,vv]) => (
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
                      {v.map((item,i) => (
                        <span key={i} className="px-2 py-1 rounded-md text-xs font-medium" style={{ background:`${meta.color}15`, color:meta.color }}>{item}</span>
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

// ── Timestamp ───────────────────────────────────────────────────────────────
function MsgTime({ ts }: { ts: string }) {
  const d = new Date(ts)
  const fmt = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return <span className="text-[10px] text-gray-700 mt-1 px-1 select-none">{fmt}</span>
}

// ── Message bubble ─────────────────────────────────────────────────────────
function MessageBubble({ msg, onCopy }: { msg: Message; onCopy: (t:string)=>void }) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'
  const copy = () => { onCopy(msg.content); setCopied(true); setTimeout(()=>setCopied(false),1800) }

  return (
    <div className={`flex gap-2 sm:gap-3 group ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-violet-500/20">
          <Ico.Brain />
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[88%] sm:max-w-[82%] min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Attachments */}
        {msg.attachments?.map((att,i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-white/10 max-w-[240px] sm:max-w-[280px]">
            {att.type?.startsWith('image/') && att.preview
              ? <img src={att.preview} alt={att.name} className="max-h-40 sm:max-h-48 object-cover w-full" />
              : <div className="flex items-center gap-2 px-3 py-2 bg-white/5 text-xs text-gray-400"><Ico.Clip />{att.name}</div>
            }
          </div>
        ))}

        {/* Tool running indicators */}
        {!isUser && msg.toolEvents?.filter(t=>t.status==='running').map((te,i) => {
          const m = TOOL_META[te.tool]
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-xs text-gray-500">
              <Ico.Spin />
              <span>Running {m?.label || te.tool}…</span>
            </div>
          )
        })}
        {/* Tool results */}
        {!isUser && msg.toolEvents?.filter(t=>t.status==='done'&&t.result).map((te,i) => (
          <ToolCard key={i} tool={te.tool} result={te.result} />
        ))}

        {/* Content bubble */}
        {(msg.content || msg.isStreaming) && (
          <div className={`rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm ${
            isUser
              ? 'bg-gradient-to-br from-violet-600 to-blue-600 text-white rounded-br-sm shadow-lg shadow-violet-500/15'
              : 'bg-[#131328] border border-white/8 rounded-bl-sm'
          }`}>
            {isUser
              ? <p className="leading-relaxed whitespace-pre-wrap text-white text-sm">{msg.content}</p>
              : <Markdown content={msg.content} />
            }
            {msg.isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle rounded-full" />
            )}
          </div>
        )}

        {/* Timestamp + copy */}
        <div className={`flex items-center gap-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <MsgTime ts={msg.timestamp} />
          {!isUser && !msg.isStreaming && msg.content && (
            <button onClick={copy} className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-400 transition-all px-2 py-1 rounded-lg hover:bg-white/5">
              {copied ? <Ico.Check /> : <Ico.Copy />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      {isUser && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-gray-400 text-xs font-bold">
          U
        </div>
      )}
    </div>
  )
}

// ── Welcome suggestions ────────────────────────────────────────────────────
const SUGGESTIONS = [
  { Ic: Ico.Image,    text: 'Upload an image to detect if it\'s AI-generated or a deepfake', cat: 'Image' },
  { Ic: Ico.FileText, text: 'Paste text to check if it was written by AI',                   cat: 'Text'  },
  { Ic: Ico.Music,    text: 'How do forensic tools detect voice cloning?',                    cat: 'Audio' },
  { Ic: Ico.Brain,    text: 'Explain GAN fingerprinting and diffusion model artifacts',        cat: 'Learn' },
  { Ic: Ico.Shield,   text: 'What makes DETECTAI different from GPTZero and Turnitin?',        cat: 'Compare'},
  { Ic: Ico.DB,       text: 'Show me Aiscern\'s current detection statistics',                 cat: 'Data'  },
]

// ── Main ───────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string|null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [abort, setAbort] = useState<AbortController|null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const activeChat = chats.find(c=>c.id===activeChatId)

  // ── Hydrate from localStorage on mount ──────────────────────────────────
  useEffect(() => {
    const saved = loadChats()
    if (saved.length > 0) {
      setChats(saved)
      setActiveChatId(saved[0].id)
    }
    setHydrated(true)
  }, [])

  // ── Persist chats to localStorage whenever they change ──────────────────
  useEffect(() => {
    if (!hydrated) return
    saveChats(chats)
  }, [chats, hydrated])

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}) }, [activeChat?.messages.length])

  useEffect(()=>{
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  const now = () => new Date().toISOString()

  const newChat = useCallback(()=>{
    const id = `c${Date.now()}`
    const nc: Chat = { id, title:'New conversation', messages:[], createdAt:now(), updatedAt:now() }
    setChats(p=>[nc,...p]); setActiveChatId(id); setSidebarOpen(false); setInput(''); setAttachments([])
  },[])

  const delChat = useCallback((id:string, e?: React.MouseEvent)=>{
    e?.stopPropagation()
    setChats(p=>p.filter(c=>c.id!==id))
    if (activeChatId===id) {
      const remaining = chats.filter(c=>c.id!==id)
      setActiveChatId(remaining[0]?.id || null)
    }
  },[activeChatId, chats])

  const clearAll = useCallback(()=>{
    if (!confirm('Delete all conversations? This cannot be undone.')) return
    setChats([]); setActiveChatId(null)
    localStorage.removeItem(STORAGE_KEY)
  },[])

  const exportChat = useCallback(()=>{
    if (!activeChat) return
    const text = activeChat.messages.map(m => `[${m.role.toUpperCase()}] ${new Date(m.timestamp).toLocaleString()}\n${m.content}`).join('\n\n---\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${activeChat.title.slice(0,30)}.txt`; a.click()
  },[activeChat])

  const handleFiles = async (files: FileList|null)=>{
    if (!files) return
    for (const file of Array.from(files)) {
      if (file.size > 20*1024*1024) continue
      const data = await new Promise<string>(res=>{
        const r = new FileReader(); r.onload=e=>res((e.target?.result as string)?.split(',')[1]||''); r.readAsDataURL(file)
      })
      const preview = file.type.startsWith('image/') ? `data:${file.type};base64,${data}` : undefined
      setAttachments(p=>[...p,{ name:file.name, type:file.type, data, preview, size:file.size }])
    }
  }

  const send = useCallback(async (text?:string)=>{
    const content = (text||input).trim()
    if ((!content && !attachments.length) || loading) return

    let chatId = activeChatId
    if (!chatId) {
      const id = `c${Date.now()}`
      const nc: Chat = { id, title:content.slice(0,50)||'New conversation', messages:[], createdAt:now(), updatedAt:now() }
      setChats(p=>[nc,...p]); setActiveChatId(id); chatId=id
    }

    const userMsg: Message = {
      id:`m${Date.now()}`, role:'user', content,
      timestamp: now(),
      attachments: attachments.length ? [...attachments] : undefined
    }
    setChats(p=>p.map(c=>c.id===chatId?{
      ...c,
      title: c.messages.length===0 ? content.slice(0,50) : c.title,
      messages:[...c.messages, userMsg],
      updatedAt: now()
    }:c))
    setInput(''); setAttachments([]); setLoading(true)

    const aid = `m${Date.now()+1}`
    const assistMsg: Message = { id:aid, role:'assistant', content:'', timestamp:now(), toolEvents:[], isStreaming:true }
    setChats(p=>p.map(c=>c.id===chatId?{...c,messages:[...c.messages,assistMsg]}:c))

    const ac = new AbortController(); setAbort(ac)

    try {
      // Build history directly — don't read from stale chats state
      // chats state may not yet include userMsg due to React batching
      const currentChat = chats.find(c=>c.id===chatId)
      const prevMessages = (currentChat?.messages||[]).filter(m=>m.id!==userMsg.id)
      const history = [...prevMessages, userMsg]

      // Only send image attachments to API — audio/video not supported yet
      const imageAtts = userMsg.attachments?.filter(a=>a.type?.startsWith('image/'))
      const unsupportedAtts = userMsg.attachments?.filter(a=>!a.type?.startsWith('image/'))

      const res = await fetch('/api/chat',{
        method:'POST', signal:ac.signal,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          messages: history.map(m=>({role:m.role, content:m.content})),
          attachments: imageAtts?.map(a=>({type:a.type, data:a.data, name:a.name})),
        }),
      })
      // Warn about unsupported attachment types
      if (unsupportedAtts?.length) {
        setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{
          ...m,
          content: `⚠️ Note: Audio/video files can't be analyzed directly in chat. Please use the dedicated [Audio](/detect/audio) or [Video](/detect/video) detection tools for those files.\n\n`,
        }:m)}:c))
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`)

      const ct = res.headers.get('content-type')||''
      if (ct.includes('application/json')) {
        const d = await res.json()
        setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,content:d.text||'No response.',isStreaming:false}:m),updatedAt:now()}:c))
        return
      }

      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf=''
      while(true){
        const {done,value}=await reader.read(); if(done) break
        buf += dec.decode(value,{stream:true})
        const blocks = buf.split('\n\n'); buf=blocks.pop()||''
        for(const block of blocks){
          for(const line of block.split('\n')){
            if(!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if(!raw || raw==='[DONE]') continue
            try{
              const ev = JSON.parse(raw)
              if(ev.type==='text') setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,content:m.content+ev.text}:m)}:c))
              if(ev.type==='tool_result') setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,toolEvents:[...(m.toolEvents||[]).filter(t=>t.tool!==ev.tool),{tool:ev.tool,status:'done',result:ev.result}]}:m)}:c))
              if(ev.type==='done') setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,isStreaming:false}:m),updatedAt:now()}:c))
            }catch(_){/* skip malformed SSE line */}
          }
        }
      }
    } catch(e:any){
      if(e?.name!=='AbortError'){
        setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,content:'Connection error — please try again.',isStreaming:false}:m)}:c))
      }
    } finally { setLoading(false); setAbort(null) }
  },[input,attachments,activeChatId,chats,loading])

  const stop=()=>{
    abort?.abort(); setLoading(false)
    setChats(p=>p.map(c=>c.id===activeChatId?{...c,messages:c.messages.map(m=>m.isStreaming?{...m,isStreaming:false}:m)}:c))
  }

  // Filter chats by search
  const filteredChats = searchQuery
    ? chats.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : chats

  if (!hydrated) return (
    <div className="flex h-[calc(100dvh-4rem)] items-center justify-center bg-[#09090f]">
      <div className="text-gray-700 text-sm">Loading conversations…</div>
    </div>
  )

  return (
    <>
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-[#09090f]">

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 z-20 lg:hidden" onClick={()=>setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed lg:relative z-30 lg:z-auto w-[15.5rem] sm:w-[17rem] h-full flex flex-col
        bg-[#0c0c1a] border-r border-white/[0.06] transition-transform duration-300
        ${sidebarOpen?'translate-x-0':'-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-3 pt-4 border-b border-white/[0.06] space-y-2">
          <button onClick={newChat} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all shadow-lg shadow-violet-500/20">
            <Ico.Plus /><span>New conversation</span>
          </button>
          {/* Search toggle */}
          <button onClick={()=>setShowSearch(s=>!s)} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-600 hover:text-gray-300 hover:bg-white/[0.04] text-xs transition-all">
            <Ico.Search /><span>Search conversations</span>
          </button>
          {showSearch && (
            <input
              value={searchQuery}
              onChange={e=>setSearchQuery(e.target.value)}
              placeholder="Search…"
              autoFocus
              className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-gray-300 placeholder:text-gray-700 outline-none focus:border-violet-500/40"
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {filteredChats.length===0 && (
            <p className="text-xs text-gray-700 text-center py-10 px-4 leading-relaxed">
              {searchQuery ? 'No matching conversations' : 'Start a conversation to see it here'}
            </p>
          )}
          {filteredChats.map(c=>(
            <div key={c.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                activeChatId===c.id ? 'bg-white/8 text-white border border-white/10' : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.04]'
              }`}
              onClick={()=>{setActiveChatId(c.id);setSidebarOpen(false)}}
            >
              <span className="shrink-0 opacity-60"><Ico.Chat /></span>
              <div className="flex-1 min-w-0">
                <div className="truncate">{c.title}</div>
                <div className="text-[10px] text-gray-700 mt-0.5">{c.messages.length} messages</div>
              </div>
              <button onClick={e=>delChat(c.id,e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all rounded shrink-0">
                <Ico.Trash />
              </button>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-white/[0.06] space-y-0.5">
          {chats.length > 0 && (
            <button onClick={clearAll} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-500/10 text-gray-700 hover:text-red-400 transition-all text-xs">
              <Ico.TrashAll /><span>Clear all conversations</span>
            </button>
          )}
          <Link href="/" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] text-gray-700 hover:text-gray-400 transition-all text-xs w-full">
            <Ico.Home /><span>Back to home</span>
          </Link>
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            {chats.length} conversation{chats.length!==1?'s':''} saved
          </div>
        </div>
      </aside>

      {/* ── Main panel ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-13 sm:h-14 border-b border-white/[0.06] bg-[#09090f]/80 backdrop-blur-xl">
          <button onClick={()=>setSidebarOpen(s=>!s)} className="lg:hidden p-2 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors shrink-0">
            <Ico.Menu />
          </button>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
              <Ico.Brain />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white leading-none truncate">ARIA by DETECTAI</div>
              <div className="text-xs text-gray-600 mt-0.5 hidden sm:block">
                {activeChat ? `${activeChat.messages.length} messages · ${activeChat.title.slice(0,40)}` : 'Multi-modal · Tool-enabled · General knowledge'}
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {activeChat && activeChat.messages.length > 0 && (
              <button onClick={exportChat} title="Export chat" className="p-2 rounded-lg hover:bg-white/8 text-gray-600 hover:text-gray-300 transition-colors">
                <Ico.Download />
              </button>
            )}
            <div className="hidden sm:flex items-center gap-1">
              {(['Text','Image','Audio','Video'] as const).map(l => {
                const icons = { Text: Ico.FileText, Image: Ico.Image, Audio: Ico.Music, Video: Ico.Video }
                const I = icons[l]
                return (
                  <div key={l} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-white/[0.04] text-gray-600 border border-white/[0.06]">
                    <span className="text-gray-500"><I /></span>
                    <span className="hidden md:inline">{l}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {!activeChat || activeChat.messages.length===0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4 py-6 sm:py-8 max-w-2xl mx-auto w-full">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center mb-5 shadow-2xl shadow-violet-500/25">
                <Ico.Brain />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">ARIA — DETECTAI Assistant</h1>
              <p className="text-gray-600 text-sm text-center mb-6 sm:mb-8 max-w-sm leading-relaxed">
                Your AI-powered analyst. Ask any question, upload media for deepfake detection, or explore DETECTAI's capabilities.
              </p>

              <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8">
                {[
                  ['AI Text Detection', Ico.FileText],
                  ['Deepfake Analysis', Ico.Image],
                  ['Voice Clone Detection', Ico.Music],
                  ['Video Deepfakes', Ico.Video],
                  ['General Questions', Ico.Globe],
                  ['Dataset Insights', Ico.DB],
                ].map(([l, I]) => {
                  const Icon = I as () => JSX.Element
                  return (
                    <div key={l as string} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-xs text-gray-500">
                      <span className="opacity-60"><Icon /></span>
                      <span className="hidden sm:inline">{l as string}</span>
                      <span className="sm:hidden">{(l as string).split(' ')[0]}</span>
                    </div>
                  )
                })}
              </div>

              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map(({Ic: I, text, cat})=>(
                  <button key={text} onClick={()=>send(text)}
                    className="flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.07] hover:border-violet-500/25 text-left transition-all group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-violet-500/12 text-violet-400/80 flex items-center justify-center shrink-0 group-hover:bg-violet-500/20 transition-colors">
                      <I />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">{cat}</div>
                      <div className="text-xs text-gray-400 leading-relaxed">{text}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
              {activeChat.messages.map(msg=>(
                <MessageBubble key={msg.id} msg={msg} onCopy={t=>navigator.clipboard?.writeText(t)} />
              ))}
              <div ref={endRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#09090f]/80 backdrop-blur-xl px-3 sm:px-4 py-3 sm:py-4">
          <div className="max-w-3xl mx-auto">

            {attachments.length>0 && (
              <div className="flex flex-wrap gap-2 mb-2.5">
                {attachments.map((a,i)=>(
                  <div key={i} className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/6 border border-white/10 text-xs text-gray-500 max-w-[180px]">
                    {a.type.startsWith('image/') ? <Ico.Image /> : a.type.startsWith('audio/') ? <Ico.Music /> : a.type.startsWith('video/') ? <Ico.Video /> : <Ico.FileText />}
                    <span className="truncate">{a.name}</span>
                    <button onClick={()=>setAttachments(p=>p.filter((_,j)=>j!==i))} className="hover:text-red-400 transition-colors ml-0.5 shrink-0"><Ico.Close /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-1.5 sm:gap-2 px-2 py-2 rounded-2xl border border-white/10 bg-[#111128] focus-within:border-violet-500/40 focus-within:shadow-lg focus-within:shadow-violet-500/8 transition-all">
              <button
                onClick={()=>fileRef.current?.click()}
                className="p-2 rounded-xl text-gray-700 hover:text-gray-400 hover:bg-white/8 transition-colors shrink-0 mb-0.5"
                title="Attach image, audio or video"
              >
                <Ico.Clip />
              </button>
              <input ref={fileRef} type="file" className="hidden" multiple accept="image/*,audio/*,video/*,.txt,.pdf"
                onChange={e=>handleFiles(e.target.files)} />

              <textarea
                ref={taRef} value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}
                placeholder="Ask anything, or upload media to analyze…"
                rows={1}
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder:text-gray-700 resize-none outline-none leading-relaxed py-2 min-h-[36px] max-h-[160px]"
              />

              {loading
                ? <button onClick={stop} className="p-2 rounded-xl bg-red-500/12 text-red-400 hover:bg-red-500/20 transition-colors shrink-0 mb-0.5 active:scale-95" title="Stop"><Ico.Stop /></button>
                : <button
                    onClick={()=>send()}
                    disabled={!input.trim()&&!attachments.length}
                    className="p-2 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-white disabled:opacity-25 hover:opacity-90 active:scale-95 transition-all shrink-0 mb-0.5 shadow-lg shadow-violet-500/20"
                  >
                    <Ico.Send />
                  </button>
              }
            </div>

            <p className="text-center text-[10px] sm:text-xs text-gray-800 mt-2 select-none">
              Shift+Enter for new line · Supports image, audio, video up to 20 MB · Conversations auto-saved
            </p>
          </div>
        </div>
      </main>
    </div>
    <div className="px-4 pb-4 max-w-full">
      <ReviewSuggestion toolName="AI Detection Assistant" />
    </div>
  </>
  )
}
