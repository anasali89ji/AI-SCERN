'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { FileText, RefreshCw, Download } from 'lucide-react'
import DataTable from '../components/DataTable'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface AuditEntry {
  id: string; action: string; admin_ip: string; metadata?: Record<string, unknown>; created_at: string
}
interface AuditResponse { entries: AuditEntry[]; total: number; pages: number }

const ACTION_COLOR: Record<string, string> = {
  login_success: 'text-emerald-400', login_failed: 'text-rose-400',
  user_banned: 'text-rose-400', user_unbanned: 'text-emerald-400',
  settings_changed: 'text-amber-400', flag_toggled: 'text-primary',
}

export default function AuditTab() {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')

  const { data, isLoading, error, mutate } = useSWR<AuditResponse>(
    `/audit-log?page=${page}&action=${filter}`,
    (p: string) => api<AuditResponse>(p)
  )

  const exportCSV = () => {
    const rows = (data?.entries ?? []).map(e =>
      `${e.created_at},${e.action},${e.admin_ip},${JSON.stringify(e.metadata ?? {})}`
    )
    const blob = new Blob([['created_at,action,ip,metadata', ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const columns = [
    { key: 'action', header: 'Action',
      render: (e: AuditEntry) => (
        <span className={`text-xs font-semibold ${ACTION_COLOR[e.action] ?? 'text-text-secondary'}`}>
          {e.action.replace(/_/g, ' ')}
        </span>
      )
    },
    { key: 'admin_ip', header: 'IP', render: (e: AuditEntry) => <span className="text-xs font-mono text-text-muted">{e.admin_ip}</span> },
    { key: 'metadata', header: 'Details',
      render: (e: AuditEntry) => (
        <span className="text-[10px] text-text-disabled truncate max-w-xs block">
          {e.metadata ? JSON.stringify(e.metadata) : '—'}
        </span>
      )
    },
    { key: 'created_at', header: 'When',
      render: (e: AuditEntry) => <span className="text-xs text-text-muted">{new Date(e.created_at).toLocaleString()}</span>
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> Audit Log
        </h2>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }}
            className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-border text-text-secondary outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">All actions</option>
            {['login_success', 'login_failed', 'user_banned', 'user_unbanned', 'settings_changed', 'flag_toggled'].map(a => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button onClick={exportCSV} aria-label="Export CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary border border-border hover:text-text-primary hover:border-primary/50 transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => mutate()} aria-label="Refresh" className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array(5).fill(0).map((_, i) => <ShimmerCard key={i} h="h-12" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load audit log</div>
      ) : (
        <DataTable columns={columns} data={data?.entries ?? []} keyFn={e => e.id}
          page={page} totalPages={data?.pages} onPage={setPage} caption="Audit log" />
      )}
    </div>
  )
}
