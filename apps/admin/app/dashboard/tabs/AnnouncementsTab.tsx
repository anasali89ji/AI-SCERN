'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Megaphone, RefreshCw, Plus, Trash2, Bell, Calendar, Users } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface Announcement {
  id: string; title: string; content: string; type: string
  target_audience: string; active: boolean; priority: number
  start_date: string; end_date?: string; created_at: string
  scheduled: boolean; send_notification: boolean
}

interface AnnForm {
  title: string; content: string; type: string
  target_audience: string; priority: number
  start_date: string; end_date: string
  scheduled: boolean; send_notification: boolean
}

const TYPES = ['info', 'warning', 'promotion', 'maintenance']
const AUDIENCES = ['all', 'free', 'pro', 'team', 'enterprise']

export default function AnnouncementsTab() {
  const { data, isLoading, error, mutate } = useSWR<Announcement[]>('/announcements', (p: string) => api<Announcement[]>(p))
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<AnnForm>({
    title: '', content: '', type: 'info', target_audience: 'all',
    priority: 0, end_date: '', start_date: '', scheduled: false, send_notification: true
  })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')

  const create = async () => {
    setSaving(true)
    try {
      await api('/announcements', 'POST', form)
      await mutate(); setModal(false)
      setForm({ title: '', content: '', type: 'info', target_audience: 'all', priority: 0, end_date: '', start_date: '', scheduled: false, send_notification: true })
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

  const filtered = (data ?? []).filter(a => filter === 'all' ? true : a.type === filter)

  const TYPE_COLORS: Record<string, string> = {
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    promotion: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    maintenance: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" /> Announcements
        </h2>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-border text-text-secondary">
            <option value="all">All Types</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all">
            <Plus className="w-4 h-4" /> New
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <ShimmerCard key={i} h="h-24" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load announcements</div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && <div className="text-center py-10 text-sm text-text-muted">No announcements yet</div>}
          {filtered.map(ann => (
            <div key={ann.id} className="card flex items-start gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${TYPE_COLORS[ann.type] ?? TYPE_COLORS.info}`}>{ann.type}</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-surface border border-border text-text-muted">{ann.target_audience}</span>
                  {!ann.active && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-surface border border-border text-text-disabled">Inactive</span>}
                  {ann.scheduled && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1"><Calendar className="w-3 h-3"/> Scheduled</span>}
                  {ann.send_notification && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-surface border border-border text-text-muted flex items-center gap-1"><Bell className="w-3 h-3"/> Notify</span>}
                </div>
                <p className="text-sm font-semibold text-text-primary mb-0.5">{ann.title}</p>
                <p className="text-xs text-text-muted line-clamp-2">{ann.content}</p>
                <p className="text-[10px] text-text-disabled mt-1 flex items-center gap-3">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(ann.created_at).toLocaleDateString()}</span>
                  {ann.end_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> Ends {new Date(ann.end_date).toLocaleDateString()}</span>}
                  <span className="flex items-center gap-1"><Users className="w-3 h-3"/> Priority {ann.priority}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleActive(ann)}
                  className={`relative flex-shrink-0 rounded-full transition-colors ${ann.active ? 'bg-blue-600' : 'bg-surface border border-border'}`}
                  style={{ width: 40, height: 22 }}>
                  <span className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform"
                    style={{ transform: ann.active ? 'translateX(18px)' : 'none' }} />
                </button>
                <button onClick={() => remove(ann.id)}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Start Date</label>
              <input type="datetime-local" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">End Date (optional)</label>
              <input type="datetime-local" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="checkbox" checked={form.scheduled} onChange={e => setForm(f => ({ ...f, scheduled: e.target.checked }))}
                className="rounded border-border bg-surface text-primary" />
              Schedule for later
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="checkbox" checked={form.send_notification} onChange={e => setForm(f => ({ ...f, send_notification: e.target.checked }))}
                className="rounded border-border bg-surface text-primary" />
              Send notification to users
            </label>
          </div>
          <button onClick={create} disabled={saving || !form.title || !form.content}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all">
            {saving ? 'Creating…' : 'Publish Announcement'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
