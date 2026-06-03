'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Settings, Save, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface AppSettings {
  maintenance_mode: boolean; registration_open: boolean; free_scans_limit: number
  pro_scans_limit: number; team_scans_limit: number; max_file_size_mb: number
  support_email: string; site_announcement?: string
}

export default function SettingsTab() {
  const { data, isLoading, error, mutate } = useSWR<AppSettings>('/settings', (p: string) => api<AppSettings>(p))
  const [form, setForm]   = useState<Partial<AppSettings>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const merged = { ...data, ...form } as AppSettings

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      await api('/settings', 'PATCH', form)
      await mutate(); setForm({}); setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
    finally { setSaving(false) }
  }

  const set = (key: keyof AppSettings, value: unknown) => setForm(f => ({ ...f, [key]: value }))

  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} h="h-16" />)}</div>
  if (error) return <div className="text-center py-10 text-sm text-rose-400">Failed to load settings</div>

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" /> Settings
        </h2>
        <button onClick={() => mutate()} aria-label="Refresh" className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="card space-y-5">
        <h3 className="text-sm font-bold text-text-primary border-b border-border pb-3">Access Control</h3>
        {[
          { key: 'maintenance_mode' as const, label: 'Maintenance Mode', sub: 'Blocks all non-admin access' },
          { key: 'registration_open' as const, label: 'Open Registration', sub: 'Allow new user sign-ups' },
        ].map(({ key, label, sub }) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">{label}</p>
              <p className="text-xs text-text-muted">{sub}</p>
            </div>
            <button role="switch" aria-checked={merged[key]} aria-label={label}
              onClick={() => set(key, !merged[key])}
              className={`relative flex-shrink-0 transition-colors rounded-full`}
              style={{ width: 40, height: 22, background: merged[key] ? '#2563eb' : '#1c1c2e' }}>
              <span className="absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform"
                style={{ transform: merged[key] ? 'translateX(18px)' : 'none' }} />
            </button>
          </div>
        ))}
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-bold text-text-primary border-b border-border pb-3">Scan Limits</h3>
        {[
          { key: 'free_scans_limit'  as const, label: 'Free Plan Limit' },
          { key: 'pro_scans_limit'   as const, label: 'Pro Plan Limit' },
          { key: 'team_scans_limit'  as const, label: 'Team Plan Limit' },
          { key: 'max_file_size_mb'  as const, label: 'Max File Size (MB)' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">{label}</label>
            <input type="number" value={merged[key] ?? ''} onChange={e => set(key, Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-background border border-border text-text-primary
                outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
          </div>
        ))}
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-bold text-text-primary border-b border-border pb-3">Notifications</h3>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">Support Email</label>
          <input value={merged.support_email ?? ''} onChange={e => set('support_email', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm bg-background border border-border text-text-primary
              outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">Site Announcement (leave empty to hide)</label>
          <textarea rows={3} value={merged.site_announcement ?? ''} onChange={e => set('site_announcement', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm bg-background border border-border text-text-primary
              outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none" />
        </div>
      </div>

      <button onClick={save} disabled={saving || Object.keys(form).length === 0}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white
          disabled:opacity-40 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
        style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
        <Save className="w-4 h-4" />
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
      </button>
    </div>
  )
}
