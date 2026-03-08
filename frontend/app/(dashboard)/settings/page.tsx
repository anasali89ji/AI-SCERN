'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Bell, Shield, Palette, Key, Save, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const { user: firebaseUser, signOut } = useAuth()
  const [notifications, setNotifications] = useState(true)
  const [autoSave, setAutoSave] = useState(true)
  const [highConf, setHighConf] = useState(60)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const save = async () => {
    setSaving(true)
    await new Promise(r => setTimeout(r, 800))
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-border'}`}>
      <motion.div animate={{ x: checked ? 24 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm" />
    </button>
  )

  const sections = [
    {
      icon: Bell, title: 'Notifications', color: 'text-amber bg-amber/10',
      settings: [
        { label: 'Email notifications', sub: 'Get notified when batch jobs complete', value: notifications, toggle: () => setNotifications(!notifications) },
        { label: 'Auto-save results', sub: 'Automatically save all detection results', value: autoSave, toggle: () => setAutoSave(!autoSave) },
      ]
    },
    {
      icon: Shield, title: 'Detection Settings', color: 'text-primary bg-primary/10',
      settings: []
    },
    {
      icon: Palette, title: 'Appearance', color: 'text-secondary bg-secondary/10',
      settings: []
    },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          Settings
        </h1>
      </div>

      <div className="space-y-4">
        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-amber/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber" />
            </div>
            <h2 className="font-semibold text-text-primary">Notifications</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Email notifications', sub: 'Get notified when batch jobs complete', value: notifications, toggle: () => setNotifications(!notifications) },
              { label: 'Auto-save results', sub: 'Automatically save all detection results', value: autoSave, toggle: () => setAutoSave(!autoSave) },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-text-primary">{s.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{s.sub}</p>
                </div>
                <Toggle checked={s.value} onChange={s.toggle} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Detection threshold */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-semibold text-text-primary">Detection Threshold</h2>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-secondary">AI confidence threshold</span>
              <span className="text-primary font-bold">{highConf}%</span>
            </div>
            <input type="range" min={30} max={90} value={highConf} onChange={e => setHighConf(+e.target.value)}
              className="w-full accent-primary" />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              <span>Sensitive (30%)</span>
              <span>Strict (90%)</span>
            </div>
            <p className="text-xs text-text-muted mt-3">Verdicts above this threshold are classified as &quot;AI&quot;. Lower = more sensitive.</p>
          </div>
        </motion.div>

        {/* API Keys */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-cyan/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-cyan" />
            </div>
            <h2 className="font-semibold text-text-primary">API Keys</h2>
          </div>
          <p className="text-sm text-text-muted mb-3">Your API keys are managed server-side. Contact support to generate a personal API key.</p>
          <div className="p-3 rounded-xl bg-surface-active border border-border font-mono text-sm text-text-muted">
            detectai_sk_••••••••••••••••••••
          </div>
        </motion.div>

        {/* Save button */}
        <button onClick={save} disabled={saving}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> :
           saved ? <><Save className="w-4 h-4" /> Saved!</> :
           <><Save className="w-4 h-4" /> Save Settings</>}
        </button>

        {/* Danger Zone */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="card border-rose/30 bg-rose/5">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-rose" />
            <h2 className="font-semibold text-rose">Danger Zone</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Sign out</p>
                <p className="text-xs text-text-muted">Sign out of your account</p>
              </div>
              <button onClick={handleSignOut} className="btn-ghost text-sm py-2 px-4 border-rose/30 text-rose hover:bg-rose/10">Sign Out</button>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-rose/20">
              <div>
                <p className="text-sm font-medium text-text-primary">Delete Account</p>
                <p className="text-xs text-text-muted">Permanently delete all your data</p>
              </div>
              <button onClick={() => setDeleteConfirm(true)} className="btn-ghost text-sm py-2 px-4 border-rose/50 text-rose hover:bg-rose/20">Delete</button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
