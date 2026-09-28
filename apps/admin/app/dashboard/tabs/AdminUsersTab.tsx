'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { UserCog, Plus, RefreshCw, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface AdminUser { id: string; email: string; name: string; role: string; is_active: boolean; last_login_at: string; created_at: string }

export default function AdminUsersTab() {
  const { data, isLoading, error, mutate } = useSWR<AdminUser[]>('/admin-users', (p: string) => api<AdminUser[]>(p))
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'admin' })
  const [saving, setSaving] = useState(false)

  const create = async () => {
    setSaving(true)
    try { await api('/admin-users', 'POST', form); await mutate(); setModal(false); setForm({ email: '', name: '', password: '', role: 'admin' }) }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) } finally { setSaving(false) }
  }

  const remove = async (id: string) => { if (!confirm('Delete this admin user?')) return; try { await api(`/admin-users/${id}`, 'DELETE'); await mutate() } catch (e) { alert('Failed') } }

  if (error) return <div className="text-center py-10 text-sm text-rose-400">Failed to load admin users</div>
  if (isLoading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <ShimmerCard key={i} h="h-20" />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><UserCog className="w-5 h-5 text-primary" /> Admin Users</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500"><Plus className="w-4 h-4" /> Add Admin</button>
        </div>
      </div>
      <div className="space-y-3">
        {(data ?? []).length === 0 && <div className="text-center py-10 text-sm text-text-muted">No admin users</div>}
        {(data ?? []).map(u => (
          <div key={u.id} className="card flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-xs font-bold">{u.name?.[0]?.toUpperCase() || 'A'}</div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{u.name}</p>
                <p className="text-xs text-text-muted">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${u.role === 'super_admin' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>{u.role}</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${u.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-text-muted/10 text-text-muted border-text-muted/20'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
              <button onClick={() => remove(u.id)} className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-400/10"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Add Admin User" size="md">
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" /></div>
          <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" /></div>
          <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Password</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" /></div>
          <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Role</label><select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-secondary outline-none focus:ring-2 focus:ring-primary/50"><option value="admin">Admin</option><option value="moderator">Moderator</option><option value="viewer">Viewer</option></select></div>
          <button onClick={create} disabled={saving || !form.email || !form.password} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500">{saving ? 'Creating…' : 'Create Admin'}</button>
        </div>
      </Modal>
    </div>
  )
}
