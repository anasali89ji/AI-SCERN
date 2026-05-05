'use client'
import { ScrollToTop } from '@/components/ScrollToTop'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Bell, Shield, Save, Loader2, Trash2, Sliders, Key, Palette,
  Globe, Download, AlertTriangle, Copy, Check, Lock, Smartphone,
  Moon, Sun, Monitor, FileText, Volume2, Zap, Eye, EyeOff,
  RefreshCw, Mail, ToggleLeft, Database, Languages, Clock,
  ChevronRight, Info, Star, BrainCircuit
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { useClerk } from '@clerk/nextjs'

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
  icon: any; label: string; description?: string; action: React.ReactNode; badge?: string
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
function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      className="bg-surface border border-border/55 rounded-2xl p-6">
      <h2 className="font-bold text-text-primary flex items-center gap-2 mb-1 pb-3 border-b border-border/30">
        <Icon className="w-4 h-4 text-primary" /> {title}
      </h2>
      {children}
    </motion.div>
  )
}

export default function SettingsPage() {
  const { user, signOut }  = useAuth()
  const { openUserProfile } = useClerk()
  const supabase            = createClient()

  // ── Notification settings ──────────────────────────────────────────────────
  const [emailNotif,       setEmailNotif]       = useState(true)
  const [batchAlerts,      setBatchAlerts]      = useState(true)
  const [weeklyReport,     setWeeklyReport]     = useState(false)
  const [autoSave,         setAutoSave]         = useState(true)
  const [upgradeAlerts,    setUpgradeAlerts]    = useState(true)

  // ── Detection settings ─────────────────────────────────────────────────────
  const [highAccMode,      setHighAccMode]      = useState(false)
  const [saveHistory,      setSaveHistory]      = useState(true)
  const [autoDownload,     setAutoDownload]     = useState(false)
  const [showConfidence,   setShowConfidence]   = useState(true)
  const [showSignals,      setShowSignals]      = useState(true)
  const [defaultModality,  setDefaultModality]  = useState('text')

  // ── Privacy settings ───────────────────────────────────────────────────────
  const [publicProfile,    setPublicProfile]    = useState(false)
  const [shareAnon,        setShareAnon]        = useState(true)
  const [cookieConsent,    setCookieConsent]    = useState(true)
  const [analyticsOptOut,  setAnalyticsOptOut]  = useState(false)
  const [dataRetention,    setDataRetention]    = useState('90')

  // ── Interface settings ─────────────────────────────────────────────────────
  const [theme,            setTheme]            = useState<'dark'|'light'|'system'>('dark')
  const [language,         setLanguage]         = useState('en')
  const [compactView,      setCompactView]      = useState(false)
  const [animationsOff,    setAnimationsOff]    = useState(false)

  // ── Security ───────────────────────────────────────────────────────────────
  const [copied,           setCopied]           = useState(false)
  const [showKey,          setShowKey]          = useState(false)

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const SETTINGS_KEY = `aiscern_settings_${user?.uid}`

  const loadSettings = useCallback(() => {
    if (!user?.uid) return
    try {
      const saved = localStorage.getItem(SETTINGS_KEY)
      if (saved) {
        const s = JSON.parse(saved)
        if (s.emailNotif       !== undefined) setEmailNotif(s.emailNotif)
        if (s.batchAlerts      !== undefined) setBatchAlerts(s.batchAlerts)
        if (s.weeklyReport     !== undefined) setWeeklyReport(s.weeklyReport)
        if (s.autoSave         !== undefined) setAutoSave(s.autoSave)
        if (s.upgradeAlerts    !== undefined) setUpgradeAlerts(s.upgradeAlerts)
        if (s.highAccMode      !== undefined) setHighAccMode(s.highAccMode)
        if (s.saveHistory      !== undefined) setSaveHistory(s.saveHistory)
        if (s.autoDownload     !== undefined) setAutoDownload(s.autoDownload)
        if (s.showConfidence   !== undefined) setShowConfidence(s.showConfidence)
        if (s.showSignals      !== undefined) setShowSignals(s.showSignals)
        if (s.defaultModality  !== undefined) setDefaultModality(s.defaultModality)
        if (s.publicProfile    !== undefined) setPublicProfile(s.publicProfile)
        if (s.shareAnon        !== undefined) setShareAnon(s.shareAnon)
        if (s.analyticsOptOut  !== undefined) setAnalyticsOptOut(s.analyticsOptOut)
        if (s.dataRetention    !== undefined) setDataRetention(s.dataRetention)
        if (s.theme            !== undefined) setTheme(s.theme)
        if (s.language         !== undefined) setLanguage(s.language)
        if (s.compactView      !== undefined) setCompactView(s.compactView)
        if (s.animationsOff    !== undefined) setAnimationsOff(s.animationsOff)
      }
    } catch {}
    setLoading(false)
  }, [user?.uid]) // eslint-disable-line

  useEffect(() => { loadSettings() }, [loadSettings])

  const handleSave = async () => {
    if (!user?.uid) return
    setSaving(true)
    const settings = {
      emailNotif, batchAlerts, weeklyReport, autoSave, upgradeAlerts,
      highAccMode, saveHistory, autoDownload, showConfidence, showSignals, defaultModality,
      publicProfile, shareAnon, analyticsOptOut, dataRetention,
      theme, language, compactView, animationsOff,
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    // Persist some to DB
    await (supabase as any).from('profiles').update({
      public_profile: publicProfile,
      analytics_opt_out: analyticsOptOut,
    }).eq('id', user.uid).catch(() => {})
    setSaving(false)
    toast.success('Settings saved')
  }

  const copyApiKey = () => {
    navigator.clipboard.writeText(`aiscern_${user?.uid?.slice(0,16)}...`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const deleteAccount = async () => {
    if (!confirmDelete || !user?.uid) return
    setDeleting(true)
    await fetch('/api/delete-account', { method:'POST' }).catch(() => {})
    await signOut()
  }

  const exportData = async () => {
    if (!user?.uid) return
    const { data: scans } = await (supabase as any).from('scans').select('*').eq('user_id', user.uid)
    const blob = new Blob([JSON.stringify({ scans, exported_at: new Date().toISOString() }, null, 2)], { type:'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aiscern-data.json'; a.click()
    toast.success('Data exported')
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-64">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-text-primary">Settings</h1>
          <p className="text-sm text-text-muted mt-0.5">Customize your Aiscern experience</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all hover:scale-[1.02]"
          style={{ background:'linear-gradient(135deg,#7c3aed,#2563eb)' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All
        </button>
      </div>

      {/* Notifications */}
      <Section title="Notifications" icon={Bell}>
        <SettingRow icon={Mail}       label="Email notifications" description="Scan summaries and account updates via email" action={<Toggle checked={emailNotif}     onChange={() => setEmailNotif(v => !v)} />} />
        <SettingRow icon={Bell}       label="Batch scan alerts"   description="Notify when bulk scan results are ready"         action={<Toggle checked={batchAlerts}    onChange={() => setBatchAlerts(v => !v)} />} />
        <SettingRow icon={Star}       label="Upgrade alerts"      description="Get notified of plan changes from admin"         action={<Toggle checked={upgradeAlerts}  onChange={() => setUpgradeAlerts(v => !v)} />} />
        <SettingRow icon={FileText}   label="Weekly report"       description="Weekly digest of your detection activity"       action={<Toggle checked={weeklyReport}   onChange={() => setWeeklyReport(v => !v)} />} />
        <SettingRow icon={RefreshCw}  label="Auto-save results"   description="Save every scan result to history automatically" action={<Toggle checked={autoSave}       onChange={() => setAutoSave(v => !v)} />} />
      </Section>

      {/* Detection */}
      <Section title="Detection Preferences" icon={BrainCircuit}>
        <SettingRow icon={Zap}    label="High-accuracy mode"   description="Use slower but more precise ensemble analysis" badge="PRO"  action={<Toggle checked={highAccMode}    onChange={() => setHighAccMode(v => !v)} />} />
        <SettingRow icon={Database} label="Save scan history"  description="Keep all scan results in your history tab"             action={<Toggle checked={saveHistory}    onChange={() => setSaveHistory(v => !v)} />} />
        <SettingRow icon={Download} label="Auto-download PDF"  description="Automatically download PDF report after each scan"     action={<Toggle checked={autoDownload}   onChange={() => setAutoDownload(v => !v)} />} />
        <SettingRow icon={Sliders}  label="Show confidence %"  description="Display confidence scores on all results"              action={<Toggle checked={showConfidence} onChange={() => setShowConfidence(v => !v)} />} />
        <SettingRow icon={Eye}      label="Show signal details" description="Show individual detection signals on results"          action={<Toggle checked={showSignals}    onChange={() => setShowSignals(v => !v)} />} />
        <SettingRow icon={ToggleLeft} label="Default modality" description="Pre-select this tab when opening the detector"
          action={
            <select value={defaultModality} onChange={e => setDefaultModality(e.target.value)}
              className="text-xs bg-surface-active border border-border/55 rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:border-primary">
              {['text','image','audio','video','url'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
            </select>
          } />
      </Section>

      {/* Interface */}
      <Section title="Interface" icon={Palette}>
        <SettingRow icon={Moon} label="Theme" description="Choose your preferred color scheme"
          action={
            <div className="flex gap-1">
              {(['dark','light','system'] as const).map(t => (
                <button key={t} onClick={() => setTheme(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${theme===t ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border/55 text-text-muted hover:text-text-secondary'}`}>
                  {t==='dark'?<Moon className="w-3 h-3 inline mr-1"/>:t==='light'?<Sun className="w-3 h-3 inline mr-1"/>:<Monitor className="w-3 h-3 inline mr-1"/>}
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
          } />
        <SettingRow icon={Languages} label="Language" description="Interface display language"
          action={
            <select value={language} onChange={e => setLanguage(e.target.value)}
              className="text-xs bg-surface-active border border-border/55 rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:border-primary">
              <option value="en">English</option>
              <option value="ur">اردو (Urdu)</option>
              <option value="ar">العربية (Arabic)</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          } />
        <SettingRow icon={Monitor}     label="Compact view"      description="Reduce padding for a denser layout"          action={<Toggle checked={compactView}    onChange={() => setCompactView(v => !v)} />} />
        <SettingRow icon={Zap}         label="Reduce animations" description="Disable motion effects for accessibility"    action={<Toggle checked={animationsOff}  onChange={() => setAnimationsOff(v => !v)} />} />
      </Section>

      {/* Privacy */}
      <Section title="Privacy" icon={Shield}>
        <SettingRow icon={Globe}       label="Public profile"      description="Allow others to see your username and stats"      action={<Toggle checked={publicProfile}   onChange={() => setPublicProfile(v => !v)} />} />
        <SettingRow icon={BrainCircuit} label="Contribute to model training" description="Share anonymized scan results to improve accuracy" action={<Toggle checked={shareAnon}      onChange={() => setShareAnon(v => !v)} />} />
        <SettingRow icon={Eye}         label="Opt out of analytics" description="Disable usage analytics collection"              action={<Toggle checked={analyticsOptOut} onChange={() => setAnalyticsOptOut(v => !v)} />} />
        <SettingRow icon={Clock}       label="Data retention" description="How long to keep scan history"
          action={
            <select value={dataRetention} onChange={e => setDataRetention(e.target.value)}
              className="text-xs bg-surface-active border border-border/55 rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:border-primary">
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="forever">Forever</option>
            </select>
          } />
      </Section>

      {/* Security */}
      <Section title="Security & API" icon={Lock}>
        <SettingRow icon={Smartphone} label="Manage 2FA & password"  description="Update security settings via Clerk"
          action={
            <button onClick={() => openUserProfile()} className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
              Manage <ChevronRight className="w-3 h-3" />
            </button>
          } />
        <SettingRow icon={Key} label="API key (beta)" description="For programmatic access — Team/Enterprise only"
          action={
            <div className="flex items-center gap-2">
              <code className="text-[10px] text-text-muted font-mono">
                {showKey ? `aiscern_${user?.uid?.slice(0,16)}...` : '••••••••••••••••'}
              </code>
              <button onClick={() => setShowKey(v => !v)} className="text-text-muted hover:text-text-primary transition-colors">
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button onClick={copyApiKey} className="text-text-muted hover:text-text-primary transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          } />
      </Section>

      {/* Data */}
      <Section title="Data & Storage" icon={Database}>
        <SettingRow icon={Download} label="Export your data" description="Download all your scans as a JSON file"
          action={
            <button onClick={exportData} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border/55 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors">
              <Download className="w-3 h-3" /> Export
            </button>
          } />
        <SettingRow icon={Trash2} label="Clear scan history" description="Delete all saved detection results permanently"
          action={
            <button onClick={async () => {
              if (!user?.uid) return
              await (supabase as any).from('scans').delete().eq('user_id', user.uid)
              toast.success('History cleared')
            }} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          } />
      </Section>

      {/* Danger zone */}
      <motion.div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-6">
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
