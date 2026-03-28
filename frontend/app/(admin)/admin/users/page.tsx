'use client'
import { useEffect, useState, useCallback } from 'react'
import { RoleGuard } from '@/components/dashboard/RoleGuard'
import { Users, Search, Ban, CheckCircle, ShieldOff, ShieldCheck, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'

type User = {
  id: string; email: string; display_name: string | null; plan: string
  created_at: string; is_banned: boolean; dashboard_access: boolean
  access_revoked_at: string | null; scan_count: number; credits_remaining: number
}

function StatusBadge({ user }: { user: User }) {
  if (user.is_banned) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose/10 text-rose border border-rose/20">Banned</span>
  if (!user.dashboard_access) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber/10 text-amber border border-amber/20">Revoked</span>
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald/10 text-emerald border border-emerald/20">Active</span>
}

export default function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ userId: string; action: string; email: string } | null>(null)
  const [reason, setReason] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), filter })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/users?${params}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
        setTotal(data.total || 0)
      }
    } catch {}
    setLoading(false)
  }, [page, search, filter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const doAction = async (userId: string, action: string) => {
    setActionLoading(userId + action)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, reason }),
      })
      if (res.ok) {
        setConfirmAction(null)
        setReason('')
        await fetchUsers()
      }
    } catch {}
    setActionLoading(null)
  }

  const totalPages = Math.ceil(total / 25)

  return (
    <RoleGuard required="MANAGER">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-text-primary">User Management</h1>
            <p className="text-xs text-text-muted">{total.toLocaleString()} total users</p>
          </div>
          <button onClick={fetchUsers} className="p-2 rounded-lg border border-border hover:bg-surface-active transition-colors">
            <RefreshCw className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by email…"
              className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-primary/40" />
          </div>
          {['all', 'active', 'banned', 'revoked'].map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1) }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${filter === f ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border text-text-muted hover:text-text-primary'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-surface/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-active/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Scans</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Joined</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-surface-active animate-pulse rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-text-muted text-sm">No users found</td></tr>
                ) : users.map(user => (
                  <tr key={user.id} className="border-b border-border/40 hover:bg-surface-active/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary flex-shrink-0">
                          {(user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-text-primary">{user.email}</p>
                          {user.display_name && <p className="text-[10px] text-text-muted">{user.display_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-text-secondary capitalize">{user.plan || 'free'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-text-muted">{user.scan_count || 0}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge user={user} /></td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-text-muted">{new Date(user.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Ban / Unban */}
                        {user.is_banned ? (
                          <button onClick={() => setConfirmAction({ userId: user.id, action: 'unban', email: user.email })}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald/10 text-emerald hover:bg-emerald/20 transition-colors border border-emerald/20">
                            <CheckCircle className="w-3 h-3" /> Unban
                          </button>
                        ) : (
                          <button onClick={() => setConfirmAction({ userId: user.id, action: 'ban', email: user.email })}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-rose/10 text-rose hover:bg-rose/20 transition-colors border border-rose/20">
                            <Ban className="w-3 h-3" /> Ban
                          </button>
                        )}
                        {/* Revoke / Restore dashboard */}
                        {user.dashboard_access !== false ? (
                          <button onClick={() => setConfirmAction({ userId: user.id, action: 'revoke', email: user.email })}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber/10 text-amber hover:bg-amber/20 transition-colors border border-amber/20">
                            <ShieldOff className="w-3 h-3" /> Revoke
                          </button>
                        ) : (
                          <button onClick={() => setConfirmAction({ userId: user.id, action: 'restore', email: user.email })}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20">
                            <ShieldCheck className="w-3 h-3" /> Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-text-muted">Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-border hover:bg-surface-active disabled:opacity-40">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-border hover:bg-surface-active disabled:opacity-40">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Confirm modal */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm mx-4">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber" />
                <h3 className="font-bold text-text-primary capitalize">Confirm {confirmAction.action}</h3>
              </div>
              <p className="text-sm text-text-muted mb-4">
                Are you sure you want to <strong className="text-text-primary">{confirmAction.action}</strong> the account for <strong className="text-text-primary">{confirmAction.email}</strong>?
              </p>
              {(confirmAction.action === 'ban' || confirmAction.action === 'revoke') && (
                <input value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Reason (optional)…"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl text-text-primary mb-4 focus:outline-none focus:border-primary/40" />
              )}
              <div className="flex gap-2">
                <button onClick={() => { setConfirmAction(null); setReason('') }}
                  className="flex-1 py-2 rounded-xl border border-border text-sm text-text-muted hover:bg-surface-active transition-colors">
                  Cancel
                </button>
                <button onClick={() => doAction(confirmAction.userId, confirmAction.action)}
                  disabled={!!actionLoading}
                  className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {actionLoading ? 'Working…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  )
}
