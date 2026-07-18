"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Zap,
  Shield,
  Clock,
  ArrowUp,
  CircleStop,
  Copy,
  Check,
  RotateCcw,
  Lightbulb,
  BookOpen,
  TrendingUp,
  AlertCircle,
  Mic,
  Image as ImageIcon,
  FileText,
  X,
  Paperclip,
  ChevronDown,
  Compass,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: Source[]
  latencyMs?: number
}

interface Source {
  title: string
  url: string
  snippet: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hey — I\'m Aria. I can walk you through AI detection strategies, break down forensic signals, or compare how different tools stack up. What are you working on?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const suggestions = [
    "How do I spot AI-generated images in the wild?",
    "Compare AISCERN vs GPTZero for text detection",
    "What forensic signals reveal synthetic audio?",
    "Best practices for content authenticity workflows",
  ]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)
    setIsStreaming(true)
    setShowSuggestions(false)

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      },
    ])

    const startTime = performance.now()
    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`Server error ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") continue
            try {
              const parsed = JSON.parse(data)
              const chunk = parsed.choices?.[0]?.delta?.content || ""
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + chunk, latencyMs: Math.round(performance.now() - startTime) }
                    : m
                )
              )
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Something went wrong on our end. Try again in a moment." }
              : m
          )
        )
      }
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isLoading, messages])

  function handleStop() {
    abortRef.current?.abort()
    setIsLoading(false)
    setIsStreaming(false)
  }

  function handleCopy(content: string, id: string) {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-4xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}

              <div className={`max-w-[85%] sm:max-w-[75%] ${msg.role === "user" ? "order-1" : ""}`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-bg font-medium"
                      : "bg-[#0f0f17] border border-white/[0.07] text-slate-300"
                  }`}
                >
                  {msg.role === "assistant" && msg.content ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                  {msg.role === "assistant" && isStreaming && msg.id === messages[messages.length - 1]?.id && (
                    <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse rounded-sm" />
                  )}
                </div>

                {msg.role === "assistant" && msg.content && (
                  <div className="flex items-center gap-2 mt-1.5 ml-1">
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="text-[10px] text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedId === msg.id ? "Copied" : "Copy"}
                    </button>
                    {msg.latencyMs && (
                      <span className="text-[10px] text-slate-700 flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" />
                        {msg.latencyMs}ms
                      </span>
                    )}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-slate-400" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Suggestions */}
        <AnimatePresence>
          {showSuggestions && messages.length === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4"
            >
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s)
                    setTimeout(() => handleSend(), 50)
                  }}
                  className="text-left text-xs text-slate-500 bg-[#0f0f17] border border-white/[0.07] rounded-xl px-3 py-2.5 hover:border-primary/30 hover:text-slate-300 transition-all"
                >
                  <Lightbulb className="w-3 h-3 inline mr-1.5 text-primary" />
                  {s}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-white/[0.07] bg-[#0a0a0f]/80 backdrop-blur-xl px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 bg-[#141420] border border-white/[0.07] rounded-2xl px-3 py-2.5 focus-within:border-primary/30 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about detection strategies, tool comparisons, or forensic signals..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none max-h-[120px] py-1.5"
              disabled={isLoading}
            />

            {isLoading ? (
              <button
                onClick={handleStop}
                className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 hover:bg-rose-500/20 transition-colors shrink-0"
                title="Stop generating"
              >
                <CircleStop className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-9 h-9 rounded-xl bg-primary text-bg flex items-center justify-center hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-slate-700">
              Aria may produce inaccurate information. Verify critical facts independently.
            </p>
            {messages.length > 1 && (
              <button
                onClick={() => {
                  setMessages([messages[0]])
                  setShowSuggestions(true)
                }}
                className="text-[10px] text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                New chat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
