'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Flag, RefreshCw, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface FeatureFlag { id: string; key: string; name: string; description: string; enabled: boolean; rollout_percentage: number; target_audience: string }

export default function FlagsTab() {
  const { data, isLoading, error, mutate } = useSWR<FeatureFlag[]>('/feature-flags', (p: string) => api<FeatureFlag[]>(p))
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ key: '', name: '', description: '', enabled: false, rollout_percentage: 100, target_audience: 'all' })
  const [saving, setSaving] = useState(false)

  const create = async () => {
    setSaving(true)
    try { await api('/feature-flags', 'POST', form); await mutate(); setModal(false); setForm({ key: '', name: '', description: '', enabled: false, rollout_percentage: 100, target_audience: 'all' }) }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) } finally { setSaving(false) }
  }

  const toggle = async (flag: FeatureFlag) => {
    try { await api(`/feature-flags/${flag.key}`, 'PATCH', { enabled: !flag.enabled }); await mutate() }
    catch (e) { alert('Failed') }
  }

  const remove = async (key: string) => { if (!confirm('Delete this flag?')) return; try { await api(`/feature-flags/${key}`, 'DELETE'); await mutate() } catch (e) { alert('Failed') } }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><Flag className="w-5 h-5 text-primary" /> Feature Flags</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"><Plus className="w-4 h-4" /> Add</button>
        </div>
      </div>
      {isLoading ? <div className="space-y-3">{Array(4).fill(0).map((_, i) => <ShimmerCard key={i} h="h-20" />)}</div>
        : error ? <div className="text-center py-10 text-sm text-rose-400">Failed to load flags</div>
        : <div className="space-y-3">{(data ?? []).length === 0 && <div className="text-center py-10 text-sm text-text-muted">No feature flags</div>}
          {(data ?? []).map(flag => (
            <div key={flag.id} className="card flex items-center justify-between p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-text-primary">{flag.name}</p>
                  <code className="text-[10px] font-mono bg-surface px-2 py-0.5 rounded border border-border text-text-muted">{flag.key}</code>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-surface border border-border text-text-muted">{flag.target_audience}</span>
                </div>
                <p className="text-xs text-text-muted">{flag.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 w-24 rounded-full bg-surface border border-border overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${flag.rollout_percentage}%` }} />
                  </div>
                  <span className="text-[10px] text-text-muted">{flag.rollout_percentage}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggle(flag)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10">{flag.enabled ? <ToggleRight className="w-5 h-5 text-primary"/> : <ToggleLeft className="w-5 h-5 text-text-disabled"/>}</button>
                <button onClick={() => remove(flag.key)} className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-400/10"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}</div>}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Feature Flag" size="lg">
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Key</label><input value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" /></div>
          <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" /></div>
          <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Rollout %</label><input type="number" min={0} max={100} value={form.rollout_percentage} onChange={e => setForm(f => ({ ...f, rollout_percentage: Number(e.target.value) }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" /></div>
            <div><label className="block text-xs font-semibold text-text-secondary mb-1.5">Audience</label><select value={form.target_audience} onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-secondary outline-none focus:ring-2 focus:ring-primary/50"><option value="all">All</option><option value="free">Free</option><option value="pro">Pro</option><option value="team">Team</option><option value="enterprise">Enterprise</option></select></div>
          </div>
          <button onClick={create} disabled={saving || !form.key || !form.name} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500">{saving ? 'Creating…' : 'Create Flag'}</button>
        </div>
      </Modal>
    </div>
  )
}
