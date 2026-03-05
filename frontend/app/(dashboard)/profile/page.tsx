'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, Shield, BarChart3, Calendar, Edit3, Save, X, Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserStats } from '@/types'
import { formatDate } from '@/lib/utils/helpers'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (p) { setProfile(p); setDisplayName(p.display_name || '') }
      const { data: s } = await supabase.rpc('get_user_stats', { p_user_id: user.id })
      if (s) setStats(s)
      setLoading(false)
    }
    load()
  }, [])

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({ display_name: displayName, updated_at: new Date().toISOString() }).eq('id', profile.id)
    setProfile(prev => prev ? { ...prev, display_name: displayName } : prev)
    setEditing(false); setSaving(false)
  }

  if (loading) return <div className="p-8"><div className="card h-64 skeleton" /></div>

  const initials = (profile?.display_name || profile?.email || 'U').substring(0, 2).toUpperCase()
  const aiRate = stats ? Math.round((stats.ai_detected / Math.max(stats.total_scans, 1)) * 100) : 0

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          My Profile
        </h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-3xl font-black text-white animate-glow-pulse">
                {initials}
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-surface border-2 border-border flex items-center justify-center hover:border-primary transition-colors">
                <Camera className="w-4 h-4 text-text-muted" />
              </button>
            </div>

            {editing ? (
              <div className="space-y-3">
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                  className="input-field text-center" placeholder="Your name" />
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="btn-ghost flex-1 py-2 text-sm flex items-center justify-center gap-1">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button onClick={saveProfile} disabled={saving} className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-1">
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-text-primary">{profile?.display_name || 'Anonymous'}</h2>
                <p className="text-text-muted text-sm mt-1">{profile?.email}</p>
                <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-primary/10 border border-primary/30">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary capitalize">{profile?.plan} Plan</span>
                </div>
                <button onClick={() => setEditing(true)}
                  className="mt-4 btn-ghost w-full py-2 text-sm flex items-center justify-center gap-1.5">
                  <Edit3 className="w-4 h-4" /> Edit Profile
                </button>
              </>
            )}

            <div className="mt-4 pt-4 border-t border-border text-left space-y-2">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Calendar className="w-4 h-4" />
                <span>Joined {profile?.created_at ? formatDate(profile.created_at) : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Mail className="w-4 h-4" />
                <span className="truncate">{profile?.email}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Detection Statistics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Scans', value: stats?.total_scans ?? 0, color: 'text-primary' },
                { label: 'AI Detected', value: stats?.ai_detected ?? 0, color: 'text-rose' },
                { label: 'Human Content', value: stats?.human_detected ?? 0, color: 'text-emerald' },
                { label: 'Avg Confidence', value: `${stats?.avg_confidence ?? 0}%`, color: 'text-cyan' },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-xl bg-surface-active">
                  <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-text-muted mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card">
            <h3 className="font-semibold text-text-primary mb-4">Media Type Breakdown</h3>
            <div className="space-y-3">
              {[
                { label: 'Images', count: stats?.image_scans ?? 0, color: 'bg-primary' },
                { label: 'Videos', count: stats?.video_scans ?? 0, color: 'bg-secondary' },
                { label: 'Audio', count: stats?.audio_scans ?? 0, color: 'bg-cyan' },
                { label: 'Text', count: stats?.text_scans ?? 0, color: 'bg-amber' },
              ].map(m => {
                const pct = stats?.total_scans ? Math.round((m.count / stats.total_scans) * 100) : 0
                return (
                  <div key={m.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">{m.label}</span>
                      <span className="text-text-muted">{m.count} scans ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className={`h-full rounded-full ${m.color}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card">
            <h3 className="font-semibold text-text-primary mb-4">Plan Usage</h3>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-muted">Monthly scans used</span>
              <span className="text-text-primary font-medium">{profile?.monthly_scans ?? 0} / {profile?.plan === 'free' ? 50 : '∞'}</span>
            </div>
            {profile?.plan === 'free' && (
              <>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
                    style={{ width: `${Math.min(((profile?.monthly_scans ?? 0) / 50) * 100, 100)}%` }} />
                </div>
                <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-sm text-text-secondary">Upgrade to Pro for unlimited scans, all media types, and priority support.</p>
                  <button className="btn-primary text-sm py-2 px-4 mt-3">Upgrade to Pro →</button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
