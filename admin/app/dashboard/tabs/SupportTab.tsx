'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Headphones, RefreshCw, ChevronRight } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface Ticket {
  id: string; email: string; subject: string; message: string
  status: string; priority: string; category: string
  assigned_to?: string; created_at: string; updated_at: string
}

const COLUMNS: Ticket['status'][] = ['open', 'in_progress', 'resolved', 'closed']
const COL_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' }

export default function SupportTab() {
  const { data, isLoading, error, mutate } = useSWR<Ticket[]>('/support-tickets', (p: string) => api<Ticket[]>(p))
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [updating, setUpdating] = useState(false)

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true)
    try { await api(`/support-tickets/${id}`, 'PATCH', { status }); await mutate() }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
    finally { setUpdating(false); setSelected(null) }
  }

  const PRIORITY_COLOR: Record<string, string> = {
    urgent: 'badge-urgent', high: 'badge-high', medium: 'badge-medium', low: 'badge-low'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Headphones className="w-5 h-5 text-primary" /> Support Tickets
        </h2>
        <button onClick={() => mutate()} aria-label="Refresh" className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <ShimmerCard key={i} h="h-64" />)}
        </div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load tickets</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const tickets = (data ?? []).filter(t => t.status === col)
            return (
              <div key={col} className="rounded-xl border border-border" style={{ background: '#0c0c14' }}>
                <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{COL_LABEL[col]}</span>
                  <span className="text-xs text-text-disabled bg-surface-hover px-1.5 py-0.5 rounded-md">{tickets.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[200px]">
                  {tickets.map(ticket => (
                    <button key={ticket.id} onClick={() => setSelected(ticket)}
                      className="w-full text-left rounded-xl border border-border p-3 hover:border-primary/40 transition-all"
                      style={{ background: '#0f0f17' }}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className={`badge ${PRIORITY_COLOR[ticket.priority] ?? 'badge-medium'}`}>{ticket.priority}</span>
                        <ChevronRight className="w-3 h-3 text-text-disabled flex-shrink-0 mt-0.5" />
                      </div>
                      <p className="text-xs font-semibold text-text-primary line-clamp-1 mb-0.5">{ticket.subject}</p>
                      <p className="text-[10px] text-text-muted">{ticket.email}</p>
                      <p className="text-[10px] text-text-disabled mt-1">{new Date(ticket.created_at).toLocaleDateString()}</p>
                    </button>
                  ))}
                  {tickets.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-xs text-text-disabled">No tickets</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <Modal open title={selected.subject} onClose={() => setSelected(null)} size="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${PRIORITY_COLOR[selected.priority] ?? 'badge-medium'}`}>{selected.priority}</span>
              <span className={`badge badge-${selected.status.replace('_', '-')}`}>{selected.status.replace('_', ' ')}</span>
              <span className="badge badge-free">{selected.category}</span>
            </div>
            <div className="text-xs text-text-muted">From: <span className="text-text-secondary font-medium">{selected.email}</span></div>
            <div className="rounded-xl p-4 text-sm text-text-secondary whitespace-pre-wrap" style={{ background: '#141420', border: '1px solid #1c1c2e' }}>
              {selected.message}
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {COLUMNS.map(s => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)} disabled={updating || selected.status === s}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40
                      ${selected.status === s ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:text-text-primary'}`}>
                    {COL_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
