'use client'

import { X, Plus, Trash2, MessageSquare } from 'lucide-react'
import { Chat } from './useChatStore'

interface Props {
  open: boolean
  onClose: () => void
  chats: Chat[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onDeleteAll: () => void
}

export function ChatSidebar({ open, onClose, chats, activeId, onSelect, onNew, onDelete, onDeleteAll }: Props) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-950 border-r border-white/[0.06] flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-14 border-b border-white/[0.06] flex items-center justify-between px-4">
          <span className="text-sm font-semibold text-white">Conversations</span>
          <div className="flex items-center gap-1">
            <button
              onClick={onNew}
              className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-emerald-400 transition-colors"
              aria-label="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chats.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-500">No conversations yet</div>
          )}
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => {
                onSelect(chat.id)
                onClose()
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all group ${
                chat.id === activeId
                  ? 'bg-emerald-500/10 text-emerald-100 border border-emerald-500/20'
                  : 'text-slate-300 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0 text-slate-500 group-hover:text-slate-300" />
              <span className="truncate flex-1">{chat.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(chat.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
                aria-label="Delete chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </button>
          ))}
        </div>

        {chats.length > 0 && (
          <div className="p-2 border-t border-white/[0.06]">
            <button
              onClick={onDeleteAll}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all conversations
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
