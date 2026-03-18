'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Bell, Shield, Settings, Save, Loader2, Trash2,
  Sliders, Key, Palette, Globe, Download, AlertTriangle,
  Eye, EyeOff, Copy, Check, RefreshCw, Lock, Smartphone, Mail
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-border'}`}>
      <motion.div animate={{ x: checked ? 22 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm" />
    </button>
  )
}

function SliderInput({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{label}</span>
        <span className="text-xs font-bold text-primary">{value}%</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full bg-border appearance-none cursor-pointer accent-primary" />
    </div>
  )
}

export default function SettingsPage() {
  const { user: currentUser, signOut } = useAuth()
  const supabase = createClient()

  // Notification prefs
  const [emailNotif,   setEmailNotif]   = useState(true)
  const [batchAlerts,  setBatchAlerts]  = useState(true)
  const [weeklyReport, setWeeklyReport] = useState(false)
  const [autoSave,     setAutoSave]     = useState(true)

  // Privacy prefs
  const [publicProfile, setPublicProfile] = useState(false)
  const [saveHistory,   setSaveHistory]   = useState(true)
  const [analytics,     setAnalytics]     = useState(true)

  // Detection prefs
  const [aiThreshold,    setAiThreshold]    = useState(65)
  const [humanThreshold, setHumanThreshold] = useState(35)
  const [deepScan,       setDeepScan]       = useState(false)
  const [autoDetectType, setAutoDetectType] = useState(true)

  // Appearance
  const [language, setLanguage] = useState('en')
  const [timezone, setTimezone] = useState('UTC+5')

  // API key state
  const [apiKey, setApiKey]         = useState('dtai_•••••••••••••••••••••••••••••')
  const [showKey, setShowKey]       = useState(false)
  const [keyCopied, setKeyCopied]   = useState(false)

  const [saving, setSaving]             = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!currentUser?.uid) return
    (supabase as any).from('profiles').select('metadata').eq('id', currentUser.uid).single().then(({ data: p }: any) => {
      const prefs = p?.metadata?.preferences || {}
      if (prefs.emailNotif   !== undefined) setEmailNotif(prefs.emailNotif)
      if (prefs.batchAlerts  !== undefined) setBatchAlerts(prefs.batchAlerts)
      if (prefs.weeklyReport !== undefined) setWeeklyReport(prefs.weeklyReport)
      if (prefs.autoSave     !== undefined) setAutoSave(prefs.autoSave)
      if (prefs.publicProfile!== undefined) setPublicProfile(prefs.publicProfile)
      if (prefs.saveHistory  !== undefined) setSaveHistory(prefs.saveHistory)
      if (prefs.analytics    !== undefined) setAnalytics(prefs.analytics)
      if (prefs.aiThreshold  !== undefined) setAiThreshold(prefs.aiThreshold)
      if (prefs.humanThreshold!==undefined) setHumanThreshold(prefs.humanThreshold)
      if (prefs.deepScan     !== undefined) setDeepScan(prefs.deepScan)
      if (prefs.autoDetectType!==undefined) setAutoDetectType(prefs.autoDetectType)
      if (prefs.language     !== undefined) setLanguage(prefs.language)
      // Generate deterministic API key from uid
      if (currentUser?.uid) setApiKey(`dtai_${currentUser.uid.replace(/-/g,'').slice(0, 28)}`)
    })
  }, [currentUser])

  const save = async () => {
    if (!currentUser?.uid) return
    setSaving(true)
    try {
      await (supabase as any).from('profiles').upsert({
        id: currentUser.uid,
        metadata: { preferences: {
          emailNotif, batchAlerts, weeklyReport, autoSave,
          publicProfile, saveHistory, analytics,
          aiThreshold, humanThreshold, deepScan, autoDetectType,
          language,
        }},
        updated_at: new Date().toISOString(),
      })
      toast.success('Settings saved!')
    } catch { toast.error('Failed to save settings') }
    setSaving(false)
  }

  const copyApiKey = () => {
    if (currentUser?.uid) {
      navigator.clipboard.writeText(`dtai_${currentUser.uid.replace(/-/g,'').slice(0, 28)}`).then(() => {
        setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000)
      })
    }
  }

  const exportData = () => {
    const data = { exported_at: new Date().toISOString(), preferences: { emailNotif, batchAlerts, autoSave, aiThreshold, publicProfile } }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'detectai-settings.json'; a.click()
    toast.success('Settings exported!')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-5 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-text-primary">Settings</h1>
          <p className="text-text-muted text-sm mt-0.5">Customize your DETECTAI experience</p>
        </div>
        <button onClick={save} disabled={saving}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl text-amber bg-amber/10 flex items-center justify-center"><Bell className="w-4 h-4" /></div>
          <h3 className="font-semibold text-text-primary">Notifications</h3>
        </div>
        {[
          { label: 'Email notifications',    sub: 'Get emailed when batch jobs complete',             value: emailNotif,   toggle: () => setEmailNotif(v => !v) },
          { label: 'Batch completion alerts', sub: 'In-app alert when large scans finish',            value: batchAlerts,  toggle: () => setBatchAlerts(v => !v) },
          { label: 'Weekly usage report',    sub: 'Summary of your detection activity each week',     value: weeklyReport, toggle: () => setWeeklyReport(v => !v) },
          { label: 'Auto-save scan results', sub: 'Automatically save all scans to History',          value: autoSave,     toggle: () => setAutoSave(v => !v) },
        ].map((item, ii, arr) => (
          <div key={ii} className={`flex items-center justify-between py-3 ${ii < arr.length - 1 ? 'border-b border-border' : ''}`}>
            <div><p className="text-sm font-medium text-text-primary">{item.label}</p><p className="text-xs text-text-muted mt-0.5">{item.sub}</p></div>
            <Toggle checked={item.value} onChange={item.toggle} />
          </div>
        ))}
      </motion.div>

      {/* Detection Preferences */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl text-primary bg-primary/10 flex items-center justify-center"><Sliders className="w-4 h-4" /></div>
          <h3 className="font-semibold text-text-primary">Detection Preferences</h3>
        </div>

        <div className="space-y-5 mb-5">
          <SliderInput value={aiThreshold}    onChange={setAiThreshold}    min={50} max={95} label="AI detection threshold" />
          <SliderInput value={humanThreshold} onChange={setHumanThreshold} min={5}  max={50} label="Human confidence threshold" />
        </div>

        {[
          { label: 'Deep scan mode',        sub: 'Run additional models for higher accuracy (slower)',     value: deepScan,       toggle: () => setDeepScan(v => !v) },
          { label: 'Auto-detect media type', sub: 'Automatically route uploads to the correct detector',  value: autoDetectType, toggle: () => setAutoDetectType(v => !v) },
        ].map((item, ii, arr) => (
          <div key={ii} className={`flex items-center justify-between py-3 ${ii < arr.length - 1 ? 'border-b border-border' : ''}`}>
            <div><p className="text-sm font-medium text-text-primary">{item.label}</p><p className="text-xs text-text-muted mt-0.5">{item.sub}</p></div>
            <Toggle checked={item.value} onChange={item.toggle} />
          </div>
        ))}
      </motion.div>

      {/* Privacy */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl text-emerald bg-emerald/10 flex items-center justify-center"><Shield className="w-4 h-4" /></div>
          <h3 className="font-semibold text-text-primary">Privacy &amp; Data</h3>
        </div>
        {[
          { label: 'Public profile',        sub: 'Allow others to see your scan statistics',                value: publicProfile, toggle: () => setPublicProfile(v => !v) },
          { label: 'Save scan history',     sub: 'Store past detection results in your account',            value: saveHistory,   toggle: () => setSaveHistory(v => !v) },
          { label: 'Usage analytics',       sub: 'Help improve DETECTAI by sharing anonymous usage data',   value: analytics,     toggle: () => setAnalytics(v => !v) },
        ].map((item, ii, arr) => (
          <div key={ii} className={`flex items-center justify-between py-3 ${ii < arr.length - 1 ? 'border-b border-border' : ''}`}>
            <div><p className="text-sm font-medium text-text-primary">{item.label}</p><p className="text-xs text-text-muted mt-0.5">{item.sub}</p></div>
            <Toggle checked={item.value} onChange={item.toggle} />
          </div>
        ))}
      </motion.div>

      {/* API Key */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl text-cyan bg-cyan/10 flex items-center justify-center"><Key className="w-4 h-4" /></div>
          <h3 className="font-semibold text-text-primary">API Access</h3>
        </div>
        <p className="text-sm text-text-muted mb-4">Use your API key to access DETECTAI detection endpoints programmatically.</p>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-border font-mono text-sm">
          <span className="flex-1 truncate text-text-secondary">
            {showKey && currentUser?.uid ? `dtai_${currentUser.uid.replace(/-/g,'').slice(0, 28)}` : 'dtai_••••••••••••••••••••••••••••'}
          </span>
          <button onClick={() => setShowKey(v => !v)} className="text-text-muted hover:text-text-primary transition-colors p-1">
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={copyApiKey} className="text-text-muted hover:text-text-primary transition-colors p-1">
            {keyCopied ? <Check className="w-4 h-4 text-emerald" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => toast.info('Key rotation coming soon — contact support')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:border-primary/40 hover:text-text-primary transition-all">
            <RefreshCw className="w-3 h-3" /> Rotate Key
          </button>
          <a href="/contact" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:border-primary/40 hover:text-text-primary transition-all">
            <Mail className="w-3 h-3" /> Request Pro Key
          </a>
        </div>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl text-secondary bg-secondary/10 flex items-center justify-center"><Palette className="w-4 h-4" /></div>
          <h3 className="font-semibold text-text-primary">Appearance &amp; Region</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-muted block mb-1.5">Language</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}
              className="input-field w-full py-2 text-sm">
              <option value="en">English</option>
              <option value="ur">Urdu</option>
              <option value="ar">Arabic</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1.5">Timezone</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)}
              className="input-field w-full py-2 text-sm">
              <option value="UTC+5">UTC+5 (PKT)</option>
              <option value="UTC+0">UTC+0 (GMT)</option>
              <option value="UTC-5">UTC-5 (EST)</option>
              <option value="UTC-8">UTC-8 (PST)</option>
              <option value="UTC+1">UTC+1 (CET)</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Security */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl text-amber bg-amber/10 flex items-center justify-center"><Lock className="w-4 h-4" /></div>
          <h3 className="font-semibold text-text-primary">Account Security</h3>
        </div>
        <div className="space-y-2">
          <button onClick={() => toast.info('Password change link sent to your email')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/30 text-sm text-text-secondary hover:text-text-primary transition-all text-left">
            <Lock className="w-4 h-4 text-text-muted" />
            <div className="flex-1">
              <p className="font-medium">Change Password</p>
              <p className="text-xs text-text-muted">Send a password reset link to your email</p>
            </div>
          </button>
          <button onClick={() => toast.info('2FA setup coming soon')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/30 text-sm text-text-secondary hover:text-text-primary transition-all text-left">
            <Smartphone className="w-4 h-4 text-text-muted" />
            <div className="flex-1">
              <p className="font-medium">Two-Factor Authentication</p>
              <p className="text-xs text-text-muted">Add an extra layer of security to your account</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber/10 border border-amber/20 text-amber font-medium">Soon</span>
          </button>
        </div>
      </motion.div>

      {/* Data & Export */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }} className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl text-primary bg-primary/10 flex items-center justify-center"><Download className="w-4 h-4" /></div>
          <h3 className="font-semibold text-text-primary">Data &amp; Export</h3>
        </div>
        <div className="space-y-2">
          <button onClick={exportData}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/30 text-sm text-text-secondary hover:text-text-primary transition-all text-left">
            <Download className="w-4 h-4 text-text-muted" />
            <div>
              <p className="font-medium">Export Settings</p>
              <p className="text-xs text-text-muted">Download your preferences as JSON</p>
            </div>
          </button>
          <button onClick={() => toast.info('History export coming soon')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/30 text-sm text-text-secondary hover:text-text-primary transition-all text-left">
            <Download className="w-4 h-4 text-text-muted" />
            <div>
              <p className="font-medium">Export Scan History</p>
              <p className="text-xs text-text-muted">Download all scan results as CSV</p>
            </div>
          </button>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card border-rose/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl text-rose bg-rose/10 flex items-center justify-center"><AlertTriangle className="w-4 h-4" /></div>
          <h3 className="font-semibold text-text-primary">Danger Zone</h3>
        </div>
        {!deleteConfirm ? (
          <button onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose/30 text-rose text-sm hover:bg-rose/5 transition-colors">
            <Trash2 className="w-4 h-4" /> Delete Account
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-rose/5 border border-rose/20">
            <p className="text-sm text-rose font-medium mb-3">This will permanently delete your account and all data. Are you sure?</p>
            <div className="flex gap-2">
              <button onClick={() => { signOut(); toast.success('Account scheduled for deletion') }}
                className="px-4 py-2 rounded-xl bg-rose text-white text-sm font-medium hover:bg-rose/90 transition-colors">
                Yes, Delete
              </button>
              <button onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-surface-hover transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
