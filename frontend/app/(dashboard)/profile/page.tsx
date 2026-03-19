'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Mail, Shield, BarChart3, Calendar, Edit3, Save, X,
  Loader2, Check, FileText, Image as ImageIcon, Music, Video,
  Brain, User, Zap
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'

function Avatar({ user, size = 24 }: { user: any; size?: number }) {
  const initials = user?.displayName
    ? user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U'

  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={initials}
        style={{ width: size * 4, height: size * 4 }}
        className="rounded-full object-cover ring-4 ring-primary/30 shadow-xl shadow-primary/20"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <div
      style={{ width: size * 4, height: size * 4, fontSize: size * 1.2 }}
      className="rounded-full bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 flex items-center justify-center text-white font-black ring-4 ring-primary/30 shadow-xl shadow-primary/20 select-none"
    >
      {initials}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-black text-text-primary">{value ?? 0}</p>
        <p className="text-xs text-text-muted mt-0.5">{label}</p>
      </div>
    </motion.div>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [stats,       setStats]       = useState<any>(null)
  const [editing,     setEditing]     = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [saved,       setSaved]       = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!user?.uid) return
    setDisplayName(user.displayName || user.email?.split('@')[0] || '')
    async function load() {
      const { data: s, error } = await (supabase as any).rpc('get_user_stats', { p_user_id: user!.uid })
      if (s && !error) {
        const avg = (s.avg_confidence ?? 0) <= 1
          ? Math.round(s.avg_confidence * 100)
          : Math.round(s.avg_confidence)
        setStats({ ...s, avg_confidence: avg })
      } else {
        const { data: rows } = await (supabase as any)
          .from('scans').select('verdict,confidence_score,media_type').eq('user_id', user!.uid)
        if (rows) {
          const total = rows.length
          setStats({
            total_scans:    total,
            ai_detected:    rows.filter((r: any) => r.verdict === 'AI').length,
            human_detected: rows.filter((r: any) => r.verdict === 'HUMAN').length,
            uncertain:      rows.filter((r: any) => r.verdict === 'UNCERTAIN').length,
            avg_confidence: total > 0 ? Math.round(rows.reduce((a: number, r: any) => a + (r.confidence_score ?? 0), 0) / total * 100) : 0,
            text_scans:     rows.filter((r: any) => r.media_type === 'text').length,
            image_scans:    rows.filter((r: any) => r.media_type === 'image').length,
            audio_scans:    rows.filter((r: any) => r.media_type === 'audio').length,
            video_scans:    rows.filter((r: any) => r.media_type === 'video').length,
          })
        }
      }
      setLoading(false)
    }
    load()
  }, [user?.uid]) // eslint-disable-line

  const handleSave = async () => {
    if (!user?.uid || !displayName.trim()) return
    setSaving(true)
    await (supabase as any).from('profiles').upsert({ id: user.uid, display_name: displayName.trim() })
    setSaving(false)
    setSaved(true)
    setEditing(false)
    toast.success('Profile updated')
    setTimeout(() => setSaved(false), 2000)
  }

  const name      = displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const joinedAt  = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">

      {/* ── Profile card ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-surface border border-border rounded-3xl overflow-hidden">

        {/* Banner */}
        <div className="h-28 bg-gradient-to-r from-violet-600/30 via-indigo-600/20 to-purple-600/30 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.15),transparent)]" />
        </div>

        {/* Avatar + info */}
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 sm:-mt-14">
            {/* Avatar circle */}
            <div className="relative">
              <Avatar user={{ ...user, displayName: displayName || user?.displayName }} size={14} />
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald border-2 border-surface" />
            </div>

            {/* Edit / Save buttons */}
            <div className="flex gap-2 mt-2 sm:mt-0">
              {editing ? (
                <>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-60">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                  <button onClick={() => { setEditing(false); setDisplayName(user?.displayName || '') }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm text-text-muted hover:bg-surface-hover transition-all">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-hover hover:border-primary/40 transition-all">
                  {saved ? <Check className="w-4 h-4 text-emerald" /> : <Edit3 className="w-4 h-4" />}
                  {saved ? 'Saved!' : 'Edit Profile'}
                </button>
              )}
            </div>
          </div>

          {/* Name + email */}
          <div className="mt-4 space-y-1">
            {editing ? (
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="text-2xl font-black bg-surface-active border border-primary/40 rounded-xl px-3 py-1 text-text-primary focus:outline-none focus:border-primary w-full max-w-xs"
                autoFocus
              />
            ) : (
              <h1 className="text-2xl font-black text-text-primary">{name}</h1>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted mt-1">
              <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" />{user?.email}</span>
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />Joined {joinedAt}</span>
              <span className="flex items-center gap-1.5 text-emerald">
                <Shield className="w-4 h-4" />Verified account
              </span>
            </div>

            {/* Plan badge */}
            <div className="flex items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                <Zap className="w-3.5 h-3.5" /> Free Plan — Unlimited Scans
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Stats grid ── */}
      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-3 px-1">Detection Stats</h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-2xl p-5 h-20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Brain}     label="Total Scans"    value={stats?.total_scans    ?? 0} color="bg-primary/10 text-primary" />
            <StatCard icon={Shield}    label="AI Detected"    value={stats?.ai_detected    ?? 0} color="bg-rose/10 text-rose" />
            <StatCard icon={User}      label="Human Detected" value={stats?.human_detected ?? 0} color="bg-emerald/10 text-emerald" />
            <StatCard icon={BarChart3} label="Avg Confidence" value={stats?.avg_confidence ?? 0} color="bg-amber/10 text-amber" />
          </div>
        )}
      </div>

      {/* ── By modality ── */}
      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-3 px-1">By Modality</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={FileText}  label="Text Scans"  value={stats?.text_scans  ?? 0} color="bg-amber/10 text-amber" />
          <StatCard icon={ImageIcon} label="Image Scans" value={stats?.image_scans ?? 0} color="bg-violet/10 text-violet-400" />
          <StatCard icon={Music}     label="Audio Scans" value={stats?.audio_scans ?? 0} color="bg-cyan/10 text-cyan" />
          <StatCard icon={Video}     label="Video Scans" value={stats?.video_scans ?? 0} color="bg-secondary/10 text-secondary" />
        </div>
      </div>

      {/* ── Account details ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="bg-surface border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-bold text-text-primary flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Account Details
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-2.5 border-b border-border/50">
            <span className="text-text-muted">Email address</span>
            <span className="font-medium text-text-primary">{user?.email}</span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-b border-border/50">
            <span className="text-text-muted">Display name</span>
            <span className="font-medium text-text-primary">{name}</span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-b border-border/50">
            <span className="text-text-muted">Account status</span>
            <span className="text-emerald font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald" /> Active
            </span>
          </div>
          <div className="flex justify-between items-center py-2.5">
            <span className="text-text-muted">Plan</span>
            <span className="font-semibold text-primary">Free Forever</span>
          </div>
        </div>
      </motion.div>

    </div>
  )
}
