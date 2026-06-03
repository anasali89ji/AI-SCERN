'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Flag, RefreshCw, Plus } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface FeatureFlag {
  id: string; key: string; name: string; description?: string; enabled: boolean
  rollout_percentage: number; target_plans?: string[]; updated_at: string
}

export default function FlagsTab() {
  const { data, isLoading, error, mutate } = useSWR<FeatureFlag[]>('/feature-flags', (p: string) => api<FeatureFlag[]>(p))
  const [newModal, setNewModal] = useState(false)
  const [form, setForm]         = useState({ key: '', name: '', description: '', rollout_percentage: 100 })
  const [saving, setSaving]     = useState(false)

  const toggle = async (flag: FeatureFlag) => {
    try {
      await api(`/feature-flags/${flag.key}`, 'PATCH', { enabled: !flag.enabled })
      await mutate()
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
  }

  const create = async () => {
    setSaving(true)
    try {
      await api('/feature-flags', 'POST', { ...form, enabled: false })
      await mutate(); setNewModal(false)
      setForm({ key: '', name: '', description: '', rollout_percentage: 100 })
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Flag className="w-5 h-5 text-primary" /> Feature Flags
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} aria-label="Refresh" className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
            <Plus className="w-4 h-4" /> New Flag
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array(5).fill(0).map((_, i) => <ShimmerCard key={i} h="h-16" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load flags</div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map(flag => (
            <div key={flag.id} className="card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-text-primary">{flag.name}</p>
                  <code className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">{flag.key}</code>
                </div>
                {flag.description && <p className="text-xs text-text-muted">{flag.description}</p>}
                <p className="text-[11px] text-text-disabled mt-1">Rollout: {flag.rollout_percentage}% · Updated {new Date(flag.updated_at).toLocaleDateString()}</p>
              </div>
              {/* Toggle */}
              <button role="switch" aria-checked={flag.enabled} aria-label={`Toggle ${flag.name}`}
                onClick={() => toggle(flag)}
                className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0
                  ${flag.enabled ? 'bg-primary' : 'bg-border'}`}
                style={{ height: '22px', width: '40px' }}>
                <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform
                  ${flag.enabled ? 'translate-x-[18px]' : 'translate-x-0'}`} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={newModal} onClose={() => setNewModal(false)} title="Create Feature Flag">
        <div className="space-y-4">
          {(['key', 'name', 'description'] as const).map(field => (
            <div key={field}>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 capitalize">{field}</label>
              <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Rollout %</label>
            <input type="number" min={0} max={100} value={form.rollout_percentage}
              onChange={e => setForm(f => ({ ...f, rollout_percentage: Number(e.target.value) }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <button onClick={create} disabled={saving || !form.key || !form.name}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
            {saving ? 'Creating…' : 'Create Flag'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
