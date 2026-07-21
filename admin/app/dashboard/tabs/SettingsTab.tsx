'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Settings, RefreshCw, Save } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface Setting { key: string; value?: string | number | boolean; label: string; type: 'text' | 'number' | 'boolean' | 'select'; options?: string[]; description: string }

const SETTINGS_DEF: Setting[] = [
  { key: 'maintenance_mode', label: 'Maintenance Mode', type: 'boolean', description: 'Put the site in maintenance mode' },
  { key: 'registration_open', label: 'Registration Open', type: 'boolean', description: 'Allow new user registrations' },
  { key: 'free_scans_limit', label: 'Free Scans Limit', type: 'number', description: 'Monthly scan limit for free users' },
  { key: 'pro_scans_limit', label: 'Pro Scans Limit', type: 'number', description: 'Monthly scan limit for pro users' },
  { key: 'max_file_size_mb', label: 'Max File Size (MB)', type: 'number', description: 'Maximum upload file size' },
  { key: 'support_email', label: 'Support Email', type: 'text', description: 'Email address for support inquiries' },
  { key: 'default_plan', label: 'Default Plan', type: 'select', options: ['free', 'starter', 'pro', 'enterprise'], description: 'Default plan for new users' },
  { key: 'referral_credits', label: 'Referral Credits', type: 'number', description: 'Credits awarded for referrals' },
  { key: 'data_retention_days', label: 'Data Retention (Days)', type: 'number', description: 'How long to keep scan data' },
  { key: 'enable_ai_chat', label: 'Enable AI Chat', type: 'boolean', description: 'Enable AI chat feature' },
  { key: 'enable_image_detection', label: 'Enable Image Detection', type: 'boolean', description: 'Enable image detection' },
  { key: 'enable_audio_detection', label: 'Enable Audio Detection', type: 'boolean', description: 'Enable audio detection' },
  { key: 'enable_video_detection', label: 'Enable Video Detection', type: 'boolean', description: 'Enable video detection' },
  { key: 'require_email_verification', label: 'Require Email Verification', type: 'boolean', description: 'Require email verification before using features' },
]

export default function SettingsTab() {
  const { data, isLoading, error, mutate } = useSWR('/settings', (p: string) => api<Record<string, unknown>>(p))
  const [changes, setChanges] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const update = (key: string, value: unknown) => setChanges(prev => ({ ...prev, [key]: value }))
  const save = async () => {
    setSaving(true)
    try { await api('/settings', 'PATCH', changes); await mutate(); setChanges({}); alert('Settings saved!') }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) } finally { setSaving(false) }
  }

  const current = (data ?? {}) as Record<string, unknown>
  const getValue = (key: string, type: string) => {
    if (key in changes) return changes[key]
    if (key in current) return current[key]
    return type === 'boolean' ? false : type === 'number' ? 0 : ''
  }

  if (error) return <div className="text-center py-10 text-sm text-rose-400">Failed to load settings</div>
  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><Settings className="w-5 h-5 text-primary" /> Settings</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={save} disabled={saving || Object.keys(changes).length === 0} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SETTINGS_DEF.map(s => (
          <div key={s.key} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-text-primary">{s.label}</label>
              {s.type === 'boolean' ? (
                <button onClick={() => update(s.key, !getValue(s.key, s.type))} className={`relative flex-shrink-0 rounded-full transition-colors ${getValue(s.key, s.type) ? 'bg-blue-600' : 'bg-surface border border-border'}`} style={{ width: 40, height: 22 }}>
                  <span className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: getValue(s.key, s.type) ? 'translateX(18px)' : 'none' }} />
                </button>
              ) : null}
            </div>
            <p className="text-[11px] text-text-muted mb-2">{s.description}</p>
            {s.type === 'text' && <input value={String(getValue(s.key, s.type) ?? '')} onChange={e => update(s.key, e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />}
            {s.type === 'number' && <input type="number" value={Number(getValue(s.key, s.type) ?? 0)} onChange={e => update(s.key, Number(e.target.value))} className="w-full px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />}
            {s.type === 'select' && (
              <select value={String(getValue(s.key, s.type) ?? '')} onChange={e => update(s.key, e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50">
                {s.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
