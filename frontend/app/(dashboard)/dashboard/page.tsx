'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Brain, FileText, Mic, BarChart3,
  Zap, ArrowRight, Shield, CheckCircle, AlertTriangle,
  HelpCircle, Image as ImageIcon, Video, Music, Sparkles, Layers,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

const TOOLS = [
  { href: '/detect/text',  icon: FileText,  label: 'Text',  color: 'from-amber/20 to-amber/5',     iconColor: 'text-amber',     desc: 'Detect AI-written content'    },
  { href: '/detect/image', icon: ImageIcon, label: 'Image', color: 'from-violet-500/20 to-violet-500/5', iconColor: 'text-violet-400', desc: 'Deepfake & AI image detection' },
  { href: '/detect/audio', icon: Mic,       label: 'Audio', color: 'from-cyan/20 to-cyan/5',        iconColor: 'text-cyan',      desc: 'Voice clone detection'         },
  { href: '/detect/video', icon: Video,     label: 'Video', color: 'from-rose/20 to-rose/5',        iconColor: 'text-rose',      desc: 'Deepfake video analysis'       },
  { href: '/batch',        icon: Brain,     label: 'Batch', color: 'from-emerald/20 to-emerald/5',  iconColor: 'text-emerald',   desc: 'Scan up to 20 files at once'         },
  { href: '/chat',         icon: Zap,       label: 'ARIA',  color: 'from-indigo-500/20 to-indigo-500/5', iconColor: 'text-indigo-400', desc: 'AI detection assistant'   },
]

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === 'AI')        return <AlertTriangle className="w-3.5 h-3.5 text-rose flex-shrink-0" />
  if (verdict === 'HUMAN')     return <CheckCircle   className="w-3.5 h-3.5 text-emerald flex-shrink-0" />
  return                              <HelpCircle    className="w-3.5 h-3.5 text-amber flex-shrink-0" />
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const s = verdict === 'AI' ? 'text-rose bg-rose/10 border-rose/20'
          : verdict === 'HUMAN' ? 'text-emerald bg-emerald/10 border-emerald/20'
          : 'text-amber bg-amber/10 border-amber/20'
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider ${s}`}>{verdict}</span>
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function mediaIcon(type: string) {
  const icons: Record<string, any> = { text: FileText, image: ImageIcon, audio: Music, video: Video }
  const Icon = icons[type] ?? Brain
  return <Icon className="w-3.5 h-3.5 flex-shrink-0" />
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [stats,   setStats]   = useState<any>(null)
  const [scans,   setScans]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const mountedRef = useRef(false)
  const name = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  const loadDashboard = useCallback(async () => {
    if (!user?.uid) return
    try {
      setFetchError(false)
      const [statsRes, scansRes] = await Promise.all([
        fetch('/api/user/stats',                   { cache: 'no-store' }),
        fetch('/api/user/scans?limit=8&sort=newest', { cache: 'no-store' }),
      ])
      if (statsRes.ok) {
        const d = await statsRes.json()
        const rawAvg = d.avg_confidence ?? 0
        const avg = rawAvg <= 1 ? Math.round(rawAvg * 100) : Math.round(rawAvg)
        setStats({ ...d, avg_confidence: avg })
      }
      if (scansRes.ok) {
        const json = await scansRes.json()
        // API returns { data: [...], total: n }
        setScans(json.data ?? [])
      }
      if (!statsRes.ok && !scansRes.ok) setFetchError(true)
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    // Bust Next.js router segment cache on every mount so navigating back
    // always fetches fresh data instead of showing a stale cached page.
    if (!mountedRef.current) {
      mountedRef.current = true
      router.refresh()
    }

    loadDashboard()

    const onVisible   = () => { if (document.visibilityState === 'visible') loadDashboard() }
    const onFocus     = () => loadDashboard()
    const onScanSaved = () => loadDashboard()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('aiscern:scan-saved', onScanSaved)

    // Poll every 10 s — fast enough to feel live, cheap enough to run
    const poll = setInterval(loadDashboard, 10_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('aiscern:scan-saved', onScanSaved)
      clearInterval(poll)
    }
  }, [loadDashboard, router])

  const totalScans = stats?.total_scans ?? 0
  const aiCount    = stats?.ai_detected  ?? 0
  const humanCount = stats?.human_detected ?? 0
  const avgConf    = stats?.avg_confidence ?? 0
  const aiPct      = totalScans > 0 ? Math.round(aiCount / totalScans * 100) : 0
  const humanPct   = totalScans > 0 ? Math.round(humanCount / totalScans * 100) : 0

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-4 sm:space-y-6">

      {/* ── Welcome ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-black text-text-primary">
          Welcome back, <span className="gradient-text">{name}</span> 👋
        </h1>
        <p className="text-text-muted text-sm mt-1">
          {totalScans === 0 ? 'Run your first scan below.' : `You've run ${totalScans.toLocaleString()} scan${totalScans !== 1 ? 's' : ''} so far.`}
        </p>
      </motion.div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Total Scans',  value: loading ? '—' : totalScans.toLocaleString(), icon: Brain,         color: 'bg-primary/10 text-primary'  },
          { label: 'AI Rate',      value: loading ? '—' : `${aiPct}%`,                 icon: AlertTriangle, color: 'bg-rose/10 text-rose'        },
          { label: 'Human Rate',   value: loading ? '—' : `${humanPct}%`,              icon: CheckCircle,   color: 'bg-emerald/10 text-emerald'  },
          { label: 'Avg Accuracy', value: loading ? '—' : `${avgConf}%`,               icon: BarChart3,     color: 'bg-amber/10 text-amber'      },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-surface border border-border/50 rounded-2xl p-4 sm:p-5 flex items-center gap-3 hover:border-primary/30 transition-all">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center flex-shrink-0`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-black text-text-primary tabular-nums leading-tight">{s.value}</p>
              <p className="text-[11px] sm:text-xs text-text-muted truncate mt-0.5">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Tools grid ── */}
      <div>
        {/* New user onboarding card */}
        {totalScans === 0 && !loading && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent border border-primary/20 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-text-primary mb-1">Welcome to Aiscern! 🎉</h3>
                <p className="text-xs sm:text-sm text-text-muted mb-3 leading-relaxed">
                  You're all set. Pick a detection tool below to run your first scan — completely free, no limits.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/detect/text"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all">
                    <FileText className="w-3.5 h-3.5" /> Try Text Detection
                  </Link>
                  <Link href="/detect/image"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-muted hover:border-primary/40 hover:text-text-primary transition-all">
                    <ImageIcon className="w-3.5 h-3.5" /> Try Image Detection
                  </Link>
                  <Link href="/batch"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-muted hover:border-primary/40 hover:text-text-primary transition-all">
                    <Layers className="w-3.5 h-3.5" /> Try Batch Scan
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        <div className="flex items-center justify-between mb-3 px-0.5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-widest">Detection Tools</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {TOOLS.map((t, i) => (
            <motion.div key={t.href} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }} whileHover={{ y: -2, scale: 1.02 }}>
              <Link href={t.href}
                className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-2xl bg-gradient-to-br ${t.color} border border-border/50 hover:border-primary/30 transition-all text-center group`}>
                <div className={`w-10 h-10 rounded-xl bg-background/80 flex items-center justify-center ${t.iconColor} group-hover:scale-110 transition-transform`}>
                  <t.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">{t.label}</p>
                  <p className="text-[10px] text-text-muted mt-0.5 leading-tight">{t.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── AI/Human balance bar ── */}
      {totalScans > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-surface border border-border/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">Detection Balance</h2>
            <span className="text-xs text-text-muted">{totalScans} total scans</span>
          </div>
          <div className="flex rounded-full overflow-hidden h-3 gap-0.5">
            <div className="bg-rose transition-all duration-700" style={{ width: `${aiPct}%` }} />
            <div className="bg-amber/60 transition-all duration-700" style={{ width: `${100 - aiPct - humanPct}%` }} />
            <div className="bg-emerald transition-all duration-700" style={{ width: `${humanPct}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2.5 text-xs text-text-muted">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose" />{aiPct}% AI</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber/60" />{100-aiPct-humanPct}% Uncertain</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald" />{humanPct}% Human</span>
          </div>
        </motion.div>
      )}

      {/* ── Recent scans ── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-widest">Recent Scans</h2>
          <div className="flex items-center gap-2">
            <button onClick={loadDashboard} title="Refresh"
              className="text-text-disabled hover:text-text-muted transition-colors p-1 rounded-lg hover:bg-surface-hover">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {scans.length > 0 && (
              <Link href="/history" className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-surface border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : fetchError ? (
          <div className="bg-surface border border-border rounded-2xl p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-amber mx-auto mb-3" />
            <p className="text-text-muted text-sm font-medium">Couldn't load scan history</p>
            <p className="text-text-disabled text-xs mt-1 mb-4">Check your connection and try again</p>
            <button onClick={loadDashboard}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-hover border border-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-all">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : scans.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-10 text-center">
            <Shield className="w-10 h-10 text-text-disabled mx-auto mb-3" />
            <p className="text-text-muted text-sm font-medium">No scans yet</p>
            <p className="text-text-disabled text-xs mt-1 mb-4">Pick a tool above to run your first detection</p>
            <Link href="/detect/text"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all">
              <FileText className="w-4 h-4" /> Try Text Detector
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {scans.map((scan, i) => (
              <motion.div key={scan.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, ease: 'easeOut' }}
                className="flex items-center gap-3 bg-surface border border-border/50 rounded-xl px-4 py-3 hover:border-primary/30 transition-all">
                <div className="text-text-muted">{mediaIcon(scan.media_type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {scan.content_preview?.slice(0, 60) || `${scan.media_type} scan`}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <VerdictIcon verdict={scan.verdict} />
                    <span className="text-[11px] text-text-muted">{timeAgo(scan.created_at)}</span>
                    <span className="text-[11px] text-text-disabled">·</span>
                    <span className="text-[11px] text-text-muted">{Math.round((scan.confidence_score ?? 0) * 100)}% conf</span>
                  </div>
                </div>
                <VerdictBadge verdict={scan.verdict} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
