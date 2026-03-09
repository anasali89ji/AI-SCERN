'use client'
export const dynamic = 'force-dynamic'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'

// ── Inline SVG Icon System (HD, no emoji) ──────────────────────────────────
const SendIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
const PlusIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>
const TrashIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
const CopyIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
const CheckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M20 6 9 17l-5-5"/></svg>
const MenuIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
const CloseIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
const ChatIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
const BrainIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.98-3 2.5 2.5 0 0 1-1.32-4.24 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.1-2.88"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.98-3 2.5 2.5 0 0 0 1.32-4.24 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.1-2.88"/></svg>
const ShieldIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const ImageIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
const FileTextIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/></svg>
const MusicIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
const VideoIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>
const PaperclipIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
const StopIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
const SpinnerIcon = () => <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin"><circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
const GlobeIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
const ChevronRightIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="m9 18 6-6-6-6"/></svg>
const DatabaseIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>
const ScanIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="7" height="5" x="7" y="7" rx="1"/><rect width="7" height="5" x="10" y="12" rx="1"/></svg>

// ── Types ──────────────────────────────────────────────────────────────────
interface Attachment { name: string; type: string; data: string; preview?: string; size: number }
interface ToolEvent  { tool: string; status: 'running' | 'done'; result?: any }
interface Message    { id: string; role: 'user'|'assistant'; content: string; timestamp: Date; attachments?: Attachment[]; toolEvents?: ToolEvent[]; isStreaming?: boolean }
interface Chat       { id: string; title: string; messages: Message[]; createdAt: Date }

// ── Tool meta ──────────────────────────────────────────────────────────────
const TOOL_META: Record<string,{label:string;color:string;Icon:()=>JSX.Element}> = {
  detect_text:  { label:'Text Analysis',  color:'#7c3aed', Icon:FileTextIcon },
  detect_image: { label:'Image Analysis', color:'#2563eb', Icon:ImageIcon    },
  detect_audio: { label:'Audio Analysis', color:'#0891b2', Icon:MusicIcon    },
  detect_video: { label:'Video Analysis', color:'#059669', Icon:VideoIcon    },
  analyze_url:  { label:'URL Analysis',   color:'#d97706', Icon:GlobeIcon    },
}

// ── Markdown ───────────────────────────────────────────────────────────────
function Markdown({ content }: { content: string }) {
  const html = content
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-black/40 border border-white/8 rounded-xl p-4 my-3 overflow-x-auto text-xs font-mono text-emerald-300 leading-relaxed whitespace-pre"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 text-xs font-mono">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-white mt-5 mb-1.5 tracking-wide">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-white mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-white mt-5 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-gray-300 italic">$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="flex gap-2.5 items-start py-0.5"><span class="mt-2 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0 block"></span><span>$1</span></li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="flex gap-2.5 items-start py-0.5"><span class="text-violet-400 font-mono text-xs mt-0.5 shrink-0 w-4">$1.</span><span>$2</span></li>')
    .replace(/(<li.*?<\/li>\n?)+/gs, '<ul class="space-y-0.5 my-2">$&</ul>')
    .replace(/\n\n/g, '</p><p class="mt-2 text-gray-300 leading-relaxed">')
    .replace(/\n/g, '<br/>')
  return (
    <div className="text-sm leading-relaxed text-gray-300 [&_ul]:ml-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
      dangerouslySetInnerHTML={{ __html: `<p class="mt-0 text-gray-300 leading-relaxed">${html}</p>` }}
    />
  )
}

// ── Tool result card ───────────────────────────────────────────────────────
function ToolCard({ tool, result }: { tool: string; result: any }) {
  const [open, setOpen] = useState(false)
  const meta = TOOL_META[tool] || { label: tool, color: '#6b7280', Icon: ScanIcon }
  const { Icon: TIcon } = meta
  const verdict = result?.verdict || result?.result || 'Analysis complete'
  const conf = result?.confidence_pct ?? result?.confidence
  const bad = verdict?.toLowerCase().match(/ai-|deepfake|synthetic|clone/)

  return (
    <div className="my-3 rounded-xl border overflow-hidden" style={{ borderColor:`${meta.color}28`, background:`${meta.color}07` }}>
      <button
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/4 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background:`${meta.color}18`, color:meta.color }}>
            <TIcon />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color:`${meta.color}cc` }}>{meta.label}</div>
            <div className="text-sm font-bold text-white mt-0.5 truncate">{verdict}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {conf != null && (
            <div className="text-right">
              <div className="text-xs text-gray-600">Confidence</div>
              <div className="text-xl font-black tabular-nums" style={{ color: bad ? '#f87171' : '#34d399' }}>{conf}%</div>
            </div>
          )}
          <div className={`text-gray-600 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}><ChevronRightIcon /></div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t" style={{ borderColor:`${meta.color}18` }}>
          <div className="mt-3 space-y-3">
            {Object.entries(result || {}).map(([k, v]) => {
              if (['verdict','result','confidence_pct','confidence'].includes(k)) return null
              if (v === null || v === undefined) return null
              const label = k.replace(/_/g, ' ')
              if (typeof v === 'object' && !Array.isArray(v)) return (
                <div key={k}>
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">{label}</div>
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
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">{label}</div>
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
                  <span className="text-gray-600 capitalize">{label}</span>
                  <span className="text-gray-300 font-medium text-right">{String(v)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Message ────────────────────────────────────────────────────────────────
function MessageBubble({ msg, onCopy }: { msg: Message; onCopy: (t:string)=>void }) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'

  const copy = () => { onCopy(msg.content); setCopied(true); setTimeout(()=>setCopied(false),1800) }

  return (
    <div className={`flex gap-3 group ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-violet-500/20">
          <BrainIcon />
        </div>
      )}

      <div className={`flex flex-col gap-1.5 max-w-[82%] min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>

        {/* Attachments */}
        {msg.attachments?.map((att,i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-white/10 max-w-[280px]">
            {att.type.startsWith('image/') && att.preview
              ? <img src={att.preview} alt={att.name} className="max-h-48 object-cover w-full" />
              : <div className="flex items-center gap-2 px-3 py-2 bg-white/5 text-xs text-gray-400"><PaperclipIcon />{att.name}</div>
            }
          </div>
        ))}

        {/* Tool events */}
        {!isUser && msg.toolEvents?.filter(t=>t.status==='running').map((te,i) => {
          const m = TOOL_META[te.tool]
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-xs text-gray-500">
              <SpinnerIcon />
              <span>Running {m?.label || te.tool}…</span>
            </div>
          )
        })}
        {!isUser && msg.toolEvents?.filter(t=>t.status==='done'&&t.result).map((te,i) => (
          <ToolCard key={i} tool={te.tool} result={te.result} />
        ))}

        {/* Content bubble */}
        {(msg.content || msg.isStreaming) && (
          <div className={`rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? 'bg-gradient-to-br from-violet-600 to-blue-600 text-white rounded-br-sm shadow-lg shadow-violet-500/15'
              : 'bg-[#131328] border border-white/8 rounded-bl-sm'
          }`}>
            {isUser
              ? <p className="leading-relaxed whitespace-pre-wrap text-white">{msg.content}</p>
              : <Markdown content={msg.content} />
            }
            {msg.isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle rounded-full" />
            )}
          </div>
        )}

        {/* Copy */}
        {!isUser && !msg.isStreaming && msg.content && (
          <button
            onClick={copy}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-400 transition-all px-2 py-1 rounded-lg hover:bg-white/5"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-gray-400 text-xs font-bold">
          U
        </div>
      )}
    </div>
  )
}

// ── Welcome suggestions ────────────────────────────────────────────────────
const SUGGESTIONS = [
  { Icon: ImageIcon,    text: 'Upload an image — detect if it\'s AI-generated or a deepfake', cat: 'Image' },
  { Icon: FileTextIcon, text: 'Paste text to check if it was written by AI',                  cat: 'Text'  },
  { Icon: MusicIcon,    text: 'How do forensic tools detect voice cloning?',                  cat: 'Audio' },
  { Icon: BrainIcon,    text: 'Explain GAN fingerprinting and how it works',                  cat: 'Learn' },
  { Icon: ShieldIcon,   text: 'What makes DETECTAI different from GPTZero?',                  cat: 'Compare'},
  { Icon: DatabaseIcon, text: 'Tell me about the 60-source training dataset',                 cat: 'Data'  },
]

// ── Main ──────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string|null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [abort, setAbort] = useState<AbortController|null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const activeChat = chats.find(c=>c.id===activeChatId)

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}) }, [activeChat?.messages])

  useEffect(()=>{
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`
  }, [input])

  const newChat = useCallback(()=>{
    const id = `c${Date.now()}`
    setChats(p=>[{ id, title:'New conversation', messages:[], createdAt:new Date() }, ...p])
    setActiveChatId(id); setSidebarOpen(false); setInput(''); setAttachments([])
  },[])

  const delChat = useCallback((id:string)=>{
    setChats(p=>p.filter(c=>c.id!==id))
    if (activeChatId===id) setActiveChatId(null)
  },[activeChatId])

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
      const nc: Chat = { id, title:content.slice(0,50)||'New conversation', messages:[], createdAt:new Date() }
      setChats(p=>[nc,...p]); setActiveChatId(id); chatId=id
    }

    const userMsg: Message = { id:`m${Date.now()}`, role:'user', content, timestamp:new Date(), attachments:attachments.length?[...attachments]:undefined }
    setChats(p=>p.map(c=>c.id===chatId?{...c, title:c.messages.length===0?content.slice(0,50):c.title, messages:[...c.messages, userMsg]}:c))
    setInput(''); setAttachments([]); setLoading(true)

    const aid = `m${Date.now()+1}`
    const assistMsg: Message = { id:aid, role:'assistant', content:'', timestamp:new Date(), toolEvents:[], isStreaming:true }
    setChats(p=>p.map(c=>c.id===chatId?{...c,messages:[...c.messages,assistMsg]}:c))

    const ac = new AbortController(); setAbort(ac)

    try {
      const history = [...(chats.find(c=>c.id===chatId)?.messages||[]), userMsg]
      const res = await fetch('/api/chat',{
        method:'POST', signal:ac.signal,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          messages: history.map(m=>({role:m.role,content:m.content})),
          attachments: userMsg.attachments?.map(a=>({type:a.type,data:a.data,name:a.name})),
        }),
      })
      if (!res.ok) throw new Error(`${res.status}`)

      const ct = res.headers.get('content-type')||''
      if (ct.includes('application/json')) {
        const d = await res.json()
        setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,content:d.text||'No response.',isStreaming:false}:m)}:c))
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
            try{
              const ev = JSON.parse(line.slice(6))
              if(ev.type==='text') setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,content:m.content+ev.text}:m)}:c))
              if(ev.type==='tool_start'||ev.type==='tool_running') setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,toolEvents:[...(m.toolEvents||[]).filter(t=>!(t.tool===ev.tool&&t.status==='running')),{tool:ev.tool,status:'running'}]}:m)}:c))
              if(ev.type==='tool_result') setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,toolEvents:[...(m.toolEvents||[]).filter(t=>t.tool!==ev.tool),{tool:ev.tool,status:'done',result:ev.result}]}:m)}:c))
              if(ev.type==='done') setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,isStreaming:false}:m)}:c))
            }catch(_){}
          }
        }
      }
    } catch(e:any){
      if(e?.name!=='AbortError') setChats(p=>p.map(c=>c.id===chatId?{...c,messages:c.messages.map(m=>m.id===aid?{...m,content:'An error occurred. Please try again.',isStreaming:false}:m)}:c))
    } finally { setLoading(false); setAbort(null) }
  },[input,attachments,activeChatId,chats,loading])

  const stop=()=>{
    abort?.abort(); setLoading(false)
    setChats(p=>p.map(c=>c.id===activeChatId?{...c,messages:c.messages.map(m=>m.isStreaming?{...m,isStreaming:false}:m)}:c))
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[#09090f]">

      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/70 z-20 lg:hidden" onClick={()=>setSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed lg:relative z-30 lg:z-auto w-[17rem] h-full flex flex-col
        bg-[#0c0c1a] border-r border-white/[0.06] transition-transform duration-300
        ${sidebarOpen?'translate-x-0':'-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-3 pt-4">
          <button onClick={newChat} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all shadow-lg shadow-violet-500/20">
            <PlusIcon /><span>New conversation</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {chats.length===0 && (
            <p className="text-xs text-gray-700 text-center py-10 px-4 leading-relaxed">Start a conversation to see it listed here</p>
          )}
          {chats.map(c=>(
            <div key={c.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                activeChatId===c.id ? 'bg-white/8 text-white border border-white/10' : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.04]'
              }`}
              onClick={()=>{setActiveChatId(c.id);setSidebarOpen(false)}}
            >
              <ChatIcon />
              <span className="flex-1 truncate">{c.title}</span>
              <button onClick={e=>{e.stopPropagation();delChat(c.id)}} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all rounded"><TrashIcon /></button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            All systems operational
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] bg-[#09090f]/80 backdrop-blur-xl">
          <button onClick={()=>setSidebarOpen(s=>!s)} className="lg:hidden p-2 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors"><MenuIcon /></button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0"><BrainIcon /></div>
            <div>
              <div className="text-sm font-bold text-white leading-none">DETECTAI Assistant</div>
              <div className="text-xs text-gray-600 mt-0.5">Multi-modal · Tool-enabled · General knowledge</div>
            </div>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-1.5">
            {[['Text',<FileTextIcon />],['Image',<ImageIcon />],['Audio',<MusicIcon />],['Video',<VideoIcon />]].map(([l,I])=>(
              <div key={l as string} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-gray-600 border border-white/[0.06]">
                <span className="text-gray-500">{I as JSX.Element}</span>{l as string}
              </div>
            ))}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!activeChat || activeChat.messages.length===0 ? (
            /* Welcome */
            <div className="h-full flex flex-col items-center justify-center px-4 py-8 max-w-2xl mx-auto w-full">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center mb-5 shadow-2xl shadow-violet-500/25">
                <BrainIcon />
              </div>
              <h1 className="text-2xl font-black text-white mb-2 tracking-tight">DETECTAI Assistant</h1>
              <p className="text-gray-600 text-sm text-center mb-8 max-w-sm leading-relaxed">
                General-purpose AI with deep expertise in content detection. Ask anything or upload media to analyze.
              </p>

              {/* Capability row */}
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {[
                  ['AI Text Detection',<FileTextIcon />],
                  ['Deepfake Analysis',<ImageIcon />],
                  ['Voice Clone Detection',<MusicIcon />],
                  ['Video Deepfakes',<VideoIcon />],
                  ['General Questions',<GlobeIcon />],
                  ['Dataset Insights',<DatabaseIcon />],
                ].map(([l,I])=>(
                  <div key={l as string} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-xs text-gray-500">
                    <span className="opacity-60">{I as JSX.Element}</span>{l as string}
                  </div>
                ))}
              </div>

              {/* Suggestions grid */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map(({Icon:I,text,cat})=>(
                  <button key={text} onClick={()=>send(text)}
                    className="flex items-start gap-3 p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.07] hover:border-violet-500/25 text-left transition-all group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-violet-500/12 text-violet-400/80 flex items-center justify-center shrink-0 group-hover:bg-violet-500/20 transition-colors"><I /></div>
                    <div>
                      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">{cat}</div>
                      <div className="text-xs text-gray-400 leading-relaxed">{text}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
              {activeChat.messages.map(msg=>(
                <MessageBubble key={msg.id} msg={msg} onCopy={t=>navigator.clipboard.writeText(t)} />
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#09090f]/80 backdrop-blur-xl p-4">
          <div className="max-w-3xl mx-auto">

            {/* Attachment previews */}
            {attachments.length>0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachments.map((a,i)=>(
                  <div key={i} className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/6 border border-white/10 text-xs text-gray-500">
                    {a.type.startsWith('image/') ? <ImageIcon /> : a.type.startsWith('audio/') ? <MusicIcon /> : a.type.startsWith('video/') ? <VideoIcon /> : <FileTextIcon />}
                    <span className="max-w-[120px] truncate">{a.name}</span>
                    <button onClick={()=>setAttachments(p=>p.filter((_,j)=>j!==i))} className="hover:text-red-400 transition-colors ml-0.5"><CloseIcon /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Input box */}
            <div className="flex items-end gap-2 px-2 py-2 rounded-2xl border border-white/10 bg-[#111128] focus-within:border-violet-500/40 focus-within:shadow-lg focus-within:shadow-violet-500/8 transition-all">
              <button onClick={()=>fileRef.current?.click()} className="p-2 rounded-xl text-gray-700 hover:text-gray-400 hover:bg-white/8 transition-colors shrink-0 mb-0.5" title="Attach file"><PaperclipIcon /></button>
              <input ref={fileRef} type="file" className="hidden" multiple accept="image/*,audio/*,video/*,.txt,.pdf" onChange={e=>handleFiles(e.target.files)} />

              <textarea
                ref={taRef} value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}
                placeholder="Ask anything, or upload media to analyze…"
                rows={1}
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder:text-gray-700 resize-none outline-none leading-relaxed py-2 min-h-[36px] max-h-[180px]"
              />

              {loading
                ? <button onClick={stop} className="p-2 rounded-xl bg-red-500/12 text-red-400 hover:bg-red-500/20 transition-colors shrink-0 mb-0.5" title="Stop"><StopIcon /></button>
                : <button onClick={()=>send()} disabled={!input.trim()&&!attachments.length} className="p-2 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-white disabled:opacity-25 hover:opacity-90 active:scale-95 transition-all shrink-0 mb-0.5 shadow-lg shadow-violet-500/20"><SendIcon /></button>
              }
            </div>

            <p className="text-center text-xs text-gray-800 mt-2 select-none">
              Shift+Enter for new line · Supports image, audio, video files up to 20 MB
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
