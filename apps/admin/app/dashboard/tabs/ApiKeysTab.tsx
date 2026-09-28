'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { KeyRound, RefreshCw, Trash2, Copy, Check } from 'lucide-react'
import DataTable from '../components/DataTable'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface ApiKey { id: string; user_email: string; name: string; key_prefix: string; permissions: string[]; rate_limit: number; last_used_at: string; expires_at: string; revoked_at: string; created_at: string; usage_count: number }

export default function ApiKeysTab() {
  const { data, isLoading, error, mutate } = useSWR<ApiKey[]>('/api-keys', (p: string) => api<ApiKey[]>(p))
  const [copied, setCopied] = useState('')

  const copyPrefix = (prefix: string) => { navigator.clipboard.writeText(prefix); setCopied(prefix); setTimeout(() => setCopied(''), 2000) }
  const revoke = async (id: string) => { if (!confirm('Revoke this API key?')) return; try { await api(`/api-keys/${id}`, 'PATCH', { revoked_at: new Date().toISOString() }); await mutate() } catch (e) { alert('Failed') } }

  const columns = [
    { key: 'name', header: 'Name', render: (k: ApiKey) => <p className="text-text-primary text-xs font-medium">{k.name}</p> },
    { key: 'user', header: 'User', render: (k: ApiKey) => <p className="text-xs text-text-muted">{k.user_email}</p> },
    { key: 'prefix', header: 'Key', render: (k: ApiKey) => <div className="flex items-center gap-2"><code className="text-[10px] font-mono bg-surface px-2 py-1 rounded border border-border">{k.key_prefix}...</code><button onClick={() => copyPrefix(k.key_prefix)} className="p-1 rounded text-text-muted hover:text-primary">{copied === k.key_prefix ? <Check className="w-3 h-3 text-emerald-400"/> : <Copy className="w-3 h-3"/>}</button></div> },
    { key: 'permissions', header: 'Permissions', render: (k: ApiKey) => <div className="flex flex-wrap gap-1">{k.permissions.map(p => <span key={p} className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-surface border border-border text-text-muted">{p}</span>)}</div> },
    { key: 'rate', header: 'Rate Limit', render: (k: ApiKey) => <span className="text-xs text-text-muted">{k.rate_limit}/min</span> },
    { key: 'usage', header: 'Usage', render: (k: ApiKey) => <span className="text-xs text-text-muted">{k.usage_count || 0}</span> },
    { key: 'status', header: 'Status', render: (k: ApiKey) => <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${k.revoked_at ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : k.expires_at && new Date(k.expires_at) < new Date() ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>{k.revoked_at ? 'Revoked' : k.expires_at && new Date(k.expires_at) < new Date() ? 'Expired' : 'Active'}</span> },
    { key: 'actions', header: '', render: (k: ApiKey) => <button onClick={() => revoke(k.id)} className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-400/10"><Trash2 className="w-3.5 h-3.5" /></button> },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> API Keys</h2>
        <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      {error ? <div className="text-center py-10 text-sm text-rose-400">Failed to load API keys</div>
        : isLoading ? <div className="space-y-2">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} h="h-12" />)}</div>
        : <DataTable columns={columns} data={data ?? []} keyFn={k => k.id} caption="API Keys" emptyMessage="No API keys found" />}
    </div>
  )
}
