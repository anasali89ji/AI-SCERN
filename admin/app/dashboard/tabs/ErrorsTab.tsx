'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { AlertTriangle, RefreshCw, CheckCircle, Bug, Clock } from 'lucide-react'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface ErrorLog { id: string; message: string; path: string; count: number; resolved: boolean; first_seen: string; last_seen: string; severity: string; stack_trace?: string; resolution_note?: string }

export default function ErrorsTab() {
  const [resolved, setResolved] = useState(false)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<ErrorLog | null>(null)
  const [note, setNote] = useState('')

  const { data, isLoading, error, mutate } = useSWR(`/errors?resolved=${resolved}&page=${page}`, (url: string) => api(url))

  const resolveError = async (id: string) => {
    try { await api('/errors', 'PATCH', { id, resolved: true, note }); await mutate(); setModal(null); setNote('') }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
  }

  const columns = [
    { key: 'message', header: 'Error', render: (e: ErrorLog) => <div><p className="text-text-primary text-xs font-medium max-w-[300px] truncate">{e.message}</p><p className="text-[10px] text-text-disabled">{e.path}</p></div> },
    { key: 'severity', header: 'Severity', render: (e: ErrorLog) => <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${e.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : e.severity === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-surface text-text-muted border-border'}`}>{e.severity}</span> },
    { key: 'count', header: 'Count', render: (e: ErrorLog) => <span className="text-xs text-text-muted">{e.count}</span> },
    { key: 'last', header: 'Last Seen', render: (e: ErrorLog) => <span className="text-xs text-text-muted">{new Date(e.last_seen).toLocaleString()}</span> },
    { key: 'actions', header: '', render: (e: ErrorLog) => !e.resolved && <button onClick={() => setModal(e)} className="p-1.5 rounded-lg text-text-muted hover:text-emerald-400 hover:bg-emerald-400/10"><CheckCircle className="w-3.5 h-3.5" /></button> },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-primary" /> Error Logs</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => { setResolved(false); setPage(1) }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${!resolved ? 'bg-rose-500 text-white' : 'bg-surface border border-border text-text-muted'}`}>Unresolved</button>
          <button onClick={() => { setResolved(true); setPage(1) }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${resolved ? 'bg-emerald-500 text-white' : 'bg-surface border border-border text-text-muted'}`}>Resolved</button>
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {error ? <div className="text-center py-10 text-sm text-rose-400">Failed to load errors</div>
        : isLoading ? <div className="space-y-2">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} h="h-12" />)}</div>
        : <DataTable columns={columns} data={data?.errors ?? []} keyFn={e => e.id} page={page} totalPages={data?.pages} onPage={setPage} caption="Error logs" emptyMessage="No errors found" />}

      {modal && (
        <Modal open onClose={() => setModal(null)} title="Resolve Error" size="lg">
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-surface border border-border"><p className="text-xs text-text-secondary mb-1">Message</p><p className="text-sm text-text-primary">{modal.message}</p></div>
            {modal.stack_trace && <div className="p-3 rounded-xl bg-surface border border-border overflow-auto max-h-40"><pre className="text-[10px] text-text-muted font-mono">{modal.stack_trace}</pre></div>}
            <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Resolution Note</label><textarea rows={3} value={note} onChange={e => setNote(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50 resize-none" /></div>
            <button onClick={() => resolveError(modal.id)} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700">Mark as Resolved</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
