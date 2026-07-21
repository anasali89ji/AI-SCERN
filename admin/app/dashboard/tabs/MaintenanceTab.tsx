'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Wrench, RefreshCw, Save, Power } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

export default function MaintenanceTab() {
  const { data, isLoading, error, mutate } = useSWR('/maintenance', (p: string) => api<Record<string, unknown>>(p))
  const [form, setForm] = useState({ enabled: false, message: '', allowed_ips: [] as string[], estimated_duration: '' })
  const [saving, setSaving] = useState(false)

  const current = data as any
  const enabled = form.enabled !== undefined ? form.enabled : current?.enabled ?? false

  const save = async () => {
    setSaving(true)
    try { await api('/maintenance', 'PATCH', form); await mutate(); alert('Maintenance settings saved!') }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) } finally { setSaving(false) }
  }

  if (error) return <div className="text-center py-10 text-sm text-rose-400">Failed to load maintenance settings</div>
  if (isLoading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><Wrench className="w-5 h-5 text-primary" /> Maintenance Mode</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <div className="card p-6 space-y-6">
        <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border">
          <div>
            <p className="text-sm font-semibold text-text-primary">Maintenance Mode</p>
            <p className="text-xs text-text-muted">When enabled, only allowed IPs can access the site</p>
          </div>
          <button onClick={() => setForm(f => ({ ...f, enabled: !enabled }))} className={`relative flex-shrink-0 rounded-full transition-colors ${enabled ? 'bg-rose-600' : 'bg-surface border border-border'}`} style={{ width: 48, height: 26 }}>
            <span className="absolute top-[3px] left-[3px] w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: enabled ? 'translateX(22px)' : 'none' }} />
          </button>
        </div>
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">Maintenance Message</label>
          <textarea rows={3} value={form.message !== undefined ? form.message : String(current?.message ?? '')} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">Estimated Duration</label>
          <input value={form.estimated_duration !== undefined ? form.estimated_duration : String(current?.estimated_duration ?? '')} onChange={e => setForm(f => ({ ...f, estimated_duration: e.target.value }))} placeholder="e.g. 2 hours" className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">Allowed IPs (one per line)</label>
          <textarea rows={4} value={(form.allowed_ips !== undefined ? form.allowed_ips : (current?.allowed_ips as string[]) ?? []).join('\n')} onChange={e => setForm(f => ({ ...f, allowed_ips: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono" />
        </div>
      </div>
    </div>
  )
}
