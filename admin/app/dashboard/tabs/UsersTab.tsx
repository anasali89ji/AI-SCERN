'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Search, UserX, Crown, ShieldOff, RotateCcw, RefreshCw, Download, Users } from 'lucide-react'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { ShimmerCard } from '../components/ShimmerBlock'
import { api } from '@/lib/api-client'

interface User { id: string; email: string; display_name?: string; plan?: string; status?: string; scans_used: number; credits_balance?: number; credits_remaining?: number; created_at: string; is_banned?: boolean; last_login_at?: string; country?: string }
interface UsersResponse { users: User[]; total: number; pages: number }

const fetcher = (url: string) => api<UsersResponse>(url)
function planBadge(plan?: string) { const p = (plan ?? 'free').toLowerCase(); return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${p === 'free' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : p === 'pro' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : p === 'enterprise' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}`}>{plan ?? 'free'}</span> }
function statusBadge(status?: string) { const s = (status ?? 'active').toLowerCase(); return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${s === 'banned' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : s === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-surface text-text-muted border-border'}`}>{status ?? 'active'}</span> }

export default function UsersTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState<{ type: 'ban' | 'unban' | 'credits' | 'plan'; user: User } | null>(null)
  const [acting, setActing] = useState(false)
  const [creditVal, setCreditVal] = useState('')
  const [planVal, setPlanVal] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState('')

  const { data, isLoading, error, mutate } = useSWR<UsersResponse>(`/users?page=${page}&search=${encodeURIComponent(search)}&filter=${filter}`, fetcher)

  const doAction = async (type: string, userId: string, body?: Record<string, unknown>) => {
    setActing(true)
    try {
      if (type === 'ban') await api(`/users/${userId}/ban`, 'POST', { ban: true })
      if (type === 'unban') await api(`/users/${userId}/ban`, 'POST', { ban: false })
      if (type === 'credits') await api(`/users/${userId}/credits`, 'PATCH', body)
      if (type === 'plan') await api(`/users/${userId}/plan`, 'PATCH', body)
      await mutate()
    } catch (e) { alert(`Action failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
    finally { setActing(false); setModal(null) }
  }

  const doBulkAction = async () => {
    if (!bulkAction || selectedUsers.size === 0) return
    const userIds = Array.from(selectedUsers)
    const body: any = { action: bulkAction, userIds }
    if (bulkAction === 'credits') body.delta = Number(prompt('Credits to add (negative to subtract):'))
    if (bulkAction === 'plan') body.plan = prompt('New plan (free/starter/pro/enterprise):')
    try { await api('/users/bulk', 'POST', body); await mutate(); setSelectedUsers(new Set()) }
    catch (e) { alert(`Bulk action failed: ${e instanceof Error ? e.message : 'error'}`) }
  }

  const exportUsers = async () => {
    const res = await fetch(`/api/users/export?format=csv&filter=${filter}`)
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `users_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedUsers)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedUsers(next)
  }

  const columns = [
    { key: 'select', header: '', render: (u: User) => <input type="checkbox" checked={selectedUsers.has(u.id)} onChange={() => toggleSelect(u.id)} className="rounded border-border bg-surface text-primary" /> },
    { key: 'email', header: 'User', render: (u: User) => (<div><p className="text-text-primary text-xs font-medium">{u.email ?? '—'}</p><p className="text-[10px] text-text-disabled">{u.display_name || '—'} · {u.id?.slice(0, 8)}…</p></div>) },
    { key: 'plan', header: 'Plan', render: (u: User) => planBadge(u.plan) },
    { key: 'status', header: 'Status', render: (u: User) => statusBadge(u.status) },
    { key: 'credits', header: 'Credits', render: (u: User) => <span className="tabular-nums text-xs">{(u.credits_balance ?? 0).toLocaleString()}</span> },
    { key: 'scans', header: 'Scans', render: (u: User) => <span className="tabular-nums text-xs">{(u.scans_used ?? 0).toLocaleString()}</span> },
    { key: 'country', header: 'Country', render: (u: User) => <span className="text-xs text-text-muted">{u.country || '—'}</span> },
    { key: 'last_login', header: 'Last Login', render: (u: User) => <span className="text-xs text-text-muted">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</span> },
    { key: 'joined', header: 'Joined', render: (u: User) => <span className="text-xs text-text-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</span> },
    { key: 'actions', header: 'Actions', render: (u: User) => (
      <div className="flex items-center gap-1">
        <button onClick={() => setModal({ type: 'plan', user: u })} title="Change plan" className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10"><Crown className="w-3.5 h-3.5" /></button>
        <button onClick={() => setModal({ type: 'credits', user: u })} title="Edit credits" className="p-1.5 rounded-lg text-text-muted hover:text-amber-400 hover:bg-amber-400/10"><RotateCcw className="w-3.5 h-3.5" /></button>
        {u.is_banned ? <button onClick={() => setModal({ type: 'unban', user: u })} title="Unban" className="p-1.5 rounded-lg text-text-muted hover:text-emerald-400 hover:bg-emerald-400/10"><ShieldOff className="w-3.5 h-3.5" /></button>
          : <button onClick={() => setModal({ type: 'ban', user: u })} title="Ban" className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-400/10"><UserX className="w-3.5 h-3.5" /></button>}
      </div>
    )},
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
          <input type="search" placeholder="Search by email…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-surface border border-border text-text-primary placeholder-text-disabled outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['all', 'active', 'banned', 'pro', 'free', 'recent'].map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1) }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === f ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:text-text-primary'}`}>{f}</button>
          ))}
        </div>
        {selectedUsers.size > 0 && (
          <div className="flex items-center gap-2">
            <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-border text-text-secondary">
              <option value="">Bulk Action</option>
              <option value="ban">Ban</option>
              <option value="unban">Unban</option>
              <option value="credits">Add Credits</option>
              <option value="plan">Change Plan</option>
              <option value="delete">Delete</option>
            </select>
            <button onClick={doBulkAction} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-primary">Apply</button>
          </div>
        )}
        <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
        <button onClick={exportUsers} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-primary bg-surface border border-border hover:bg-surface/80"><Download className="w-3.5 h-3.5" /> Export</button>
      </div>

      {error ? <div className="text-center py-10 text-sm text-rose-400">Failed to load users</div>
        : isLoading ? <div className="space-y-2">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} h="h-12" />)}</div>
        : <DataTable columns={columns} data={data?.users ?? []} keyFn={u => u.id} page={page} totalPages={data?.pages} onPage={setPage} caption="Users table" emptyMessage="No users found" />}

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'ban' ? `Ban ${modal.user.email}` : modal.type === 'unban' ? `Unban ${modal.user.email}` : modal.type === 'credits' ? `Edit Credits — ${modal.user.email}` : `Change Plan — ${modal.user.email}`}>
          {modal.type === 'ban' && <div className="space-y-4"><p className="text-sm text-text-secondary">This will prevent the user from accessing Aiscern.</p><button onClick={() => doAction('ban', modal.user.id)} disabled={acting} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50">{acting ? 'Banning…' : 'Confirm Ban'}</button></div>}
          {modal.type === 'unban' && <div className="space-y-4"><p className="text-sm text-text-secondary">Restore access for this user.</p><button onClick={() => doAction('unban', modal.user.id)} disabled={acting} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">{acting ? 'Unbanning…' : 'Confirm Unban'}</button></div>}
          {modal.type === 'credits' && <div className="space-y-4"><label className="block text-xs font-semibold text-text-secondary mb-1">Credits to add (negative to subtract)</label><input type="number" value={creditVal} onChange={e => setCreditVal(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" /><button onClick={() => doAction('credits', modal.user.id, { delta: Number(creditVal) })} disabled={acting || !creditVal} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500">{acting ? 'Applying…' : 'Apply'}</button></div>}
          {modal.type === 'plan' && <div className="space-y-4"><label className="block text-xs font-semibold text-text-secondary mb-1">New Plan</label><select value={planVal} onChange={e => setPlanVal(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50"><option value="">Select plan…</option><option value="free">Free</option><option value="starter">Starter</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select><button onClick={() => doAction('plan', modal.user.id, { plan: planVal })} disabled={acting || !planVal} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500">{acting ? 'Applying…' : 'Change Plan'}</button></div>}
        </Modal>
      )}
    </div>
  )
}
