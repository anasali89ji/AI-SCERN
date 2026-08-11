'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Palette, RefreshCw, Save } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

export default function BrandingTab() {
  const { data, isLoading, error, mutate } = useSWR('/branding', (p: string) => api<Record<string, string>>(p))
  const [changes, setChanges] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const update = (key: string, value: string) => setChanges(prev => ({ ...prev, [key]: value }))
  const save = async () => {
    setSaving(true)
    try { await api('/branding', 'PATCH', changes); await mutate(); setChanges({}); alert('Branding saved!') }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) } finally { setSaving(false) }
  }

  const current = data ?? {}
  const get = (key: string) => changes[key] ?? current[key] ?? ''

  if (error) return <div className="text-center py-10 text-sm text-rose-400">Failed to load branding</div>
  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div>

  const fields = [
    { key: 'site_name', label: 'Site Name' }, { key: 'site_tagline', label: 'Tagline' },
    { key: 'primary_color', label: 'Primary Color' }, { key: 'secondary_color', label: 'Secondary Color' },
    { key: 'logo_url', label: 'Logo URL' }, { key: 'favicon_url', label: 'Favicon URL' },
    { key: 'email_from_name', label: 'Email From Name' }, { key: 'email_from_address', label: 'Email From Address' },
    { key: 'support_email', label: 'Support Email' }, { key: 'social_twitter', label: 'Twitter' },
    { key: 'social_discord', label: 'Discord' }, { key: 'social_github', label: 'GitHub' },
    { key: 'footer_text', label: 'Footer Text' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2"><Palette className="w-5 h-5 text-primary" /> Branding</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={save} disabled={saving || Object.keys(changes).length === 0} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {fields.map(f => (
          <div key={f.key} className="card p-4">
            <label className="block text-sm font-semibold text-text-primary mb-1.5">{f.label}</label>
            <input value={get(f.key)} onChange={e => update(f.key, e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        ))}
        <div className="card p-4 lg:col-span-2">
          <label className="block text-sm font-semibold text-text-primary mb-1.5">Custom CSS</label>
          <textarea rows={6} value={get('custom_css')} onChange={e => update('custom_css', e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono" />
        </div>
      </div>
    </div>
  )
}
