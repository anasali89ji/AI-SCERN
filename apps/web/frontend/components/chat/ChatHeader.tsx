'use client'

import { Menu, Bot } from 'lucide-react'

interface Props {
  onToggleSidebar: () => void
  title: string
}

export function ChatHeader({ onToggleSidebar, title }: Props) {
  return (
    <div className="h-14 border-b border-white/[0.06] flex items-center px-4 gap-3 bg-slate-950/50 backdrop-blur-sm">
      <button
        onClick={onToggleSidebar}
        className="p-2 -ml-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-emerald-400" />
        </div>
        <span className="text-sm font-semibold text-white truncate">{title}</span>
      </div>
    </div>
  )
}
