'use client'

import { Send, Loader2 } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  loading: boolean
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ value, onChange, onSend, loading, disabled, placeholder }: Props) {
  return (
    <div className="border-t border-white/[0.06] bg-slate-950/80 backdrop-blur-md p-4">
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            rows={1}
            disabled={disabled || loading}
            placeholder={placeholder}
            className="w-full resize-none max-h-32 rounded-xl bg-slate-900 border border-white/[0.08] text-white placeholder:text-slate-600 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all disabled:opacity-50"
            style={{ minHeight: '48px' }}
          />
        </div>
        <button
          onClick={onSend}
          disabled={disabled || loading || !value.trim()}
          className="p-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 transition-all flex-shrink-0"
          aria-label="Send message"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  )
}
