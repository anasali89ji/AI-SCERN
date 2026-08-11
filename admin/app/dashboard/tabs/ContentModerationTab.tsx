'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Shield, CheckCircle, XCircle, RefreshCw, Eye, AlertTriangle } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface ContentFlag {
  id: string; user_id: string; content_type: string; content_url: string
  reason: string; severity: string; status: string; created_at: string
  profiles?: { email: string; display_name: string }
}

const SEVERITY_COLORS: Record<string, string> = {
  low: 'text-text-muted', medium: 'text-amber-400', high: 'text-orange-400', critical: 'text-rose-400'
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  reviewed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  removed: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  dismissed: 'bg-text-muted/10 text-text-muted border-text-muted/20',
}

export default function ContentModerationTab() {
  const [status, setStatus] = useState('pending')
  const [modal, setModal] = useState<ContentFlag | null>(null)
  const [resolution, setResolution] = useState('')
  const { data, isLoading, error, mutate } = useSWR<{ flags: ContentFlag[]; total: number; pages: number }>(
    `/content-moderation?status=${status}`,
    (p: string) => api<{ flags: ContentFlag[]; total: number; pages: number }>(p)
  )

  const resolve = async (flagId: string, status: string) => {
    try {
      await api(`/content-moderation/${flagId}`, 'PATCH', { status, resolution: resolution || 'Resolved by admin' })
      await mutate()
      setModal(null)
      setResolution('')
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Content Moderation
        </h2>
        <div className="flex items-center gap-2">
          {['pending', 'reviewed', 'removed', 'dismissed', 'all'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${status === s ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:text-text-primary'}`}>
              {s}
            </button>
          ))}
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <ShimmerCard key={i} h="h-20" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load flags</div>
      ) : (
        <div className="space-y-2">
          {(data?.flags ?? []).length === 0 && <div className="text-center py-10 text-sm text-text-muted">No flagged content</div>}
          {(data?.flags ?? []).map(flag => (
            <div key={flag.id} className="card flex items-start gap-3 p-3">
              <AlertTriangle className={`w-4 h-4 mt-0.5 ${SEVERITY_COLORS[flag.severity] || 'text-text-muted'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${STATUS_COLORS[flag.status] || ''}`}>{flag.status}</span>
                  <span className="text-[10px] text-text-disabled uppercase font-bold">{flag.severity}</span>
                  <span className="text-[10px] text-text-muted">{flag.content_type}</span>
                </div>
                <p className="text-sm font-medium text-text-primary">{flag.reason}</p>
                <p className="text-xs text-text-muted">{flag.profiles?.email || flag.user_id}</p>
                {flag.content_url && <p className="text-[10px] text-primary truncate">{flag.content_url}</p>}
              </div>
              <button onClick={() => setModal(flag)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10">
                <Eye className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal open onClose={() => setModal(null)} title="Review Flagged Content" size="lg">
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-surface border border-border">
              <p className="text-xs text-text-secondary mb-1">Content URL</p>
              <p className="text-sm text-primary break-all">{modal.content_url || 'N/A'}</p>
            </div>
            <div className="p-3 rounded-xl bg-surface border border-border">
              <p className="text-xs text-text-secondary mb-1">Reason</p>
              <p className="text-sm text-text-primary">{modal.reason}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Resolution Note</label>
              <textarea rows={3} value={resolution} onChange={e => setResolution(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => resolve(modal.id, 'dismissed')}
                className="py-2.5 rounded-xl text-sm font-semibold text-text-primary bg-surface border border-border hover:bg-surface/80">
                <XCircle className="w-4 h-4 inline mr-1"/> Dismiss
              </button>
              <button onClick={() => resolve(modal.id, 'reviewed')}
                className="py-2.5 rounded-xl text-sm font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20">
                <Eye className="w-4 h-4 inline mr-1"/> Reviewed
              </button>
              <button onClick={() => resolve(modal.id, 'removed')}
                className="py-2.5 rounded-xl text-sm font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20">
                <CheckCircle className="w-4 h-4 inline mr-1"/> Remove & Ban
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
