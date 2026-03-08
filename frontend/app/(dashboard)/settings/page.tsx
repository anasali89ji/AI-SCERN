'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, Shield, Settings, Save, AlertTriangle, Loader2, Trash2 } from 'lucide-react'
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

export default function SettingsPage() {
  const { user: fbUser, signOut } = useAuth()
  const [notifications,   setNotifications]   = useState(true)
  const [autoSave,        setAutoSave]         = useState(true)
  const [publicProfile,   setPublicProfile]    = useState(false)
  const [highConf,        setHighConf]         = useState(60)
  const [saving,          setSaving]           = useState(false)
  const [deleteConfirm,   setDeleteConfirm]    = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!fbUser?.uid) return
    supabase.from('profiles').select('metadata').eq('id', fbUser.uid).single().then(({ data: p }) => {
      const prefs = p?.metadata?.preferences || {}
      if (prefs.notifications !== undefined) setNotifications(prefs.notifications)
      if (prefs.autoSave      !== undefined) setAutoSave(prefs.autoSave)
      if (prefs.publicProfile !== undefined) setPublicProfile(prefs.publicProfile)
      if (prefs.highConf      !== undefined) setHighConf(prefs.highConf)
    })
  }, [fbUser])

  const save = async () => {
    if (!fbUser?.uid) return
    setSaving(true)
    try {
      await supabase.from('profiles').upsert({
        id: fbUser.uid,
        metadata: { preferences: { notifications, autoSave, publicProfile, highConf } },
        updated_at: new Date().toISOString(),
      })
      toast.success('Settings saved!')
    } catch { toast.error('Failed to save settings') }
    setSaving(false)
  }

  const sections = [
    { icon: Bell,   title: 'Notifications', color: 'text-amber bg-amber/10',
      items: [
        { label: 'Email notifications', sub: 'Get notified when batch jobs complete',              value: notifications, toggle: () => setNotifications(v => !v) },
        { label: 'Auto-save results',   sub: 'Automatically save all detection results to history', value: autoSave,       toggle: () => setAutoSave(v => !v) },
      ]
    },
    { icon: Shield, title: 'Privacy', color: 'text-emerald bg-emerald/10',
      items: [
        { label: 'Public profile', sub: 'Allow others to see your scan statistics', value: publicProfile, toggle: () => setPublicProfile(v => !v) },
      ]
    },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-text-primary">Settings</h1>
        <p className="text-text-muted text-sm mt-1">Customize your DETECTAI experience</p>
      </div>

      {sections.map((sec, si) => (
        <motion.div key={si} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.08 }} className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-9 h-9 rounded-xl ${sec.color} flex items-center justify-center`}>
              <sec.icon className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-text-primary">{sec.title}</h3>
          </div>
          {sec.items.map((item, ii) => (
            <div key={ii} className={`flex items-center justify-between py-3 ${ii < sec.items.length - 1 ? 'border-b border-border' : ''}`}>
              <div>
                <p className="text-sm font-medium text-text-primary">{item.label}</p>
                <p className="text-xs text-text-muted mt-0.5">{item.sub}</p>
              </div>
              <Toggle checked={item.value} onChange={item.toggle} />
            </div>
          ))}
        </motion.div>
      ))}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl text-primary bg-primary/10 flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-text-primary">Detection</h3>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-text-primary">AI Confidence Threshold</p>
              <p className="text-xs text-text-muted">Flag content as AI when confidence exceeds this</p>
            </div>
            <span className="text-lg font-bold text-primary">{highConf}%</span>
          </div>
          <input type="range" min="30" max="90" value={highConf} onChange={e => setHighConf(Number(e.target.value))}
            className="w-full accent-primary h-2 rounded-full cursor-pointer" />
          <div className="flex justify-between text-xs text-text-muted mt-1">
            <span>30% (lenient)</span><span>90% (strict)</span>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <button onClick={save} disabled={saving}
          className="w-full btn-primary py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card border-rose/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl text-rose bg-rose/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-rose">Danger Zone</h3>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium text-text-primary">Sign Out</p>
              <p className="text-xs text-text-muted">Sign out of this device</p>
            </div>
            <button onClick={signOut} className="text-sm text-rose border border-rose/30 px-3 py-1.5 rounded-xl hover:bg-rose/10 transition-colors">
              Sign Out
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">Delete Account</p>
              <p className="text-xs text-text-muted">Permanently delete your account and all data</p>
            </div>
            {!deleteConfirm ? (
              <button onClick={() => setDeleteConfirm(true)} className="text-sm text-rose border border-rose/30 px-3 py-1.5 rounded-xl hover:bg-rose/10 transition-colors flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />Delete
              </button>
            ) : (
              <div className="flex gap-2">
                <button className="text-xs bg-rose text-white px-3 py-1.5 rounded-xl hover:bg-rose/80">Confirm</button>
                <button onClick={() => setDeleteConfirm(false)} className="text-xs border border-border px-3 py-1.5 rounded-xl hover:bg-surface-active">Cancel</button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
