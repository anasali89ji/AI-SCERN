'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react'
import DataTable from '../components/DataTable'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface ErrorLog {
  id: string; message: string; path?: string; count: number; resolved: boolean; first_seen: string; last_seen: string
}

export default function ErrorsTab() {
  const [resolved, setResolved] = useState(false)
  const { data, isLoading, error, mutate } = useSWR<ErrorLog[]>(
    `/errors?resolved=${resolved}`, (p: string) => api<ErrorLog[]>(p)
  )

  const resolve = async (id: string) => {
    try { await api(`/errors/${id}`, 'PATCH', { resolved: true }); await mutate() }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
  }

  const columns = [
    { key: 'message', header: 'Error',
      render: (e: ErrorLog) => (
        <div>
          <p className="text-xs font-medium text-rose-300 truncate max-w-xs">{e.message}</p>
          {e.path && <p className="text-[10px] text-text-disabled mt-0.5">{e.path}</p>}
        </div>
      )
    },
    { key: 'count', header: 'Count',
      render: (e: ErrorLog) => <span className="text-xs font-bold text-text-primary tabular-nums">{e.count}</span>
    },
    { key: 'last_seen', header: 'Last Seen',
      render: (e: ErrorLog) => <span className="text-xs text-text-muted">{new Date(e.last_seen).toLocaleString()}</span>
    },
    { key: 'actions', header: '',
      render: (e: ErrorLog) => !e.resolved ? (
        <button onClick={() => resolve(e.id)} aria-label={`Resolve error ${e.id}`}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 transition-colors">
          <CheckCircle className="w-3 h-3" /> Resolve
        </button>
      ) : null
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-400" /> Error Logs
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setResolved(r => !r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border
              ${resolved ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-surface border-border text-text-muted hover:text-text-primary'}`}>
            {resolved ? 'Showing Resolved' : 'Show Resolved'}
          </button>
          <button onClick={() => mutate()} aria-label="Refresh errors" className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array(5).fill(0).map((_, i) => <ShimmerCard key={i} h="h-14" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load errors</div>
      ) : (
        <DataTable columns={columns} data={data ?? []} keyFn={e => e.id} caption="Error logs" emptyMessage="No errors found" />
      )}
    </div>
  )
}
