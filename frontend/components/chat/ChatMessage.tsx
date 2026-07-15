'use client'

import { useState } from 'react'
import { Copy, Check, AlertTriangle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Props {
  message: {
    role: 'user' | 'assistant'
    content: string
    ts: number
    isError?: boolean
  }
}

export function ChatMessage({ message }: Props) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const copy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-100'
            : message.isError
            ? 'bg-red-500/10 border border-red-500/20 text-red-200'
            : 'bg-slate-900 border border-white/[0.06] text-slate-200'
        }`}
      >
        {!isUser && message.isError && (
          <div className="flex items-center gap-2 mb-2 text-red-400 font-medium">
            <AlertTriangle className="w-4 h-4" />
            System Error
          </div>
        )}

        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            components={{
              a: ({ node, ...props }: any) => <a {...props} className="text-emerald-400 hover:underline" target="_blank" rel="noopener noreferrer" />,
              code: ({ node, inline, ...props }: any) =>
                inline ? (
                  <code {...props} className="px-1.5 py-0.5 rounded-md bg-slate-800 text-emerald-300 text-xs font-mono" />
                ) : (
                  <pre className="p-3 rounded-xl bg-slate-950 border border-white/[0.06] overflow-x-auto text-xs font-mono text-slate-300">
                    <code {...props} />
                  </pre>
                ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        <div className="flex items-center justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={copy}
            className="p-1 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Copy message"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
