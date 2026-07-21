'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { HelpCircle, RefreshCw, MessageSquare, Clock, CheckCircle } from 'lucide-react'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface Ticket { id: string; email: string; subject: string; message: string; priority: string; status: string; category: string; created_at: string; profiles?: { email: string; display_name: string } }

export default function SupportTab() {
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<Ticket | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const { data, isLoading, error, mutate } = useSWR<{ tickets: Ticket[]; total: number; pages: number }>(`/support-tickets?status=${status}&page=${page}`, (p: string) => api(p))

  const updateTicket = async (id: string, updates: any) => {
    try { await api(`/support-tickets/${id}`, 'PATCH', updates); await mutate(); setModal(null); setReply('') }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
  }

  const priorityColor = (p: string) => ({ urgent: 'text-rose-400', high: 'text-amber-400', medium: 'text-blue-400', low: 'text-text-muted' }[p] || 'text-text-muted')
  const statusColor = (s: string) => ({ open: 'bg-amber-500/10 text-amber-400 border-amber-500/20', resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', closed: 'bg-text-muted/10 text-text-muted border-text-muted/20' }[s] || '')

  const columns = [
    { key: 'email', header: 'User', render: (t: Ticket) => <div><p className="text-text-primary text-xs font-medium">{t.profiles?.email || t.email}</p><p className="text-[10px] text-text-disabled">{t.profiles?.display_name || '—'}</p></div> },
    { key: 'subject', header: 'Subject', render: (t: Ticket) => <p className="text-xs text-text-primary max-w-[200px] truncate">{t.subject}</p> },
    { key: 'priority', header: 'Priority', render: (t: Ticket) => <span className={`text-xs font-bold uppercase ${priorityColor(t.priority)}`}>{t.priority}</span> },
    { key: 'status', header: 'Status', render: (t: Ticket) => <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${statusColor(t.status)}`}>{t.status}</span> },
    { key: 'category', header: 'Category', render: (t: Ticket) => <span className="text-xs text-text-muted">{t.category}</span> },
    { key: 'created', header: 'Created', render: (t: Ticket) => <span className="text-xs text-text-muted">{new Date(t.created_at).toLocaleDateString()}</span> },
    { key: 'actions', header: '', render: (t: Ticket) => <button onClick={() => setModal(t)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10"><MessageSquare className="w-3.5 h-3.5" /></button> },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><HelpCircle className="w-5 h-5 text-primary" /> Support Tickets</h2>
        <div className="flex items-center gap-2">
          {['all', 'open', 'resolved', 'closed'].map(s => <button key={s} onClick={() => { setStatus(s); setPage(1) }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${status === s ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:text-text-primary'}`}>{s}</button>)}
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {error ? <div className="text-center py-10 text-sm text-rose-400">Failed to load tickets</div>
        : isLoading ? <div className="space-y-2">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} h="h-12" />)}</div>
        : <DataTable columns={columns} data={data?.tickets ?? []} keyFn={t => t.id} page={page} totalPages={data?.pages} onPage={setPage} caption="Support tickets" emptyMessage="No tickets found" />}

      {modal && (
        <Modal open onClose={() => setModal(null)} title={`Ticket: ${modal.subject}`} size="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className={`font-bold uppercase ${priorityColor(modal.priority)}`}>{modal.priority}</span>
              <span>{modal.email}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(modal.created_at).toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface border border-border"><p className="text-sm text-text-primary whitespace-pre-wrap">{modal.message}</p></div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Reply</label>
              <textarea rows={4} value={reply} onChange={e => setReply(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => updateTicket(modal.id, { status: 'resolved', reply })} disabled={sending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">{sending ? 'Sending…' : 'Resolve & Reply'}</button>
              <button onClick={() => updateTicket(modal.id, { status: 'closed', reply })} disabled={sending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-text-primary bg-surface border border-border hover:bg-surface/80">Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
