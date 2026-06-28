'use client'
import { ScrollToTop } from '@/components/ScrollToTop'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  Mail, Shield, BarChart3, Calendar, Edit3, Save, X,
  Loader2, Check, FileText, Image as ImageIcon, Music, Video,
  Brain, User, Zap, Camera, Crown, ChevronRight, RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ name, size = 96 }: { name: string; size?: number }) {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'
  return (
    <div
      style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', width: size, height: size, fontSize: size * 0.32 }}
      className="rounded-full flex items-center justify-center font-black text-white ring-1 ring-[#2BEE34]/30">
      {initials}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number | string; color: string
}) {
  return (
    <div className="bg-surface border border-[#1E1E1E] rounded-xl p-5 flex flex-col gap-2">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      <p className="text-xs text-[#6B6B6B]">{label}</p>
    </div>
  )
}

// ── Credits Progress Bar ───────────────────────────────────────
function UsageBar({
  label, used, total, unlimited = false, color = '#2563eb', sublabel
}: {
  label: string; used: number; total: number
  unlimited?: boolean; color?: string; sublabel?: string
}) {
  const pct  = unlimited ? 0 : total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const left = unlimited ? '∞' : Math.max(0, total - used).toLocaleString()
  const warn = !unlimited && pct >= 80

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          {sublabel && <p className="text-[11px] text-[#6B6B6B]">{sublabel}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-sm font-bold tabular-nums ${warn ? 'text-amber-400-400' : 'text-white'}`}>
            {unlimited ? 'Unlimited' : `${left} left`}
          </p>
          {!unlimited && (
            <p className="text-[10px] text-[#6B6B6B]">{used.toLocaleString()} / {total.toLocaleString()} used</p>
          )}
        </div>
      </div>
      {!unlimited && (
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: warn
                ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
                : `linear-gradient(90deg,${color},${color}cc)`,
            }}
          />
        </div>
      )}
      {warn && !unlimited && (
        <p className="text-[11px] text-amber-400-400">
          {pct >= 100 ? '⚠ Limit reached' : `⚠ ${100 - pct}% remaining`}
          {' '}— <a href="/pricing" className="underline hover:text-amber-400-300">Upgrade your plan</a>
        </p>
      )}
    </div>
  )
}

// ── Credits Card ──────────────────────────────────────────────
interface CreditsData {
  plan: string; plan_label: string; is_paid: boolean
  credits_balance: number; credits_total: number; credits_used: number; credits_pct: number
  scans_today: number; daily_limit: number; daily_pct: number
  scans_month: number; scans_total: number
  plan_updated_at: string | null
}

function CreditsCard({ userId }: { userId: string }) {
  const [data, setData]       = useState<CreditsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/user/credits')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [refresh, userId])

  const planColors: Record<string, string> = {
    free: '#64748b', starter: '#2563eb', pro: '#7c3aed', enterprise: '#f59e0b',
  }
  const planColor = planColors[data?.plan ?? 'free'] ?? '#2563eb'

  return (
    <div className="bg-surface border border-[#1E1E1E] rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#2BEE34]" /> Credits &amp; Usage
        </h2>
        <button
          onClick={() => setRefresh(r => r + 1)}
          aria-label="Refresh credits"
          className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-white hover:bg-[#141414] transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : !data ? (
        <p className="text-sm text-[#6B6B6B] text-center py-4">Failed to load credits</p>
      ) : (
        <div className="space-y-5">
          {/* Plan badge */}
          <div className="flex items-center justify-between p-3 rounded-xl border"
            style={{ background: planColor + '10', borderColor: planColor + '30' }}>
            <div className="flex items-center gap-2">
              {data.is_paid
                ? <Crown className="w-4 h-4" style={{ color: planColor }} />
                : <Zap   className="w-4 h-4" style={{ color: planColor }} />
              }
              <span className="text-sm font-bold" style={{ color: planColor }}>
                {data.plan_label} Plan
              </span>
            </div>
            {!data.is_paid && (
              <a href="/pricing"
                className="text-xs font-semibold text-white px-3 py-1 rounded-lg transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)' }}>
                Upgrade
              </a>
            )}
          </div>

          {/* Credits balance */}
          {data.credits_total > 0 && (
            <UsageBar
              label="Scan Credits"
              sublabel="Resets with your plan · used for audio & video"
              used={data.credits_used}
              total={data.credits_total}
              unlimited={false}
              color={planColor}
            />
          )}

          {/* Daily scans */}
          <UsageBar
            label="Daily Scans"
            sublabel={`Resets at midnight · ${data.daily_limit === -1 ? 'Unlimited' : data.daily_limit + '/day'}`}
            used={data.scans_today}
            total={data.daily_limit}
            unlimited={data.daily_limit === -1}
            color="#06b6d4"
          />

          {/* Monthly / total stats row */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xl font-black text-white tabular-nums">{data.scans_month.toLocaleString()}</p>
              <p className="text-[11px] text-[#6B6B6B] mt-0.5">Scans this month</p>
            </div>
            <div className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xl font-black text-white tabular-nums">{data.scans_total.toLocaleString()}</p>
              <p className="text-[11px] text-[#6B6B6B] mt-0.5">Total scans ever</p>
            </div>
          </div>

          {/* Balance chip */}
          {data.credits_total > 0 && (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)' }}>
              <span className="text-xs text-[#6B6B6B]">Current balance</span>
              <span className="text-sm font-black text-[#2BEE34] tabular-nums">
                {data.credits_balance.toLocaleString()} credits
              </span>
            </div>
          )}

          {data.plan_updated_at && (
            <p className="text-[10px] text-[#6B6B6B] text-right">
              Plan updated {new Date(data.plan_updated_at).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Profile Page ─────────────────────────────────────────
export default function ProfilePage() {
  const { user }            = useAuth()
  const { user: clerkUser } = useUser()
  const supabase            = createClient()

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [stats,   setStats]   = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [username,    setUsername]    = useState('')
  const [bio,         setBio]         = useState('')

  const [uStatus,      setUStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle')
  const [suggestions,  setSugg]    = useState<string[]>([])
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const loadProfile = useCallback(async () => {
    if (!user?.uid) return
    const { data } = await (supabase as ReturnType<typeof createClient>)
      .from('profiles').select('*').eq('id', user.uid).single() as { data: Record<string, unknown> | null }
    if (data) {
      setProfile(data)
      setDisplayName((data.display_name as string) || user.displayName || '')
      setUsername((data.username as string) || '')
      setBio((data.bio as string) || '')
    }
    try {
      const r = await fetch('/api/user/stats')
      if (r.ok) {
        const s = await r.json() as Record<string, number>
        setStats({
          ...s,
          avg_confidence: s.avg_confidence <= 1
            ? Math.round(s.avg_confidence * 100)
            : Math.round(s.avg_confidence),
        })
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [user?.uid]) // eslint-disable-line

  useEffect(() => { loadProfile() }, [loadProfile])

  const checkUsername = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(clean)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!clean || clean.length < 3) { setUStatus('idle'); return }
    setUStatus('checking')
    debounceRef.current = setTimeout(async () => {
      const res  = await fetch(`/api/profiles/username?username=${encodeURIComponent(clean)}`)
      const data = await res.json() as { available: boolean; suggestions?: string[] }
      setUStatus(data.available ? 'available' : 'taken')
      setSugg(data.suggestions ?? [])
    }, 400)
  }

  const handleSave = async () => {
    if (!user?.uid) return
    if (username && uStatus === 'taken') { toast.error('That username is taken'); return }
    setSaving(true)
    const res = await fetch('/api/profiles/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName.trim(),
        username:     username || null,
        bio:          bio      || null,
      }),
    })
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      toast.error(d.error || 'Failed to save')
    } else {
      toast.success('Profile saved!')
      setEditing(false)
      loadProfile()
    }
    setSaving(false)
  }

  const plan      = (profile?.plan as string) ?? 'free'
  const planLabel = ({ free:'Free', starter:'Starter', pro:'Pro', enterprise:'Enterprise' } as Record<string, string>)[plan] ?? 'Free'
  const isPaid    = ['starter','pro','enterprise'].includes(plan)
  const joinedAt  = clerkUser?.createdAt
    ? new Date(clerkUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="p-4 sm:p-6 lg:p-8 2xl:p-10 max-w-4xl 2xl:max-w-5xl 3xl:max-w-6xl mx-auto space-y-6">

      {/* ── Profile Card ──────────────────────────────────────── */}
      <div className="bg-surface border border-[#1E1E1E] rounded-xl overflow-hidden">
        {/* Banner */}
        <div className="h-28 sm:h-32 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(6,182,212,0.15))' }}>
          <div className="absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(37,99,235,0.2) 0%, transparent 60%)' }} />
          <div className="absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="px-4 sm:px-6 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 -mt-10 sm:-mt-14">
            <div className="relative group">
              <Avatar name={displayName || user?.displayName || user?.email || 'U'} size={88} />
              {editing && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500-400 border-2 border-surface" />
            </div>

            <div className="flex gap-2 sm:mb-2">
              {editing ? (
                <>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:bg-[#1A8F1F] transition-colors disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)' }}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#1E1E1E] text-sm text-[#6B6B6B] hover:bg-[#141414] transition-all">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#1E1E1E] text-sm font-semibold text-[#A3A3A3] hover:bg-[#141414] hover:border-[#2BEE34]/50/40 transition-all">
                  <Edit3 className="w-4 h-4" /> Edit Profile
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {editing ? (
              <div className="space-y-3 max-w-sm">
                <div className="space-y-1">
                  <label className="text-[11px] text-[#6B6B6B] uppercase tracking-widest mb-1 block">Display Name</label>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                    className="w-full bg-[#141414] border border-[#1E1E1E] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2BEE34]/50"
                    placeholder="Your full name" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#6B6B6B] uppercase tracking-widest mb-1 block">Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] text-sm">@</span>
                    <input value={username} onChange={e => checkUsername(e.target.value)}
                      className="w-full bg-[#141414] border border-[#1E1E1E] rounded-xl pl-7 pr-9 py-2 text-sm text-white focus:outline-none focus:border-[#2BEE34]/50"
                      placeholder="yourname" maxLength={30} />
                    {uStatus === 'checking'  && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-[#1E1E1E] border-t-primary animate-spin" />}
                    {uStatus === 'available' && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#2BEE34]" />}
                    {uStatus === 'taken'     && <X     className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rose-400-400" />}
                  </div>
                  {uStatus === 'taken' && suggestions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="text-[11px] text-[#6B6B6B]">Try:</span>
                      {suggestions.map(s => (
                        <button key={s} onClick={() => { setUsername(s); setUStatus('available') }}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-[#2BEE34]/10 text-[#2BEE34] border border-[#2BEE34]/20 hover:bg-[#2BEE34]/20">
                          @{s}
                        </button>
                      ))}
                    </div>
                  )}
                  {uStatus === 'available' && username && <p className="text-[11px] text-[#2BEE34] mt-1">@{username} is available</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#6B6B6B] uppercase tracking-widest mb-1 block">Bio</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2}
                    className="w-full bg-[#141414] border border-[#1E1E1E] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2BEE34]/50 resize-none"
                    placeholder="A short bio (optional)" maxLength={160} />
                  <p className="text-[10px] text-[#6B6B6B] text-right mt-0.5">{bio.length}/160</p>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  {displayName || user?.displayName || user?.email?.split('@')[0]}
                </h1>
                {profile?.username && <p className="text-sm text-[#6B6B6B]">@{profile.username as string}</p>}
                {profile?.bio      && <p className="text-sm text-[#A3A3A3]">{profile.bio as string}</p>}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[#6B6B6B]">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate max-w-[200px] sm:max-w-none">{user?.email}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <Calendar className="w-4 h-4" />Joined {joinedAt}
                  </span>
                  <span className="flex items-center gap-1.5 text-[#2BEE34] shrink-0">
                    <Shield className="w-4 h-4" />Verified
                  </span>
                </div>
              </>
            )}

            {/* Plan badge */}
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                isPaid
                  ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                  : 'bg-[#2BEE34]/10 text-[#2BEE34] border-[#2BEE34]/20'}`}>
                {isPaid ? <Crown className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                {planLabel} Plan
              </span>
              {!isPaid && (
                <a href="/pricing" className="text-xs text-[#6B6B6B] hover:text-white transition-colors flex items-center gap-1">
                  Upgrade <ChevronRight className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Credits & Usage (live from /api/user/credits) ──────── */}
      {user?.uid && <CreditsCard userId={user.uid} />}

      {/* ── Detection Stats ───────────────────────────────────── */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-[#6B6B6B] uppercase tracking-widest mb-3 px-1">
          Detection Stats
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="bg-surface border border-[#1E1E1E] rounded-xl h-20 sm:h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <StatCard icon={Brain}     label="Total Scans"    value={stats?.total_scans    ?? 0} color="bg-[#2BEE34]/10 text-[#2BEE34]" />
              <StatCard icon={Shield}    label="AI Detected"    value={stats?.ai_detected    ?? 0} color="bg-[#FF4444]/10 text-rose-400-400" />
              <StatCard icon={User}      label="Human Detected" value={stats?.human_detected ?? 0} color="bg-[#2BEE34]/10 text-[#2BEE34]" />
              <StatCard icon={BarChart3} label="Avg Confidence" value={`${stats?.avg_confidence ?? 0}%`} color="bg-amber-500-500/10 text-amber-400-400" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={FileText}  label="Text"  value={stats?.text_scans  ?? 0} color="bg-amber-500-500/10 text-amber-400-400" />
              <StatCard icon={ImageIcon} label="Image" value={stats?.image_scans ?? 0} color="bg-[#2BEE34]/10 text-[#2BEE34]" />
              <StatCard icon={Music}     label="Audio" value={stats?.audio_scans ?? 0} color="bg-[#2BEE34]/10 text-[#2BEE34]" />
              <StatCard icon={Video}     label="Video" value={stats?.video_scans ?? 0} color="bg-[#2BEE34]/10 text-[#2BEE34]" />
            </div>
          </>
        )}
      </div>

      {/* ── Account Details ───────────────────────────────────── */}
      <div className="bg-surface border border-[#1E1E1E] rounded-xl p-4 sm:p-6 space-y-3">
        <h2 className="font-bold text-white flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-[#2BEE34]" /> Account Details
        </h2>
        {([
          ['Email address',  user?.email,                               ''],
          ['Username',       profile?.username ? `@${profile.username}` : '—', ''],
          ['Display name',   displayName || '—',                        ''],
          ['Joined',         joinedAt,                                  ''],
          ['Plan',           planLabel,                                 isPaid ? 'text-yellow-400' : 'text-[#2BEE34]'],
          ['Status',         'Active',                                  'text-[#2BEE34]'],
        ] as [string, string | undefined, string][]).map(([label, value, cls]) => (
          <div key={label} className="flex justify-between items-center gap-4 py-2.5 border-b border-[#1E1E1E] last:border-0 text-sm min-w-0">
            <span className="text-[#6B6B6B] shrink-0">{label}</span>
            <span className={`font-medium text-white truncate text-right min-w-0 ${cls}`}>{value ?? '—'}</span>
          </div>
        ))}
      </div>

      <ScrollToTop />
    </div>
  )
}
