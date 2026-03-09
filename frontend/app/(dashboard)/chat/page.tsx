'use client'
export const dynamic = 'force-dynamic'
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/components/auth-provider'
import {
  Send, Plus, Shield, Brain, Trash2, MessageSquare,
  ChevronRight, Sparkles, Database, FileText, Image as Img,
  Music, Video, Globe, Copy, Check, RotateCcw, Menu, X
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────
interface Message { id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }
interface Chat { id: string; title: string; messages: Message[]; createdAt: Date }

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `## Welcome to DETECTAI Assistant 👋

I'm your expert guide to **AI content detection**. I'm trained on DETECTAI's 285,000+ sample dataset from 60+ sources.

**What I can help with:**
- How to detect AI-generated text, images, audio & video
- Explaining deepfake techniques and how we catch them
- Technical details about our detection models
- Questions about synthetic media and AI generation

**Try asking:**`,
  timestamp: new Date()
}

const SUGGESTIONS = [
  { icon: '🔍', text: 'How does deepfake detection work?' },
  { icon: '📝', text: 'How can I tell if text is AI-written?' },
  { icon: '🎤', text: 'What is voice cloning and how to detect it?' },
  { icon: '📊', text: 'Tell me about the DETECTAI dataset' },
]

// ── Markdown renderer (simple) ─────────────────────────────────────────────
function MarkdownContent({ content }: { content: string }) {
  const html = content
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-text-primary mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-text-primary mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-text-primary mt-4 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-text-primary font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-xs font-mono">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary hover:underline">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="flex gap-2 items-start"><span class="text-primary mt-1.5 text-xs">▸</span><span>$1</span></li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="space-y-1.5 my-2">$&</ul>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>')
  return (
    <div className="prose-sm max-w-none text-text-secondary leading-relaxed text-sm"
      dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${html}</p>` }} />
  )
}

// ── CopyButton ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="p-1.5 rounded-lg hover:bg-white/5 text-text-disabled hover:text-text-muted transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ── Main Chat Page ──────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user } = useAuth()
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeChat = chats.find(c => c.id === activeChatId)
  const messages = activeChat?.messages ?? [WELCOME_MSG]

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const newChat = useCallback(() => {
    const id = `chat-${Date.now()}`
    const chat: Chat = { id, title: 'New chat', messages: [], createdAt: new Date() }
    setChats(prev => [chat, ...prev])
    setActiveChatId(id)
    setMobileSidebar(false)
  }, [])

  const deleteChat = useCallback((id: string) => {
    setChats(prev => prev.filter(c => c.id !== id))
    if (activeChatId === id) setActiveChatId(null)
  }, [activeChatId])

  const autoResize = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'
  }

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || input).trim()
    if (!content || isStreaming) return

    // Ensure we have a chat
    let chatId = activeChatId
    if (!chatId) {
      chatId = `chat-${Date.now()}`
      const newC: Chat = { id: chatId, title: content.slice(0, 40) || 'New chat', messages: [], createdAt: new Date() }
      setChats(prev => [newC, ...prev])
      setActiveChatId(chatId)
    }

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content, timestamp: new Date() }
    const aiMsgId = `a-${Date.now()}`
    const aiMsg: Message = { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date() }

    setChats(prev => prev.map(c => c.id === chatId
      ? { ...c, messages: [...c.messages, userMsg, aiMsg], title: c.messages.length === 0 ? content.slice(0, 40) : c.title }
      : c
    ))
    setInput('')
    setIsStreaming(true)
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }

    try {
      const allMsgs = [...(chats.find(c => c.id === chatId)?.messages || []), userMsg]
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMsgs.map(m => ({ role: m.role, content: m.content })) }),
        signal: ctrl.signal,
      })

      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('text/event-stream')) {
        // Streaming
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  accumulated += parsed.text
                  setChats(prev => prev.map(c => c.id === chatId
                    ? { ...c, messages: c.messages.map(m => m.id === aiMsgId ? { ...m, content: accumulated } : m) }
                    : c
                  ))
                }
              } catch {}
            }
          }
        }
      } else {
        // JSON fallback
        const data = await res.json()
        const text = data.text || 'Sorry, I could not generate a response.'
        setChats(prev => prev.map(c => c.id === chatId
          ? { ...c, messages: c.messages.map(m => m.id === aiMsgId ? { ...m, content: text } : m) }
          : c
        ))
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setChats(prev => prev.map(c => c.id === chatId
          ? { ...c, messages: c.messages.map(m => m.id === aiMsgId ? { ...m, content: 'Sorry, I encountered an error. Please try again.' } : m) }
          : c
        ))
      }
    } finally {
      setIsStreaming(false)
    }
  }, [input, activeChatId, chats, isStreaming])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const stopStreaming = () => { abortRef.current?.abort(); setIsStreaming(false) }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border/50">
        <button onClick={newChat}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-sm font-medium text-text-primary group">
          <Plus className="w-4 h-4 group-hover:text-primary transition-colors" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {chats.length === 0 ? (
          <div className="p-4 text-center text-xs text-text-disabled">No chats yet — start a conversation!</div>
        ) : chats.map(chat => (
          <div key={chat.id}
            onClick={() => { setActiveChatId(chat.id); setMobileSidebar(false) }}
            className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm ${activeChatId === chat.id ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:bg-surface-active hover:text-text-primary'}`}>
            <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-60" />
            <span className="truncate flex-1">{chat.title || 'New chat'}</span>
            <button onClick={(e) => { e.stopPropagation(); deleteChat(chat.id) }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose/20 hover:text-rose transition-all flex-shrink-0">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border/50 space-y-2">
        <div className="flex items-center gap-2 px-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-[10px] font-bold">
            {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-secondary truncate">{user?.displayName || user?.email?.split('@')[0] || 'User'}</p>
            <p className="text-[10px] text-emerald">● Online</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* ── Desktop Sidebar ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="hidden lg:flex flex-col bg-surface border-r border-border overflow-hidden flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-black gradient-text">DETECTAI Chat</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-surface-active transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile Sidebar ── */}
      <AnimatePresence>
        {mobileSidebar && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMobileSidebar(false)} />
            <motion.div initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 bg-surface border-r border-border z-50 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <span className="text-sm font-black gradient-text">DETECTAI Chat</span>
                <button onClick={() => setMobileSidebar(false)} className="text-text-muted p-1"><X className="w-4 h-4" /></button>
              </div>
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-surface/50 flex-shrink-0">
          <button onClick={() => sidebarOpen ? setSidebarOpen(false) : (window.innerWidth < 1024 ? setMobileSidebar(true) : setSidebarOpen(true))}
            className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-active transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            <span className="text-sm font-semibold text-text-primary">DETECTAI Assistant</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-text-muted hidden sm:block">Powered by DETECTAI · 285k+ dataset</span>
            <button onClick={newChat} className="text-text-muted hover:text-primary p-1.5 rounded-lg hover:bg-surface-active transition-colors" title="New chat">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.length === 0 || (messages.length === 1 && messages[0].id === 'welcome') ? (
              /* Welcome state */
              <div className="space-y-6">
                <div className="text-center pt-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/30">
                    <Brain className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-black gradient-text mb-2">DETECTAI Assistant</h2>
                  <p className="text-text-muted text-sm max-w-md mx-auto">Expert in AI content detection, deepfakes, and synthetic media. Trained on 285k+ samples.</p>
                </div>

                {messages[0]?.content && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Brain className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <MarkdownContent content={messages[0].content} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s.text)}
                      className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/40 bg-surface hover:bg-primary/5 transition-all text-left group">
                      <span className="text-xl">{s.icon}</span>
                      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{s.text}</span>
                      <ChevronRight className="w-4 h-4 text-text-disabled group-hover:text-primary ml-auto flex-shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: FileText, label: 'Text', href: '/detect/text', color: 'text-amber' },
                    { icon: Img, label: 'Image', href: '/detect/image', color: 'text-primary' },
                    { icon: Music, label: 'Audio', href: '/detect/audio', color: 'text-cyan' },
                    { icon: Video, label: 'Video', href: '/detect/video', color: 'text-secondary' },
                  ].map((tool, i) => (
                    <a key={i} href={tool.href}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-primary/30 bg-surface hover:bg-surface-active transition-all text-center">
                      <tool.icon className={`w-5 h-5 ${tool.color}`} />
                      <span className="text-xs text-text-muted">{tool.label} Detector</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              /* Message list */
              messages.map((msg, idx) => (
                <AnimatePresence key={msg.id}>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {msg.role === 'assistant' ? (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-primary/20">
                        <Brain className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-bold text-text-secondary">
                        {user?.displayName?.[0] || 'U'}
                      </div>
                    )}

                    <div className={`max-w-[85%] min-w-0 group ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {msg.role === 'user' ? (
                        <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-primary/15 border border-primary/20 text-sm text-text-primary leading-relaxed">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-surface border border-border/50 min-w-[120px]">
                          {msg.content ? (
                            <MarkdownContent content={msg.content} />
                          ) : (
                            <div className="flex gap-1 py-1">
                              {[0,1,2].map(i => (
                                <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60"
                                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                                  transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {msg.content && (
                        <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <CopyButton text={msg.content} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-border/50 bg-background/90 backdrop-blur-xl p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-3 p-3 rounded-2xl border border-border focus-within:border-primary/50 bg-surface transition-all shadow-lg shadow-black/20">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize() }}
                onKeyDown={handleKey}
                placeholder="Ask about AI detection, deepfakes, synthetic media…"
                rows={1}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-disabled resize-none focus:outline-none py-1 max-h-[180px] leading-relaxed"
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                {isStreaming ? (
                  <button onClick={stopStreaming}
                    className="w-8 h-8 rounded-xl bg-rose/20 border border-rose/30 hover:bg-rose/30 text-rose flex items-center justify-center transition-all">
                    <span className="w-3 h-3 rounded-sm bg-rose" />
                  </button>
                ) : (
                  <button onClick={() => sendMessage()} disabled={!input.trim()}
                    className="w-8 h-8 rounded-xl bg-primary hover:bg-primary/80 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-md shadow-primary/30 active:scale-95">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-center text-xs text-text-disabled mt-2">
              DETECTAI Assistant · Knowledge from 285k+ samples · <span className="text-primary">Always verify important information</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
