'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Mail, Shield, BarChart3, Calendar, Edit3, Save, X, Camera, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'

export default function ProfilePage() {
  const { user: currentUser } = useAuth()
  const { user: clerkUser } = useUser()
  const [profile,     setProfile]      = useState<any>(null)
  const [stats,       setStats]        = useState<any>(null)
  const [editing,     setEditing]      = useState(false)
  const [displayName, setDisplayName]  = useState('')
  const [avatarUrl,   setAvatarUrl]    = useState('')
  const [saving,      setSaving]       = useState(false)
  const [uploading,   setUploading]    = useState(false)
  const [loading,     setLoading]      = useState(true)
  const fileRef   = useRef<HTMLInputElement>(null)
  const supabase  = createClient()

  useEffect(() => {
    if (!currentUser?.uid) return
    async function load() {
      const { data: p } = await (supabase as any).from('profiles').select('*').eq('id', currentUser!.uid).single()
      if (p) { setProfile(p); setDisplayName(p.display_name || ''); setAvatarUrl(p.avatar_url || '') }
      if (!p?.display_name && currentUser?.displayName) setDisplayName(currentUser.displayName)
      if (!p?.avatar_url  && currentUser?.photoURL)    setAvatarUrl(currentUser.photoURL)
      const { data: s, error: rpcErr } = await (supabase as any).rpc('get_user_stats', { p_user_id: currentUser!.uid })
      if (s && !rpcErr) {
        const avgConf = (s.avg_confidence ?? 0) <= 1 ? Math.round(s.avg_confidence * 100) : Math.round(s.avg_confidence)
        setStats({ ...s, avg_confidence: avgConf })
      } else {
        // Fallback: compute stats directly from scans table
        const { data: scanRows } = await (supabase as any).from('scans').select('verdict,confidence_score,media_type').eq('user_id', currentUser!.uid)
        if (scanRows) {
          const total = scanRows.length
          setStats({
            total_scans:    total,
            ai_detected:    scanRows.filter((r: any) => r.verdict === 'AI').length,
            human_detected: scanRows.filter((r: any) => r.verdict === 'HUMAN').length,
            avg_confidence: total > 0 ? Math.round(scanRows.reduce((acc: number, r: any) => acc + (r.confidence_score ?? 0), 0) / total * 100) : 0,
            image_scans:    scanRows.filter((r: any) => r.media_type === 'image').length,
            video_scans:    scanRows.filter((r: any) => r.media_type === 'video').length,
            audio_scans:    scanRows.filter((r: any) => r.media_type === 'audio').length,
            text_scans:     scanRows.filter((r: any) => r.media_type === 'text').length,
            uncertain:      scanRows.filter((r: any) => r.verdict === 'UNCERTAIN').length,
          })
        }
      }
      setLoading(false)
    }
    load()
  }, [currentUser])

  const handleAvatarUpload = async (file: File) => {
    if (!currentUser?.uid) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `avatars/${currentUser.uid}.${ext}`
      const { error: uploadErr } = await (supabase as any).storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (uploadErr) throw uploadErr
      const { data: urlData } = (supabase as any).storage.from('avatars').getPublicUrl(path)
      const url = urlData.publicUrl
      await (supabase as any).from('profiles').upsert({ id: currentUser.uid, avatar_url: url })
      if (null) await clerkUser?.update({ firstName: displayName.trim().split(' ')[0], lastName: displayName.trim().split(' ').slice(1).join(' ') || undefined })
      setAvatarUrl(url)
      setProfile((p: any) => ({ ...p, avatar_url: url }))
      toast.success('Profile photo updated!')
    } catch {
      const objectUrl = URL.createObjectURL(file)
      setAvatarUrl(objectUrl)
      toast.error('Storage unavailable — showing locally only. Create an "avatars" bucket in Supabase Storage.')
    }
    setUploading(false)
  }

  const saveProfile = async () => {
    if (!currentUser?.uid) return
    setSaving(true)
    try {
      if (null) await clerkUser?.update({ firstName: displayName.trim().split(' ')[0], lastName: displayName.trim().split(' ').slice(1).join(' ') || undefined })
      await (supabase as any).from('profiles').upsert({ id: currentUser.uid, display_name: displayName, avatar_url: avatarUrl || null, updated_at: new Date().toISOString() })
      setProfile((p: any) => ({ ...p, display_name: displayName, avatar_url: avatarUrl }))
      setEditing(false)
      toast.success('Profile saved!')
    } catch { toast.error('Failed to save profile') }
    setSaving(false)
  }

  if (loading) return (
    <div className="p-6 lg:p-8 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="card h-32 animate-pulse bg-surface-active" />)}
    </div>
  )

  const avatar   = avatarUrl || currentUser?.photoURL || ''
  const initials = (displayName || currentUser?.email || 'U').slice(0, 2).toUpperCase()
  const aiRate   = stats ? Math.round((stats.ai_detected / Math.max(stats.total_scans, 1)) * 100) : 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-text-primary">Profile</h1>
        <p className="text-text-muted text-sm mt-1">Manage your account details</p>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              {avatar
                ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : <span className="text-2xl font-black text-white">{initials}</span>}
            </div>
            {uploading && (
              <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center hover:bg-primary/80 transition-colors"
              title="Change photo">
              <Camera className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Display Name</label>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                    className="input-field w-full max-w-xs py-2" placeholder="Your name" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveProfile} disabled={saving}
                    className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save
                  </button>
                  <button onClick={() => setEditing(false)} className="btn-ghost px-4 py-2 text-sm"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-text-primary">{displayName || 'Set your name'}</h2>
                  <button onClick={() => setEditing(true)} className="text-text-muted hover:text-primary transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-text-muted text-sm mt-1 truncate">{currentUser?.email}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                    Free · Open Source
                  </span>
                  <span className="text-xs text-text-muted flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Scans',   value: stats?.total_scans    ?? 0,  color: 'text-primary'   },
          { label: 'AI Detected',   value: stats?.ai_detected    ?? 0,  color: 'text-rose'      },
          { label: 'Human Content', value: stats?.human_detected ?? 0,  color: 'text-emerald'   },
          { label: 'AI Rate',       value: `${aiRate}%`,                color: 'text-amber'     },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="card text-center">
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-text-muted mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold text-text-primary text-sm">Account Details</h3>
        <div className="space-y-1">
          {[
            { icon: Mail,     label: 'Email',         value: currentUser?.email || '—',                     extra: true ? <Check className="w-4 h-4 text-emerald ml-auto" /> : null },
            { icon: Shield,   label: 'Auth Provider', value: ('password' || 'password').replace('.com','').replace('password','Email/Password') },
            { icon: BarChart3, label: 'Plan',         value: 'Free Forever' },
          ].map((row, i) => (
            <div key={i} className={`flex items-center gap-3 py-3 ${i < 2 ? 'border-b border-border' : ''}`}>
              <row.icon className="w-4 h-4 text-text-muted flex-shrink-0" />
              <div>
                <p className="text-xs text-text-muted">{row.label}</p>
                <p className="text-sm text-text-primary font-medium capitalize">{row.value}</p>
              </div>
              {row.extra}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
