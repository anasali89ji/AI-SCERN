'use client'
import { ScrollToTop } from '@/components/ScrollToTop'
import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { motion } from 'framer-motion'
import {
  Mail, Shield, BarChart3, Calendar, Edit3, Save, X,
  Loader2, Check, FileText, Image as ImageIcon, Music, Video,
  Brain, Zap, Camera, Crown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { NumberCounter } from '@/components/motion/NumberCounter'

// ── Avatar Component ───────────────────────────────────────────────────────────
function UserAvatar({ name, src, size = 96 }: { name: string; src?: string | null; size?: number }) {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'
  if (src) {
    return (
      <img
        src={src} alt={initials}
        style={{ width: size, height: size }}
        className="rounded-full object-cover ring-4 ring-primary/30 shadow-lg"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <div
      style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', width: size, height: size, fontSize: size * 0.32 }}
      className="rounded-full flex items-center justify-center font-black text-white ring-4 ring-primary/30 shadow-lg select-none"
    >
      {initials}
    </div>
  )
}

export default function ProfilePage() {
  const { user }     = useAuth()
  const { user: clerkUser, isLoaded } = useUser()
  const supabase = createClient()

  const [stats,     setStats]     = useState<any>(null)
  const [credits,   setCredits]   = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [editing,   setEditing]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [displayName, setDisplayName] = useState('')

  const name     = user?.displayName || user?.email?.split('@')[0] || 'User'
  const email    = user?.email || clerkUser?.emailAddresses?.[0]?.emailAddress || ''
  const photoURL = user?.photoURL || clerkUser?.imageUrl

  // Load stats + credits
  const load = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const [statsRes, credRes] = await Promise.all([
        fetch('/api/user/stats',   { cache: 'no-store' }),
        fetch('/api/user/credits', { cache: 'no-store' }),
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (credRes.ok)  setCredits(await credRes.json())
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }, [user?.uid])

  useEffect(() => {
    load()
    setDisplayName(user?.displayName || '')
  }, [load, user?.displayName])

  const handleSaveName = async () => {
    if (!user?.uid || !displayName.trim()) return
    setSaving(true)
    try {
      await clerkUser?.update({ firstName: displayName.split(' ')[0], lastName: displayName.split(' ').slice(1).join(' ') || undefined })
      toast.success('Name updated')
      setEditing(false)
    } catch {
      toast.error('Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  const totalScans    = stats?.total_scans     ?? 0
  const aiDetected    = stats?.ai_count        ?? 0
  const humanDetected = stats?.human_count     ?? 0
  const avgConf       = stats?.avg_confidence  ?? 0
  const avgPct        = avgConf <= 1 ? Math.round(avgConf * 100) : Math.round(avgConf)

  const dailyCredits  = credits?.daily_limit   ?? 50
  const dailyUsed     = credits?.daily_used    ?? 0
  const dailyLeft     = Math.max(0, dailyCredits - dailyUsed)
  const memberSince   = clerkUser?.createdAt
    ? new Date(clerkUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently'

  return (
    <>
      <ScrollToTop />
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6 pb-20 lg:pb-8">

        {/* Header */}
        <FadeIn>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
            Profile
          </h1>
          <p className="text-text-muted mt-1 text-sm">Your account and detection statistics</p>
        </FadeIn>

        {/* Profile card */}
        <FadeIn delay={0.05}>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <UserAvatar name={name} src={photoURL} size={80} />
                  <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>

                {/* Name / Email */}
                <div className="flex-1 min-w-0">
                  {editing ? (
                    <div className="flex items-center gap-2 mb-2">
                      <Input
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className="h-9 text-base font-semibold max-w-xs"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveName()
                          if (e.key === 'Escape') setEditing(false)
                        }}
                      />
                      <Button
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={handleSaveName}
                        disabled={saving}
                      >
                        {saving
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Check className="w-4 h-4" />
                        }
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0"
                        onClick={() => setEditing(false)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold text-text-primary truncate">{name}</h2>
                      <button
                        onClick={() => setEditing(true)}
                        className="text-text-disabled hover:text-text-muted transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-sm text-text-muted">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{email}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="secondary" className="gap-1.5 text-xs">
                      <Crown className="w-3 h-3 text-amber" />
                      Free Plan
                    </Badge>
                    <Badge variant="outline" className="text-xs gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Member since {memberSince}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Stats grid */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))
            ) : (
              <>
                {[
                  { icon: BarChart3, label: 'Total Scans',    value: totalScans,    color: 'text-blue-400 bg-blue-400/10' },
                  { icon: Brain,     label: 'AI Detected',    value: aiDetected,    color: 'text-rose-400 bg-rose/10' },
                  { icon: Shield,    label: 'Human Verified', value: humanDetected, color: 'text-emerald-400 bg-emerald/10' },
                  { icon: Zap,       label: 'Avg Accuracy',   value: avgPct, suffix: '%', color: 'text-amber bg-amber/10' },
                ].map(stat => (
                  <Card key={stat.label} className="p-0">
                    <CardContent className="p-4 flex flex-col gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color}`}>
                        <stat.icon className="w-4 h-4" />
                      </div>
                      <div className="text-2xl font-black text-text-primary tabular-nums">
                        <NumberCounter value={stat.value} suffix={(stat as any).suffix} />
                      </div>
                      <p className="text-xs text-text-muted">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </FadeIn>

        {/* Credits */}
        <FadeIn delay={0.15}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Credits</CardTitle>
              <CardDescription>
                {dailyLeft} of {dailyCredits} remaining today
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-text-muted">Used today</span>
                      <span className="font-semibold text-text-primary tabular-nums">
                        {dailyUsed} / {dailyCredits}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-surface-active overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (dailyUsed / dailyCredits) * 100)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-500"
                      />
                    </div>
                  </div>

                  <Separator className="opacity-50" />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {([
                      { icon: FileText,  label: 'Text',  count: credits?.text_used  ?? 0 },
                      { icon: ImageIcon, label: 'Image', count: credits?.image_used ?? 0 },
                      { icon: Music,     label: 'Audio', count: credits?.audio_used ?? 0 },
                      { icon: Video,     label: 'Video', count: credits?.video_used ?? 0 },
                    ]).map(item => (
                      <div key={item.label} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-surface-active text-center">
                        <item.icon className="w-4 h-4 text-text-muted" />
                        <div className="text-lg font-bold text-text-primary tabular-nums">{item.count}</div>
                        <div className="text-xs text-text-muted">{item.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-text-disabled">
                      Credits reset daily at midnight UTC
                    </p>
                    <Button variant="outline" size="sm" className="gap-2 text-xs">
                      <Crown className="w-3.5 h-3.5 text-amber" />
                      Upgrade Plan
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </FadeIn>

      </div>
    </>
  )
}
