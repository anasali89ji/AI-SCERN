'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { FileText, RefreshCw, Filter } from 'lucide-react'
import DataTable from '../components/DataTable'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface AuditEntry { id: string; action: string; admin_id: string; admin_ip: string; metadata: Record<string, unknown>; created_at: string; admin_users?: { email: string; name: string } }

export default function AuditTab() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const { data, isLoading, error, mutate } = useSWR(`/audit-log?page=${page}${actionFilter ? `&action=${actionFilter}` : ''}`, (url: string) => api(url))

  const columns = [
    { key: 'action', header: 'Action', render: (e: AuditEntry) => <span className="text-xs font-bold text-text-primary">{e.action}</span> },
    { key: 'admin', header: 'Admin', render: (e: AuditEntry) => <div><p className="text-xs text-text-primary">{e.admin_users?.email || e.admin_id?.slice(0, 8)}</p><p className="text-[10px] text-text-disabled">{e.admin_users?.name || '—'}</p></div> },
    { key: 'ip', header: 'IP', render: (e: AuditEntry) => <span className="text-xs font-mono text-text-muted">{e.admin_ip}</span> },
    { key: 'details', header: 'Details', render: (e: AuditEntry) => <span className="text-xs text-text-muted max-w-[200px] truncate">{JSON.stringify(e.metadata)}</span> },
    { key: 'time', header: 'Time', render: (e: AuditEntry) => <span className="text-xs text-text-muted">{new Date(e.created_at).toLocaleString()}</span> },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Audit Log</h2>
        <div className="flex items-center gap-2">
          <div className="relative"><Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-disabled" /><input value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1) }} placeholder="Filter by action…" className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-surface border border-border text-text-primary placeholder-text-disabled outline-none focus:ring-2 focus:ring-primary/50" /></div>
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {error ? <div className="text-center py-10 text-sm text-rose-400">Failed to load audit log</div>
        : isLoading ? <div className="space-y-2">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} h="h-12" />)}</div>
        : <DataTable columns={columns} data={data?.entries ?? []} keyFn={e => e.id} page={page} totalPages={data?.pages} onPage={setPage} caption="Audit log" emptyMessage="No audit entries found" />}
    </div>
  )
}
