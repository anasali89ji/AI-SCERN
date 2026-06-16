'use client'
import { ScrollToTop }    from '@/components/ScrollToTop'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion }         from 'framer-motion'
import {
  Bell, Shield, Save, Loader2, Trash2, Sliders, Key, Palette,
  Globe, Download, AlertTriangle, Copy, Check, Lock, Smartphone,
  Moon, Sun, Monitor, FileText, Zap, Eye, EyeOff,
  RefreshCw, Mail, ToggleLeft, Database, Languages, Clock,
  ChevronRight, Star, BrainCircuit, Plus, XCircle,
} from 'lucide-react'
import { createClient }  from '@/lib/supabase/client'
import { useAuth }       from '@/components/auth-provider'
import { toast }         from 'sonner'
import { useClerk }      from '@clerk/nextjs'
import { useAnimationPref } from '@/components/AnimationPreferenceContext'
import type { UserSettings } from '@/lib/settings/types'

// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-40 ${checked ? 'bg-primary' : 'bg-border'}`}>
      <motion.div animate={{ x: checked ? 22 : 2 }} transition={{ type:'spring', stiffness:500, damping:30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm" />
    </button>
  )
}

// ── Setting Row ───────────────────────────────────────────────────────────────
function SettingRow({ icon: Icon, label, description, action, badge }: {
  icon: React.ElementType; label: string; description?: string; action: React.ReactNode; badge?: string
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border/30 last:border-0 gap-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary">{label}</span>
            {badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold">{badge}</span>}
          </div>
          {description && <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      className="bg-surface border border-border/55 rounded-2xl p-4 sm:p-6">
      <h2 className="font-bold text-text-primary flex items-center gap-2 mb-1 pb-3 border-b border-border/30">
        <Icon className="w-4 h-4 text-primary" /> {title}
      </h2>
      {children}
    </motion.div>
  )
}

// ── API Key row ────────────────────────────────────────────────────────────────
interface ApiKeyRecord { id: string; name: string; is_active: boolean; calls_today: number; daily_limit: number; last_used_at: string | null; created_at: string }

function ApiKeySection({ userId }: { userId: string }) {
  const [keys,       setKeys]       = useState<ApiKeyRecord[]>([])
  const [loading,    setLoading]    = useState(true)
  const [creating,   setCreating]   = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [revealedKey,setRevealedKey]= useState<string | null>(null)
  const [copied,     setCopied]     = useState(false)
  const [revoking,   setRevoking]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/user/api-keys').catch(() => null)
    if (res?.ok) { const j = await res.json(); setKeys(j.data ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const createKey = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    const res = await fetch('/api/user/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName.trim() }),
    })
    if (res.ok) {
      const j = await res.json()
      setRevealedKey(j.data.key)   // shown once
      setNewKeyName('')
      await load()
      toast.success('API key created — copy it now, it won\'t be shown again')
    } else {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error ?? 'Failed to create key')
    }
    setCreating(false)
  }

  const revokeKey = async (id: string) => {
    setRevoking(id)
    const res = await fetch(`/api/user/api-keys/${id}`, { method: 'DELETE' })
    if (res.ok) { await load(); toast.success('Key revoked') }
    else toast.error('Failed to revoke key')
    setRevoking(null)
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  if (loading) return <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      {/* One-time reveal */}
      {revealedKey && (
        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
          <p className="text-xs text-emerald-400 font-semibold">⚠ Copy your API key now — it won't be shown again</p>
          <div className="flex items-center gap-2">
            <code className="text-[11px] text-emerald-300 font-mono bg-black/30 px-2 py-1 rounded flex-1 break-all">{revealedKey}</code>
            <button onClick={() => copyKey(revealedKey)} className="text-emerald-400 hover:text-emerald-300 transition-colors">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={() => setRevealedKey(null)} className="text-xs text-text-muted hover:text-text-secondary">Dismiss</button>
        </div>
      )}

      {/* Existing keys */}
      {keys.filter(k => k.is_active).map(k => (
        <div key={k.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/20 last:border-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{k.name}</p>
            <p className="text-[11px] text-text-muted mt-0.5">
              {k.calls_today}/{k.daily_limit} calls today
              {k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleDateString()}` : ' · never used'}
            </p>
          </div>
          <button onClick={() => revokeKey(k.id)} disabled={revoking === k.id}
            className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
            {revoking === k.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />} Revoke
          </button>
        </div>
      ))}

      {keys.filter(k => k.is_active).length === 0 && !revealedKey && (
        <p className="text-xs text-text-muted py-2">No active API keys. Create one below to use the API.</p>
      )}

      {/* Create new key */}
      {keys.filter(k => k.is_active).length < 5 && (
        <div className="flex gap-2 pt-1">
          <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void createKey() }}
            placeholder="Key name (e.g. Production)"
            className="flex-1 text-xs bg-surface-active border border-border/55 rounded-lg px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary" />
          <button onClick={createKey} disabled={creating || !newKeyName.trim()}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
            {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Create
          </button>
        </div>
      )}
      <p className="text-[11px] text-text-muted">
        Use your key with <code className="bg-surface-active px-1 py-0.5 rounded text-primary">X-API-Key: &lt;key&gt;</code> on <code className="bg-surface-active px-1 py-0.5 rounded text-primary">/api/v1/detect/{'{'}text|image|audio{'}'}</code>.
        {' '}<a href="/docs/api" className="text-primary hover:underline">API docs →</a>
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, signOut }   = useAuth()
  const { openUserProfile } = useClerk()
  const supabase            = createClient()
  const { setReduceAnimations } = useAnimationPref()

  const [s, setS] = useState<UserSettings>({
    email_notif: true, batch_alerts: true, weekly_report: false, auto_save: true, upgrade_alerts: true,
    high_acc_mode: false, save_history: true, auto_download_pdf: false, show_confidence: true,
    show_signals: true, default_modality: 'text',
    public_profile: false, share_anon: true, analytics_opt_out: false, data_retention_days: 90,
    theme: 'dark', language: 'en', compact_view: false, animations_off: false,
  })

  const [loading,       setLoading]      = useState(true)
  const [saving,        setSaving]       = useState(false)
  const [deleting,      setDeleting]     = useState(false)
  const [confirmDelete, setConfirmDelete]= useState(false)
  const dirtyRef = useRef(false)

  // ── Load from DB on mount, fallback to localStorage cache ─────────────────
  const loadSettings = useCallback(async () => {
    if (!user?.uid) return
    try {
      // 1. Apply localStorage cache immediately for instant UI hydration
      const cached = localStorage.getItem(`aiscern_settings_cache_${user.uid}`)
      if (cached) setS(prev => ({ ...prev, ...JSON.parse(cached) }))

      // 2. Fetch DB (source of truth) and overwrite
      const res = await fetch('/api/user/settings')
      if (res.ok) {
        const { settings } = await res.json()
        setS(settings)
        localStorage.setItem(`aiscern_settings_cache_${user.uid}`, JSON.stringify(settings))
        // Sync animation pref immediately after load
        setReduceAnimations(settings.animations_off)
        localStorage.setItem('aiscern_animations_off', String(settings.animations_off))
      }
    } catch { /* use localStorage cache */ } finally {
      setLoading(false)
    }
  }, [user?.uid, setReduceAnimations])

  useEffect(() => { void loadSettings() }, [loadSettings])

  // ── Debounced auto-save (fires 800ms after last change) ───────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const patchSettings = useCallback(async (patch: Partial<UserSettings>) => {
    setS(prev => ({ ...prev, ...patch }))
    dirtyRef.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!dirtyRef.current) return
      try {
        await fetch('/api/user/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        dirtyRef.current = false
      } catch { /* silent — Save All button is fallback */ }
    }, 800)

    // Side-effects for settings that need immediate client action
    if ('animations_off' in patch) {
      setReduceAnimations(!!patch.animations_off)
      localStorage.setItem('aiscern_animations_off', String(!!patch.animations_off))
    }
    if ('theme' in patch) {
      const root = document.documentElement
      root.classList.remove('dark', 'light')
      if (patch.theme === 'system') {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark')
        else root.classList.add('light')
      } else {
        root.classList.add(patch.theme!)
      }
    }
  }, [setReduceAnimations])

  // ── Save All (explicit button) ────────────────────────────────────────────
  const handleSave = async () => {
    if (!user?.uid) return
    setSaving(true)
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      })
      if (res.ok) {
        localStorage.setItem(`aiscern_settings_cache_${user.uid}`, JSON.stringify(s))
        dirtyRef.current = false
        toast.success('Settings saved')
      } else {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error ?? 'Failed to save settings')
      }
    } catch { toast.error('Network error — try again') }
    setSaving(false)
  }

  const tog = (k: keyof UserSettings) => patchSettings({ [k]: !s[k] } as Partial<UserSettings>)
  const sel = <K extends keyof UserSettings>(k: K, v: UserSettings[K]) => patchSettings({ [k]: v } as Partial<UserSettings>)

  const exportData = async () => {
    if (!user?.uid) return
    const { data: scans } = await (supabase as ReturnType<typeof createClient>).from('scans').select('*').eq('user_id', user.uid)
    const blob = new Blob([JSON.stringify({ scans, settings: s, exported_at: new Date().toISOString() }, null, 2)], { type:'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aiscern-data.json'; a.click()
    toast.success('Data exported')
  }

  const deleteAccount = async () => {
    if (!confirmDelete || !user?.uid) return
    setDeleting(true)
    await fetch('/api/delete-account', { method:'POST' }).catch(() => {})
    await signOut()
  }

  if (loading) return (
    <div className="p-4 sm:p-8 flex items-center justify-center min-h-64">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 2xl:p-10 max-w-2xl 2xl:max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-text-primary">Settings</h1>
          <p className="text-sm text-text-muted mt-0.5">Customize your Aiscern experience</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all hover:scale-[1.02]"
          style={{ background:'linear-gradient(135deg,#2563eb,#2563eb)' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All
        </button>
      </div>

      {/* Notifications */}
      <Section title="Notifications" icon={Bell}>
        <SettingRow icon={Mail}      label="Email notifications" description="Scan summaries and account updates via email"         action={<Toggle checked={s.email_notif}    onChange={() => tog('email_notif')} />} />
        <SettingRow icon={Bell}      label="Batch scan alerts"   description="Notify when bulk scan results are ready"              action={<Toggle checked={s.batch_alerts}   onChange={() => tog('batch_alerts')} />} />
        <SettingRow icon={Star}      label="Upgrade alerts"      description="Get notified of plan changes from admin"              action={<Toggle checked={s.upgrade_alerts} onChange={() => tog('upgrade_alerts')} />} />
        <SettingRow icon={FileText}  label="Weekly report"       description="Weekly digest of your detection activity"            action={<Toggle checked={s.weekly_report}  onChange={() => tog('weekly_report')} />} />
        <SettingRow icon={RefreshCw} label="Auto-save results"   description="Save every scan result to history automatically"     action={<Toggle checked={s.auto_save}      onChange={() => tog('auto_save')} />} />
      </Section>

      {/* Detection */}
      <Section title="Detection Preferences" icon={BrainCircuit}>
        <SettingRow icon={Zap}       label="High-accuracy mode"  description="Forces the full CV+Brain+HF ensemble even on fast-path eligible images (slower, ~2× credits)" badge="PRO"
          action={<Toggle checked={s.high_acc_mode}   onChange={() => tog('high_acc_mode')} />} />
        <SettingRow icon={Database}  label="Save scan history"   description="Keep all scan results in your history tab"            action={<Toggle checked={s.save_history}   onChange={() => tog('save_history')} />} />
        <SettingRow icon={Download}  label="Auto-download PDF"   description="Automatically download PDF report after each scan"   action={<Toggle checked={s.auto_download_pdf} onChange={() => tog('auto_download_pdf')} />} />
        <SettingRow icon={Sliders}   label="Show confidence %"   description="Display confidence scores on all results"            action={<Toggle checked={s.show_confidence} onChange={() => tog('show_confidence')} />} />
        <SettingRow icon={Eye}       label="Show signal details" description="Show individual detection signals on results"         action={<Toggle checked={s.show_signals}   onChange={() => tog('show_signals')} />} />
        <SettingRow icon={ToggleLeft} label="Default modality"   description="Pre-select this tab when opening the detector"
          action={
            <select value={s.default_modality} onChange={e => sel('default_modality', e.target.value as UserSettings['default_modality'])}
              className="text-xs bg-surface-active border border-border/55 rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:border-primary">
              {(['text','image','audio','video','url'] as const).map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
            </select>
          } />
      </Section>

      {/* Interface */}
      <Section title="Interface" icon={Palette}>
        <SettingRow icon={Moon} label="Theme" description="Changes the site color scheme immediately"
          action={
            <div className="flex gap-1">
              {(['dark','light','system'] as const).map(t => (
                <button key={t} onClick={() => sel('theme', t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${s.theme===t ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border/55 text-text-muted hover:text-text-secondary'}`}>
                  {t==='dark' ? <Moon className="w-3 h-3 inline mr-1"/> : t==='light' ? <Sun className="w-3 h-3 inline mr-1"/> : <Monitor className="w-3 h-3 inline mr-1"/>}
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
          } />
        <SettingRow icon={Languages} label="Language" description="Interface language (English only for now — more coming soon)"
          action={
            <select value={s.language} onChange={e => sel('language', e.target.value as UserSettings['language'])}
              className="text-xs bg-surface-active border border-border/55 rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:border-primary">
              <option value="en">English</option>
              <option value="ur" disabled>اردو (Urdu) — soon</option>
              <option value="ar" disabled>العربية (Arabic) — soon</option>
              <option value="es" disabled>Español — soon</option>
              <option value="fr" disabled>Français — soon</option>
            </select>
          } />
        <SettingRow icon={Monitor} label="Compact view"      description="Reduce padding for a denser layout"           action={<Toggle checked={s.compact_view}    onChange={() => tog('compact_view')} />} />
        <SettingRow icon={Zap}    label="Reduce animations"  description="Disable motion effects — applies to streaming text, page transitions, and tool cards"
          action={<Toggle checked={s.animations_off}  onChange={() => tog('animations_off')} />} />
      </Section>

      {/* Privacy */}
      <Section title="Privacy" icon={Shield}>
        <SettingRow icon={Globe}        label="Public profile"              description="Allow others to see your username and stats"       action={<Toggle checked={s.public_profile}   onChange={() => tog('public_profile')} />} />
        <SettingRow icon={BrainCircuit} label="Contribute to model training" description="Share anonymized scan results to improve accuracy" action={<Toggle checked={s.share_anon}       onChange={() => tog('share_anon')} />} />
        <SettingRow icon={Eye}          label="Opt out of analytics"        description="Disable usage analytics collection"                action={<Toggle checked={s.analytics_opt_out} onChange={() => tog('analytics_opt_out')} />} />
        <SettingRow icon={Clock}        label="Data retention" description="How long to keep scan history (enforced nightly)"
          action={
            <select value={String(s.data_retention_days)} onChange={e => sel('data_retention_days', Number(e.target.value) as UserSettings['data_retention_days'])}
              className="text-xs bg-surface-active border border-border/55 rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:border-primary">
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="-1">Forever</option>
            </select>
          } />
      </Section>

      {/* Security & API */}
      <Section title="Security & API" icon={Lock}>
        <SettingRow icon={Smartphone} label="Manage 2FA & password" description="Update security settings via Clerk"
          action={
            <button onClick={() => openUserProfile()} className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
              Manage <ChevronRight className="w-3 h-3" />
            </button>
          } />
        <div className="pt-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"><Key className="w-4 h-4 text-primary" /></div>
            <div>
              <p className="text-sm font-semibold text-text-primary">API Keys</p>
              <p className="text-xs text-text-muted mt-0.5">For programmatic access via the REST API — up to 5 active keys</p>
            </div>
          </div>
          {user?.uid && <ApiKeySection userId={user.uid} />}
        </div>
      </Section>

      {/* Data */}
      <Section title="Data & Storage" icon={Database}>
        <SettingRow icon={Download} label="Export your data" description="Download all your scans + settings as JSON"
          action={
            <button onClick={exportData} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border/55 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors">
              <Download className="w-3 h-3" /> Export
            </button>
          } />
        <SettingRow icon={Trash2} label="Clear scan history" description="Delete all saved detection results permanently"
          action={
            <button onClick={async () => {
              if (!user?.uid) return
              await (supabase as ReturnType<typeof createClient>).from('scans').delete().eq('user_id', user.uid)
              toast.success('History cleared')
            }} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          } />
      </Section>

      {/* Danger zone */}
      <motion.div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-4 sm:p-6">
        <h2 className="font-bold text-rose-400 flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4" /> Danger Zone
        </h2>
        {!confirmDelete ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">Delete account</p>
              <p className="text-xs text-text-muted mt-0.5">Permanently delete your account and all data. Cannot be undone.</p>
            </div>
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-rose-300 font-semibold">Are you absolutely sure? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-xl border border-border/55 text-xs text-text-muted hover:text-text-primary">
                Cancel
              </button>
              <button onClick={deleteAccount} disabled={deleting}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50">
                {deleting ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Yes, delete my account'}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <ScrollToTop />
    </div>
  )
}
