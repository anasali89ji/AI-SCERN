'use client'
import { useState, useEffect, useCallback } from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Clock, FileText, ImageIcon, Music, Video,
  Layers, Coins, Search, MessageSquare,
} from 'lucide-react'
import type { Scan } from '@/types'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MODALITY_ICON: Record<string, typeof FileText> = {
  text: FileText, image: ImageIcon, audio: Music, video: Video,
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [recent, setRecent] = useState<Scan[]>([])

  useEffect(() => {
    if (!open) return
    fetch('/api/user/scans?limit=3')
      .then(r => r.ok ? r.json() : { scans: [] })
      .then(d => setRecent(Array.isArray(d.scans) ? d.scans.slice(0, 3) : []))
      .catch(() => setRecent([]))
  }, [open])

  const go = useCallback((href: string) => {
    onOpenChange(false)
    router.push(href)
  }, [onOpenChange, router])

  // Escape / outside click handled by cmdk's Dialog via onOpenChange
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Global command palette"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      shouldFilter
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-surface-deep/80" onClick={() => onOpenChange(false)} aria-hidden />

      <div className="relative w-full max-w-lg bg-surface-elevated border border-white/5 rounded-xl shadow-deep overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 border-b border-white/5 bg-surface-deep">
          <Search className="w-4 h-4 text-silver-600 flex-shrink-0" />
          <Command.Input
            autoFocus
            placeholder="Search or jump to…"
            className="w-full bg-transparent border-0 outline-none py-3.5 text-sm text-silver-900 placeholder:text-silver-600"
          />
          <kbd className="hidden sm:inline text-[10px] font-semibold text-silver-600 bg-surface border border-white/10 px-1.5 py-0.5 rounded">
            Esc
          </kbd>
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-silver-600">
            No results found.
          </Command.Empty>

          <Command.Group heading="Navigation" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-silver-600">
            <Command.Item onSelect={() => go('/dashboard')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-silver-800 cursor-pointer data-[selected=true]:bg-white/5 data-[selected=true]:text-silver-900">
              <LayoutDashboard className="w-4 h-4 text-silver-600" /> Go to Dashboard
            </Command.Item>
            <Command.Item onSelect={() => go('/history')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-silver-800 cursor-pointer data-[selected=true]:bg-white/5 data-[selected=true]:text-silver-900">
              <Clock className="w-4 h-4 text-silver-600" /> Go to History
            </Command.Item>
            <Command.Item onSelect={() => go('/chat')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-silver-800 cursor-pointer data-[selected=true]:bg-white/5 data-[selected=true]:text-silver-900">
              <MessageSquare className="w-4 h-4 text-silver-600" /> Go to AI Assistant
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-silver-600">
            <Command.Item onSelect={() => go('/detect/text')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-silver-800 cursor-pointer data-[selected=true]:bg-white/5 data-[selected=true]:text-silver-900">
              <FileText className="w-4 h-4 text-silver-600" /> New Text Detection
            </Command.Item>
            <Command.Item onSelect={() => go('/batch')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-silver-800 cursor-pointer data-[selected=true]:bg-white/5 data-[selected=true]:text-silver-900">
              <Layers className="w-4 h-4 text-silver-600" /> Start Batch Scan
            </Command.Item>
            <Command.Item onSelect={() => go('/credits')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-silver-800 cursor-pointer data-[selected=true]:bg-white/5 data-[selected=true]:text-silver-900">
              <Coins className="w-4 h-4 text-silver-600" /> View Credits
            </Command.Item>
          </Command.Group>

          {recent.length > 0 && (
            <Command.Group heading="Recent" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-silver-600">
              {recent.map(scan => {
                const Icon = MODALITY_ICON[scan.media_type] ?? FileText
                const label = scan.file_name || scan.content_preview?.slice(0, 40) || `${scan.media_type} scan`
                return (
                  <Command.Item key={scan.id} onSelect={() => go(`/history?scan=${scan.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-silver-800 cursor-pointer data-[selected=true]:bg-white/5 data-[selected=true]:text-silver-900">
                    <Icon className="w-4 h-4 text-silver-600 flex-shrink-0" />
                    <span className="truncate flex-1">{label}</span>
                    {scan.verdict && (
                      <span className="text-[10px] font-semibold text-silver-600 uppercase flex-shrink-0">{scan.verdict}</span>
                    )}
                  </Command.Item>
                )
              })}
            </Command.Group>
          )}
        </Command.List>
      </div>
    </Command.Dialog>
  )
}
