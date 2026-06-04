'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Search, UserX, Crown, ShieldOff, RotateCcw, RefreshCw } from 'lucide-react'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { ShimmerCard } from '../components/ShimmerBlock'
import { api } from '@/lib/api-client'

interface User {
  id: string; email: string; plan?: string; status?: string
  scans_used: number; credits_balance?: number; created_at: string
  is_banned?: boolean; banned_at?: string
}
interface UsersResponse { users: User[]; total: number; pages: number }

const fetcher = (url: string) => api<UsersResponse>(url)

// Null-safe badge helper — never calls .toLowerCase() on undefined
function planBadge(plan?: string) {
  const p = (plan ?? 'free').toLowerCase()
  return <span className={`badge badge-${p}`}>{plan ?? 'free'}</span>
}
function statusBadge(status?: string) {
  const s = (status ?? 'active').toLowerCase()
  return <span className={`badge badge-${s}`}>{status ?? 'active'}</span>
}

export default function UsersTab() {
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal]   = useState<{ type: 'ban' | 'unban' | 'credits' | 'plan'; user: User } | null>(null)
  const [acting, setActing] = useState(false)
  const [creditVal, setCreditVal] = useState('')
  const [planVal, setPlanVal]     = useState('')

  const { data, isLoading, error, mutate } = useSWR<UsersResponse>(
    `/users?page=${page}&search=${encodeURIComponent(search)}&filter=${filter}`,
    fetcher
  )

  const doAction = async (type: string, userId: string, body?: Record<string, unknown>) => {
    setActing(true)
    try {
      if (type === 'ban')     await api(`/users/${userId}/ban`,     'POST',  { ban: true })
      if (type === 'unban')   await api(`/users/${userId}/ban`,     'POST',  { ban: false })
      if (type === 'credits') await api(`/users/${userId}/credits`, 'PATCH', body)
      if (type === 'plan')    await api(`/users/${userId}/plan`,    'PATCH', body)
      await mutate()
    } catch (e) {
      alert(`Action failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setActing(false)
      setModal(null)
    }
  }

  const columns = [
    {
      key: 'email', header: 'User',
      render: (u: User) => (
        <div>
          <p className="text-text-primary text-xs font-medium">{u.email ?? '—'}</p>
          <p className="text-[10px] text-text-disabled">{u.id?.slice(0, 8) ?? ''}…</p>
        </div>
      )
    },
    { key: 'plan',   header: 'Plan',   render: (u: User) => planBadge(u.plan) },
    { key: 'status', header: 'Status', render: (u: User) => statusBadge(u.status) },
    {
      key: 'scans_used', header: 'Scans',
      render: (u: User) => <span className="tabular-nums text-xs">{(u.scans_used ?? 0).toLocaleString()}</span>
    },
    {
      key: 'created_at', header: 'Joined',
      render: (u: User) => (
        <span className="text-xs text-text-muted">
          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
        </span>
      )
    },
    {
      key: 'actions', header: 'Actions',
      render: (u: User) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setModal({ type: 'plan', user: u })} title="Change plan"
            aria-label={`Change plan for ${u.email}`}
            className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
            <Crown className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setModal({ type: 'credits', user: u })} title="Edit credits"
            aria-label={`Edit credits for ${u.email}`}
            className="p-1.5 rounded-lg text-text-muted hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {u.is_banned ? (
            <button onClick={() => setModal({ type: 'unban', user: u })} title="Unban"
              aria-label={`Unban ${u.email}`}
              className="p-1.5 rounded-lg text-text-muted hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors">
              <ShieldOff className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button onClick={() => setModal({ type: 'ban', user: u })} title="Ban"
              aria-label={`Ban ${u.email}`}
              className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-400/10 transition-colors">
              <UserX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
          <input
            type="search" placeholder="Search by email…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            aria-label="Search users"
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-surface border border-border
              text-text-primary placeholder-text-disabled outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'active', 'banned', 'pro', 'free'] as const).map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                focus:outline-none focus:ring-2 focus:ring-primary/50
                ${filter === f
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-text-muted hover:text-text-primary'}`}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => mutate()} aria-label="Refresh users"
          className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {error ? (
        <div className="text-center py-10 text-sm text-rose-400">
          Failed to load users — {error instanceof Error ? error.message : 'unknown error'}
        </div>
      ) : isLoading ? (
        <div className="space-y-2">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} h="h-12" />)}</div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.users ?? []}
          keyFn={u => u.id}
          page={page}
          totalPages={data?.pages}
          onPage={setPage}
          caption="Users table"
          emptyMessage="No users found"
        />
      )}

      {/* Action modals */}
      {modal && (
        <Modal
          open
          title={
            modal.type === 'ban'     ? `Ban ${modal.user.email}` :
            modal.type === 'unban'   ? `Unban ${modal.user.email}` :
            modal.type === 'credits' ? `Edit Credits — ${modal.user.email}` :
            `Change Plan — ${modal.user.email}`
          }
          onClose={() => setModal(null)}
        >
          {modal.type === 'ban' && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">This will prevent the user from accessing Aiscern.</p>
              <button onClick={() => doAction('ban', modal.user.id)} disabled={acting}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                  bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors">
                {acting ? 'Banning…' : 'Confirm Ban'}
              </button>
            </div>
          )}
          {modal.type === 'unban' && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">Restore access for this user.</p>
              <button onClick={() => doAction('unban', modal.user.id)} disabled={acting}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                  bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {acting ? 'Unbanning…' : 'Confirm Unban'}
              </button>
            </div>
          )}
          {modal.type === 'credits' && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Credits to add (negative to subtract)
              </label>
              <input type="number" value={creditVal} onChange={e => setCreditVal(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border
                  text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
              <button onClick={() => doAction('credits', modal.user.id, { delta: Number(creditVal) })}
                disabled={acting || !creditVal}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                  disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                {acting ? 'Applying…' : 'Apply'}
              </button>
            </div>
          )}
          {modal.type === 'plan' && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-text-secondary mb-1">New Plan</label>
              <select value={planVal} onChange={e => setPlanVal(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border
                  text-text-primary outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">Select plan…</option>
                {['free', 'pro', 'team', 'enterprise'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button onClick={() => doAction('plan', modal.user.id, { plan: planVal })}
                disabled={acting || !planVal}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                  disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                {acting ? 'Updating…' : 'Update Plan'}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
