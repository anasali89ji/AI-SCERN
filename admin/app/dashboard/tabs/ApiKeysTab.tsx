'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Key, RefreshCw, Trash2, Search } from 'lucide-react'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface ApiKey {
  id: string; user_id: string; name?: string; key_prefix: string
  permissions: string[]; rate_limit: number; last_used_at?: string
  expires_at?: string; revoked_at?: string; created_at: string
  user_email?: string
}

export default function ApiKeysTab() {
  const [search, setSearch] = useState('')
  const [toRevoke, setToRevoke] = useState<ApiKey | null>(null)
  const [revoking, setRevoking] = useState(false)
  const { data, isLoading, error, mutate } = useSWR<ApiKey[]>('/api-keys', (p: string) => api<ApiKey[]>(p))

  const revoke = async () => {
    if (!toRevoke) return
    setRevoking(true)
    try { await api(`/api-keys/${toRevoke.id}`, 'DELETE'); await mutate() }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
    finally { setRevoking(false); setToRevoke(null) }
  }

  const filtered = (data ?? []).filter(k =>
    !search || k.user_email?.includes(search) || k.key_prefix.includes(search)
  )

  const columns = [
    { key: 'key_prefix', header: 'Key', render: (k: ApiKey) => (
      <div>
        <code className="text-xs text-primary font-mono">{k.key_prefix}…</code>
        {k.name && <p className="text-[10px] text-text-muted">{k.name}</p>}
      </div>
    )},
    { key: 'user_email', header: 'User', render: (k: ApiKey) => <span className="text-xs text-text-secondary">{k.user_email ?? k.user_id.slice(0, 8) + '…'}</span> },
    { key: 'permissions', header: 'Permissions', render: (k: ApiKey) => (
      <div className="flex gap-1 flex-wrap">{k.permissions.map(p => <span key={p} className="badge badge-info text-[9px]">{p}</span>)}</div>
    )},
    { key: 'rate_limit', header: 'Rate Limit', render: (k: ApiKey) => <span className="text-xs tabular-nums">{k.rate_limit}/hr</span> },
    { key: 'last_used_at', header: 'Last Used', render: (k: ApiKey) => (
      <span className="text-xs text-text-muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</span>
    )},
    { key: 'status', header: 'Status', render: (k: ApiKey) => (
      <span className={`badge ${k.revoked_at ? 'badge-banned' : 'badge-active'}`}>{k.revoked_at ? 'Revoked' : 'Active'}</span>
    )},
    { key: 'actions', header: '', render: (k: ApiKey) => !k.revoked_at ? (
      <button onClick={() => setToRevoke(k)} aria-label={`Revoke key ${k.key_prefix}`}
        className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-400/10 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    ) : null },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" /> API Keys
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
            <input type="search" placeholder="Search by email or prefix…" value={search}
              onChange={e => setSearch(e.target.value)} aria-label="Search API keys"
              className="pl-9 pr-4 py-2 rounded-xl text-sm bg-surface border border-border text-text-primary
                placeholder-text-disabled outline-none focus:ring-2 focus:ring-primary/50 transition-all w-52" />
          </div>
          <button onClick={() => mutate()} aria-label="Refresh" className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array(5).fill(0).map((_, i) => <ShimmerCard key={i} h="h-12" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load API keys</div>
      ) : (
        <DataTable columns={columns} data={filtered} keyFn={k => k.id} caption="API keys table" emptyMessage="No API keys found" />
      )}

      {toRevoke && (
        <Modal open title="Revoke API Key" onClose={() => setToRevoke(null)} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">Revoke key <code className="text-primary">{toRevoke.key_prefix}…</code>? This cannot be undone.</p>
            <button onClick={revoke} disabled={revoking}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors">
              {revoking ? 'Revoking…' : 'Confirm Revoke'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
