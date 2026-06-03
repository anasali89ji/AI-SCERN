'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Megaphone, RefreshCw, Plus, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface Announcement {
  id: string; title: string; content: string; type: string
  target_audience: string; active: boolean; priority: number
  start_date: string; end_date?: string; created_at: string
}
interface AnnForm { title: string; content: string; type: string; target_audience: string; priority: number; end_date: string }

const TYPES = ['info', 'warning', 'promotion', 'maintenance']
const AUDIENCES = ['all', 'free', 'pro', 'team', 'enterprise']

export default function AnnouncementsTab() {
  const { data, isLoading, error, mutate } = useSWR<Announcement[]>('/announcements', (p: string) => api<Announcement[]>(p))
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<AnnForm>({ title: '', content: '', type: 'info', target_audience: 'all', priority: 0, end_date: '' })
  const [saving, setSaving] = useState(false)

  const create = async () => {
    setSaving(true)
    try {
      await api('/announcements', 'POST', form)
      await mutate(); setModal(false)
      setForm({ title: '', content: '', type: 'info', target_audience: 'all', priority: 0, end_date: '' })
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
    finally { setSaving(false) }
  }

  const toggleActive = async (ann: Announcement) => {
    try { await api(`/announcements/${ann.id}`, 'PATCH', { active: !ann.active }); await mutate() }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this announcement?')) return
    try { await api(`/announcements/${id}`, 'DELETE'); await mutate() }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
  }

  const TYPE_COLORS: Record<string, string> = {
    info: 'badge-info', warning: 'badge-warning', promotion: 'badge-promotion', maintenance: 'badge-maintenance'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" /> Announcements
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} aria-label="Refresh" className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
            <Plus className="w-4 h-4" /> New
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <ShimmerCard key={i} h="h-20" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load announcements</div>
      ) : (
        <div className="space-y-3">
          {(data ?? []).length === 0 && (
            <div className="text-center py-10 text-sm text-text-muted">No announcements yet</div>
          )}
          {(data ?? []).map(ann => (
            <div key={ann.id} className="card flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge ${TYPE_COLORS[ann.type] ?? 'badge-info'}`}>{ann.type}</span>
                  <span className={`badge ${ann.target_audience === 'all' ? 'badge-free' : 'badge-pro'}`}>{ann.target_audience}</span>
                  {!ann.active && <span className="badge badge-inactive">Inactive</span>}
                </div>
                <p className="text-sm font-semibold text-text-primary mb-0.5">{ann.title}</p>
                <p className="text-xs text-text-muted line-clamp-2">{ann.content}</p>
                <p className="text-[10px] text-text-disabled mt-1">
                  Created {new Date(ann.created_at).toLocaleDateString()}
                  {ann.end_date && ` · Ends ${new Date(ann.end_date).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button role="switch" aria-checked={ann.active} aria-label={`Toggle ${ann.title}`}
                  onClick={() => toggleActive(ann)}
                  className="relative flex-shrink-0 rounded-full transition-colors"
                  style={{ width: 36, height: 20, background: ann.active ? '#2563eb' : '#1c1c2e' }}>
                  <span className="absolute top-0.5 left-0.5 w-[16px] h-[16px] rounded-full bg-white transition-transform"
                    style={{ transform: ann.active ? 'translateX(16px)' : 'none' }} />
                </button>
                <button onClick={() => remove(ann.id)} aria-label={`Delete ${ann.title}`}
                  className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-400/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Create Announcement" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Content</label>
            <textarea rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-secondary outline-none focus:ring-2 focus:ring-primary/50">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Audience</label>
              <select value={form.target_audience} onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-secondary outline-none focus:ring-2 focus:ring-primary/50">
                {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">End Date (optional)</label>
            <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <button onClick={create} disabled={saving || !form.title || !form.content}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
            {saving ? 'Creating…' : 'Publish Announcement'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
