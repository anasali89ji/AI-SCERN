'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUser } from '@clerk/nextjs'
import { ToolCard, TOOL_META } from '@/components/ToolCard'
import dynamic from 'next/dynamic'

// ── Post-session component — only shown after first message ───────────────────
const LazyReviewSuggestion = dynamic(
  () => import('@/components/ReviewSuggestion').then(m => ({ default: m.ReviewSuggestion })),
  { ssr: false }
)

const STORAGE_KEY = 'aiscern_chats_v2'

// ── Icons ──────────────────────────────────────────────────────────────────
const Ico = {
  Send:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  Plus:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>,
  Trash:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>,
  TrashAll:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>,
  Copy:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  Check:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M20 6 9 17l-5-5"/></svg>,
  Menu:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
  Close:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Chat:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Shield:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Image:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>,
  FileText:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/></svg>,
  Music:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  Video:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>,
  Clip:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  Stop:      () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>,
  Spin:      () => <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin"><circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>,
  Globe:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
  ChevRight: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="m9 18 6-6-6-6"/></svg>,
  DB:        () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>,
  Scan:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="7" height="5" x="7" y="7" rx="1"/><rect width="7" height="5" x="10" y="12" rx="1"/></svg>,
  Home:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Download:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  Search:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Mic:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/></svg>,
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Attachment  { name: string; type: string; data: string; preview?: string; size: number }
interface ToolEvent   { tool: string; status: 'running'|'done'; result?: any }
interface Message     { id: string; role: 'user'|'assistant'; content: string; timestamp: string; attachments?: Attachment[]; toolEvents?: ToolEvent[]; isStreaming?: boolean; isThinking?: boolean }
interface Chat        { id: string; title: string; messages: Message[]; createdAt: string; updatedAt: string }

// ── Aiscern logo avatar for ARIA — black bg ─────────────────────────────────
function AriaAvatar({ size = 'md' }: { size?: 'sm'|'md' }) {
  const cls = size === 'sm' ? 'w-7 h-7 rounded-lg' : 'w-8 h-8 rounded-xl'
  return (
    <div className={`${cls} bg-black flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20 overflow-hidden border border-white/[0.06]`}>
      <Image src="/logo.png" alt="ARIA" width={18} height={18} className="object-contain drop-shadow-[0_0_6px_rgba(245,100,0,0.9)]" />
    </div>
  )
}

// ── User avatar from Clerk ──────────────────────────────────────────────────
function UserAvatar({ imageUrl, name, size = 'md' }: { imageUrl?: string|null; name?: string|null; size?: 'sm'|'md' }) {
  const cls = size === 'sm' ? 'w-7 h-7 rounded-lg text-[10px]' : 'w-8 h-8 rounded-xl text-xs'
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : 'U'

  if (imageUrl) {
    return (
      <div className={`${cls} shrink-0 overflow-hidden border border-white/[0.06] mt-0.5`}>
        <img src={imageUrl} alt={name || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      </div>
    )
  }
  return (
    <div className={`${cls} bg-gradient-to-br from-violet-700 to-indigo-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-white`}>
      {initials}
    </div>
  )
}

// ── localStorage helpers ────────────────────────────────────────────────────
function saveChats(chats: Chat[]) {
  // BUG-04 FIX: Handle QuotaExceededError gracefully — prune on failure then last-resort clear
  const slim = chats.map(c => ({
    ...c,
    messages: c.messages.slice(-30).map(m => ({
      ...m,
      isStreaming: false,
      attachments: m.attachments?.map(a => ({ name: a.name, type: a.type, size: a.size })),
    }))
  }))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
  } catch {
    // QuotaExceededError — prune to 3 most recent chats and retry
    const pruned = slim.slice(-3)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned))
    } catch {
      // Last resort: clear storage entirely to unblock the UI
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* silent */ }
    }
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
  let codeLines: string[] = []

  for (const line of lines) {
    const codeMatch = line.match(/^```(\w+)?$/)
    if (codeMatch) {
      if (!inCode) { inCode = true; codeLines = [] }
      else {
        const escaped = codeLines.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        html += `<pre class="bg-black/50 border border-white/8 rounded-xl p-4 my-3 overflow-x-auto text-xs font-mono text-emerald-300 leading-relaxed whitespace-pre"><code>${escaped}</code></pre>`
        inCode = false; codeLines = []
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

  return (
    <div className="text-sm leading-relaxed text-gray-300"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  )
}

// ── Animated typing dots (shown while streaming but no text yet) ────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0,1,2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400/70"
          style={{ animation: `aria-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────
function MessageBubble({
  msg, onCopy, onSend,
  userImageUrl, userName,
}: {
  msg: Message
  onCopy: (t: string) => void
  onSend: (t: string) => void
  userImageUrl?: string | null
  userName?: string | null
}) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'
  const copy = () => { onCopy(msg.content); setCopied(true); setTimeout(()=>setCopied(false),1800) }
  const showTypingDots = !isUser && msg.isStreaming && !msg.content && !msg.toolEvents?.some(t => t.status === 'running') && !msg.isThinking

  return (
    <div
      className={`flex gap-2 sm:gap-3 group aria-msg-in ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* ARIA avatar — Aiscern logo */}
      {!isUser && (
        <div className="mt-0.5 shrink-0">
          <AriaAvatar />
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[88%] sm:max-w-[82%] min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Attachments */}
        {msg.attachments?.map((att,i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-white/[0.06] max-w-[240px] sm:max-w-[280px]">
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
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-xs text-gray-500">
              <Ico.Spin />
              <span>Running {m?.label || te.tool}…</span>
            </div>
          )
        })}
        {/* Tool results */}
        {!isUser && msg.toolEvents?.filter(t=>t.status==='done'&&t.result).map((te,i) => (
          <ToolCard key={i} tool={te.tool} result={te.result} />
        ))}

        {/* FIX B.2: Thinking indicator — shown during NVIDIA NIM cold start (no tokens yet) */}
        {!isUser && msg.isThinking && !msg.content && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl rounded-bl-sm bg-[#131328] border border-white/[0.05] text-xs text-gray-500">
            <svg className="w-3 h-3 animate-spin text-primary/60 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-gray-500">Connecting to ARIA…</span>
          </div>
        )}

        {/* Typing dots while waiting for first token */}
        {showTypingDots && (
          <div className="rounded-2xl rounded-bl-sm bg-[#131328] border border-white/[0.05]">
            <TypingDots />
          </div>
        )}

        {/* Content bubble */}
        {(msg.content || (msg.isStreaming && msg.content)) && (
          <div className={`rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm ${
            isUser
              ? 'bg-gradient-to-br from-violet-600 to-blue-600 text-white rounded-br-sm shadow-lg shadow-violet-500/15'
              : 'bg-[#131328] border border-white/[0.05] rounded-bl-sm'
          }`}>
            {isUser
              ? <p className="leading-relaxed whitespace-pre-wrap text-white text-sm">{msg.content}</p>
              : <Markdown content={msg.content} />
            }
            {/* Blinking cursor while streaming */}
            {msg.isStreaming && msg.content && (
              <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle rounded-full" />
            )}
          </div>
        )}

        {/* Timestamp + copy */}
        <div className={`flex items-center gap-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[10px] text-gray-700 mt-0.5 px-1 select-none">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
          </span>
          {!isUser && !msg.isStreaming && msg.content && (
            <button onClick={copy} className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-400 transition-all px-2 py-1 rounded-lg hover:bg-white/5">
              {copied ? <Ico.Check /> : <Ico.Copy />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>

        {/* FIX B.7: Post-detection follow-up suggestion chips */}
        {!isUser && !msg.isStreaming && msg.toolEvents?.some(te => te.status === 'done') && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {[
              'What does this confidence score mean?',
              'How do I cite this result?',
              'Explain the key signals found',
              'Scan another piece of content',
            ].map(chip => (
              <button key={chip} onClick={() => onSend(chip)}
                className="text-xs px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-gray-400 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all">
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User avatar — Clerk profile photo or initials */}
      {isUser && (
        <UserAvatar imageUrl={userImageUrl} name={userName} />
      )}
    </div>
  )
}

// ── Welcome suggestions ────────────────────────────────────────────────────
const SUGGESTIONS = [
  { Ic: Ico.Image,    text: "Upload an image to detect if it's AI-generated or a deepfake",  cat: 'Image'   },
  { Ic: Ico.FileText, text: 'Paste text to check if it was written by AI',                    cat: 'Text'    },
  { Ic: Ico.Music,    text: 'How does ensemble detection work for voice cloning?',             cat: 'Audio'   },
  { Ic: Ico.Shield,   text: 'Who built Aiscern and what is it designed to do?',               cat: 'About'   },
  { Ic: Ico.Globe,    text: 'What makes Aiscern different from GPTZero and Turnitin?',        cat: 'Compare' },
  { Ic: Ico.DB,       text: "Show me Aiscern's current detection statistics",                 cat: 'Data'    },
]

// ── Main ───────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user } = useUser()
  const [chats, setChats]               = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string|null>(null)
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [attachments, setAttachments]   = useState<Attachment[]>([])
  const [abort, setAbort]               = useState<AbortController|null>(null)
  const [hydrated, setHydrated]         = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [showSearch, setShowSearch]     = useState(false)
  // FIX B.8: Voice input state
  const [isListening, setIsListening]   = useState(false)
  const recognitionRef = useRef<any>(null)
  const endRef       = useRef<HTMLDivElement>(null)
  const taRef        = useRef<HTMLTextAreaElement>(null)
  const fileRef      = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const activeChat   = chats.find(c=>c.id===activeChatId)

  // FIX B.8: Start/stop Web Speech API voice recognition
  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return   // browser doesn't support it — button hidden via feature detect

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const rec = new SpeechRecognition()
    rec.lang          = 'en-US'
    rec.interimResults = true
    rec.maxAlternatives = 1
    recognitionRef.current = rec

    rec.onstart  = () => setIsListening(true)
    rec.onend    = () => setIsListening(false)
    rec.onerror  = () => setIsListening(false)
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results as SpeechRecognitionResultList)
        .map((r: any) => r[0].transcript)
        .join('')
      setInput(transcript)
      // Auto-submit on final result
      if (e.results[e.results.length - 1].isFinal) {
        rec.stop()
        setTimeout(() => send(transcript), 100)
      }
    }
    rec.start()
  }, [isListening])

  useEffect(() => {
    const saved = loadChats()
    if (saved.length > 0) { setChats(saved); setActiveChatId(saved[0].id) }
    setHydrated(true)
  }, [])

  // Fix 4.1: iOS keyboard avoidance — visualViewport shrinks when keyboard opens
  // Without this, the keyboard covers the chat input on iPhone Safari
  useEffect(() => {
    const handleResize = () => {
      const vv = window.visualViewport
      if (vv && chatContainerRef.current) {
        chatContainerRef.current.style.height = `${vv.height}px`
      }
    }
    window.visualViewport?.addEventListener('resize', handleResize)
    return () => window.visualViewport?.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => { if (!hydrated) return; saveChats(chats) }, [chats, hydrated])
  useEffect(() => { endRef.current?.scrollIntoView({behavior:'smooth'}) }, [activeChat?.messages.length, activeChat?.messages[activeChat?.messages.length-1]?.content?.length])

  useEffect(() => {
    const ta = taRef.current; if (!ta) return
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
    setChats([]); setActiveChatId(null); localStorage.removeItem(STORAGE_KEY)
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
      const currentChat = chats.find(c=>c.id===chatId)
      const prevMessages = (currentChat?.messages||[]).filter(m=>m.id!==userMsg.id)
      const history = [...prevMessages, userMsg]
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
      if (unsupportedAtts?.length) {
        setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{
          ...m,
          content:`⚠️ Note: Audio/video files can't be analyzed directly in chat. Please use the dedicated [Audio](/detect/audio) or [Video](/detect/video) detection tools.\n\n`,
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
              // FIX B.2: 'thinking' event sets isThinking flag; cleared on first 'text' chunk
              if(ev.type==='thinking')    setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,isThinking:true}:m)}:c))
              if(ev.type==='text')        setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,isThinking:false,content:m.content+ev.text}:m)}:c))
              if(ev.type==='tool_result') setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,toolEvents:[...(m.toolEvents||[]).filter(t=>t.tool!==ev.tool),{tool:ev.tool,status:'done',result:ev.result}]}:m)}:c))
              if(ev.type==='done')        setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,isThinking:false,isStreaming:false}:m),updatedAt:now()}:c))
            }catch(_){ /* skip malformed SSE */ }
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

  const userImageUrl = user?.imageUrl
  const userName     = user?.fullName || user?.firstName || user?.username

  return (
    <>
    <div ref={chatContainerRef} className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-[#09090f]">

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 z-20 lg:hidden" onClick={()=>setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed lg:relative z-30 lg:z-auto w-[15.5rem] sm:w-[17rem] h-full flex flex-col
        bg-[#0c0c1a] border-r border-white/[0.06] transition-transform duration-[260ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]
        ${sidebarOpen?'translate-x-0':'-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-3 pt-[calc(1rem+env(safe-area-inset-top,0px))] border-b border-white/[0.06] space-y-2">
          <button onClick={newChat} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all shadow-lg shadow-violet-500/20">
            <Ico.Plus /><span>New conversation</span>
          </button>
          <button onClick={()=>setShowSearch(s=>!s)} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-600 hover:text-gray-300 hover:bg-white/[0.04] text-xs transition-all">
            <Ico.Search /><span>Search conversations</span>
          </button>
          {showSearch && (
            <input
              value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              placeholder="Search…" autoFocus
              className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.06] text-xs text-gray-300 placeholder:text-gray-700 outline-none focus:border-violet-500/40"
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
                activeChatId===c.id ? 'bg-white/8 text-white border border-white/[0.07]' : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.04]'
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
        <header className="shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-[52px] sm:h-14 border-b border-white/[0.06] bg-[#09090f]/80 backdrop-blur-xl">
          <button onClick={()=>setSidebarOpen(s=>!s)} className="lg:hidden p-2 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors shrink-0">
            <Ico.Menu />
          </button>
          {/* ARIA header — Aiscern logo */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-black border border-white/[0.06] flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0 overflow-hidden">
              <Image src="/logo.png" alt="ARIA" width={22} height={22} className="object-contain drop-shadow-[0_0_6px_rgba(245,100,0,0.7)]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white leading-none truncate">ARIA <span className="text-gray-600 font-normal text-xs ml-1">by Aiscern</span></div>
              <div className="text-xs text-gray-600 mt-0.5 hidden sm:block">
                {activeChat ? `${activeChat.messages.length} messages · ${activeChat.title.slice(0,40)}` : 'Multi-modal · Tool-enabled · AI detection specialist'}
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
                const icons = { Text:Ico.FileText, Image:Ico.Image, Audio:Ico.Music, Video:Ico.Video }
                const I = icons[l]
                return (
                  <div key={l} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-white/[0.04] text-gray-600 border border-white/[0.06]">
                    <span className="text-gray-500"><I /></span>
                    <span className="hidden md:inline">{l}</span>
                  </div>
                )
              })}
            </div>
            {/* User avatar in header */}
            {user && (
              <div className="ml-1">
                <UserAvatar imageUrl={userImageUrl} name={userName} size="sm" />
              </div>
            )}
          </div>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {!activeChat || activeChat.messages.length===0 ? (
            <div className="min-h-full flex flex-col items-center justify-center px-4 py-5 max-w-2xl mx-auto w-full">
              {/* Welcome logo — BLACK bg with Aiscern logo */}
              <div className="relative mb-3 shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-black border border-white/[0.06] flex items-center justify-center shadow-2xl shadow-violet-500/20 overflow-hidden">
                  <Image src="/logo.png" alt="ARIA" width={30} height={30} className="object-contain drop-shadow-[0_0_10px_rgba(245,100,0,0.9)]" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#09090f] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse" />
                </div>
              </div>

              <h1 className="text-2xl font-black text-white mb-0.5 tracking-tight">ARIA</h1>
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.15em] mb-2">Aiscern AI Detection Assistant</p>
              <p className="text-gray-600 text-xs sm:text-sm text-center mb-4 max-w-sm leading-relaxed">
                Ask anything about AI detection, upload media for deepfake analysis, or explore Aiscern's capabilities.
              </p>

              <div className="hidden xs:flex flex-wrap justify-center gap-1.5 mb-3">
                {[['Text Detection',Ico.FileText],['Deepfake Analysis',Ico.Image],['Voice Cloning',Ico.Music],['Video Deepfakes',Ico.Video],['General Q&A',Ico.Globe],['Dataset Insights',Ico.DB]].map(([l,I])=>{
                  const Icon = I as ()=>React.ReactElement
                  return (
                    <div key={l as string} className="flex items-center gap-1 px-2 py-1 rounded-full border border-white/8 bg-white/[0.02] text-[11px] text-gray-500">
                      <span className="opacity-50" style={{transform:'scale(0.8)'}}><Icon /></span>
                      <span>{l as string}</span>
                    </div>
                  )
                })}
              </div>

              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {SUGGESTIONS.map(({Ic: I, text, cat})=>(
                  <button key={text} onClick={()=>send(text)}
                    className="flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.06] hover:border-violet-500/20 text-left transition-all group cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-violet-500/10 text-violet-400/70 flex items-center justify-center shrink-0 group-hover:bg-violet-500/20 transition-colors mt-0.5">
                      <I />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5">{cat}</div>
                      <div className="text-xs text-gray-400 leading-relaxed">{text}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full px-2 sm:px-4 py-3 sm:py-6 space-y-3 sm:space-y-6">
              {activeChat.messages.map(msg=>(
                <MessageBubble
                  key={msg.id} msg={msg}
                  onCopy={t=>navigator.clipboard?.writeText(t)}
                  onSend={t=>{ setInput(t); setTimeout(()=>send(t), 0) }}
                  userImageUrl={userImageUrl}
                  userName={userName}
                />
              ))}
              <div ref={endRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#09090f]/80 backdrop-blur-xl px-3 sm:px-4 py-3 sm:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <div className="max-w-3xl mx-auto">

            {attachments.length>0 && (
              <div className="flex flex-wrap gap-2 mb-2.5">
                {attachments.map((a,i)=>(
                  <div key={i} className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-gray-500 max-w-[180px]">
                    {a.type.startsWith('image/') ? <Ico.Image /> : a.type.startsWith('audio/') ? <Ico.Music /> : a.type.startsWith('video/') ? <Ico.Video /> : <Ico.FileText />}
                    <span className="truncate">{a.name}</span>
                    <button onClick={()=>setAttachments(p=>p.filter((_,j)=>j!==i))} className="hover:text-red-400 transition-colors ml-0.5 shrink-0"><Ico.Close /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-1.5 sm:gap-2 px-2 py-2 rounded-2xl border border-white/[0.07] bg-[#111128] focus-within:border-violet-500/40 focus-within:shadow-lg focus-within:shadow-violet-500/8 transition-all">
              <button onClick={()=>fileRef.current?.click()}
                className="p-2 rounded-xl text-gray-700 hover:text-gray-400 hover:bg-white/8 transition-colors shrink-0 mb-0.5"
                title="Attach image, audio or video">
                <Ico.Clip />
              </button>
              <input ref={fileRef} type="file" className="hidden" multiple accept="image/*,audio/*,video/*,.txt,.pdf"
                onChange={e=>handleFiles(e.target.files)} />

              {/* FIX B.8: Voice input — hidden if Web Speech API unavailable */}
              {typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) && (
                <button onClick={toggleVoice}
                  title={isListening ? 'Stop recording' : 'Voice input'}
                  className={`p-2 rounded-xl transition-all shrink-0 mb-0.5 ${
                    isListening
                      ? 'text-rose-400 bg-rose-500/15 animate-pulse'
                      : 'text-gray-700 hover:text-gray-400 hover:bg-white/8'
                  }`}>
                  <Ico.Mic />
                </button>
              )}

              <textarea
                ref={taRef} value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}
                placeholder={isListening ? 'Listening…' : 'Ask anything, or upload media to analyze…'}
                rows={1}
                inputMode="text"
                enterKeyHint="send"
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
      <LazyReviewSuggestion toolName="AI Detection Assistant" />
    </div>
  </>
  )
}
