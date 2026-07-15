'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { useChatStore } from '@/components/chat/useChatStore'
import { queryAriaRag, buildSystemPrompt } from '@/lib/rag/aria-rag'
import { toUserError } from '@/lib/utils/user-errors'

export default function ChatPage() {
  const router = useRouter()
  const { user } = useUser()
  const {
    chats,
    activeChatId,
    createChat,
    deleteChat,
    deleteAllChats,
    addMessage,
    setActiveChat,
    updateChatTitle,
  } = useChatStore()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeChat = chats.find((c) => c.id === activeChatId)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [activeChat?.messages])

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput('')
    addMessage(activeChatId, { role: 'user', content: userMsg, ts: Date.now() })
    setLoading(true)

    try {
      const rag = queryAriaRag(userMsg)
      const systemPrompt = buildSystemPrompt(rag)

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...((activeChat?.messages.slice(-10) || []).map((m) => ({
              role: m.role,
              content: m.content,
            }))),
            { role: 'user', content: userMsg },
          ],
        }),
      })

      if (!res.ok) throw new Error('ARIA response failed')

      const data = await res.json()
      const content = data.content || data.message || 'No response from ARIA.'

      addMessage(activeChatId, { role: 'assistant', content, ts: Date.now() })

      if (activeChat?.messages.length === 1) {
        const title = userMsg.slice(0, 40) + (userMsg.length > 40 ? '...' : '')
        updateChatTitle(activeChatId, title)
      }
    } catch (err: any) {
      addMessage(activeChatId, {
        role: 'assistant',
        content: `**ARIA Error:** ${toUserError(err)}`,
        ts: Date.now(),
        isError: true,
      })
    } finally {
      setLoading(false)
    }
  }, [input, loading, activeChatId, activeChat, addMessage, updateChatTitle])

  return (
    <div className="h-[calc(100dvh-64px)] flex overflow-hidden bg-slate-950">
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={chats}
        activeId={activeChatId}
        onSelect={setActiveChat}
        onNew={createChat}
        onDelete={deleteChat}
        onDeleteAll={deleteAllChats}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader onToggleSidebar={() => setSidebarOpen(true)} title={activeChat?.title || 'New Chat'} />

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeChat?.messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-emerald-400">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">ARIA — Attestation Assistant</h2>
                <p className="text-sm text-slate-400 max-w-md">
                  Ask about deepfake detection, analyze media, or get guidance on forensic indicators.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {['Analyze this image for GAN artifacts', 'Explain PRNU fingerprinting', 'Is this audio voice-cloned?', 'Trust score for video attestation'].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-left px-4 py-3 rounded-xl border border-white/[0.06] bg-slate-900/50 text-sm text-slate-300 hover:bg-slate-900 hover:border-white/[0.12] transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeChat?.messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}

          {loading && (
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <div className="w-4 h-4 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
              ARIA is analyzing...
            </div>
          )}
        </div>

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          loading={loading}
          disabled={!user}
          placeholder={user ? 'Ask ARIA anything...' : 'Sign in to chat with ARIA'}
        />
      </div>
    </div>
  )
}
