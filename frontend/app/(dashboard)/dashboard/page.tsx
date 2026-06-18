'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Brain, FileText, BarChart3, Zap, ArrowRight, Shield,
  CheckCircle, AlertTriangle, HelpCircle, Image as ImageIcon,
  Video, Music, Sparkles, Layers, RefreshCw, Bot,
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

const TOOLS = [
  { href:'/detect/text',  icon:FileText,   label:'Text',   iconColor:'text-amber-400-400',   accent:'#f59e0b', desc:'Detect AI writing'       },
  { href:'/detect/image', icon:ImageIcon,  label:'Image',  iconColor:'text-blue-400',    accent:'#3b82f6', desc:'Deepfake detection'       },
  { href:'/detect/audio', icon:Music,      label:'Audio',  iconColor:'text-violet-400',  accent:'#8b5cf6', desc:'Voice clone detection'    },
  { href:'/detect/video', icon:Video,      label:'Video',  iconColor:'text-emerald-400-400', accent:'#10b981', desc:'Deepfake video analysis'  },
  { href:'/batch',        icon:Layers,     label:'Batch',  iconColor:'text-rose-400-400',    accent:'#f43f5e', desc:'Scan 20 files at once'    },
  { href:'/chat',         icon:Bot,        label:'ARIA',   iconColor:'text-sky-400',     accent:'#0ea5e9', desc:'AI detection assistant'   },
]

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === 'AI')    return <AlertTriangle className="w-3.5 h-3.5 text-rose-400-400 flex-shrink-0" />
  if (verdict === 'HUMAN') return <CheckCircle   className="w-3.5 h-3.5 text-emerald-400-400 flex-shrink-0" />
  return                          <HelpCircle    className="w-3.5 h-3.5 text-amber-400-400 flex-shrink-0" />
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const s = verdict === 'AI'
    ? 'bg-rose-500-500/10 text-rose-400-400 border-rose-500/20'
    : verdict === 'HUMAN'
    ? 'bg-emerald-500-500/10 text-emerald-400-400 border-emerald-500/20'
    : 'bg-amber-500-500/10 text-amber-400-400 border-amber-500/20'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider ${s}`}>
      {verdict}
    </span>
  )
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

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22,1,0.36,1] } },
}

export default function DashboardPage() {
  const { user }                          = useAuth()
  const router                            = useRouter()
  const [stats,      setStats]            = useState<any>(null)
  const [scans,      setScans]            = useState<any[]>([])
  const [loading,    setLoading]          = useState(true)
  const [fetchError, setFetchError]       = useState(false)
  const [isPulling,  setIsPulling]        = useState(false)
  const mountedRef                        = useRef(false)
  const touchStartY                       = useRef(0)
  const name = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  const loadDashboard = useCallback(async () => {
    if (!user?.uid) return
    try {
      setFetchError(false)
      const [statsRes, scansRes] = await Promise.all([
        fetch('/api/user/stats',                    { cache: 'no-store' }),
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
        setScans(json.scans ?? json.data ?? [])
      }
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    loadDashboard()
  }, [loadDashboard])

  // Pull-to-refresh
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY }
    const onTouchEnd   = (e: TouchEvent) => {
      const delta = e.changedTouches[0].clientY - touchStartY.current
      if (delta > 80 && window.scrollY < 10) {
        setIsPulling(true)
        loadDashboard().finally(() => setIsPulling(false))
      }
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, [loadDashboard])

  const totalScans = stats?.total_scans   ?? 0
  const aiCount    = stats?.ai_detected   ?? 0
  const humanCount = stats?.human_detected ?? 0
  const avgConf    = stats?.avg_confidence ?? 0
  const aiPct      = totalScans > 0 ? Math.round(aiCount    / totalScans * 100) : 0
  const humanPct   = totalScans > 0 ? Math.round(humanCount / totalScans * 100) : 0
  const uncertPct  = Math.max(0, 100 - aiPct - humanPct)

  const STAT_CARDS = [
    { label:'Total Scans',  value: loading ? '—' : totalScans.toLocaleString(), icon: Brain,         accent: 'text-blue-400',    bg: 'bg-blue-500/[0.08]',    border: 'border-blue-500/15'    },
    { label:'AI Detected',  value: loading ? '—' : `${aiPct}%`,                 icon: AlertTriangle, accent: 'text-rose-400-400',    bg: 'bg-rose-500-500/[0.08]',    border: 'border-rose-500/15'    },
    { label:'Human Rate',   value: loading ? '—' : `${humanPct}%`,              icon: CheckCircle,   accent: 'text-emerald-400-400', bg: 'bg-emerald-500-500/[0.08]', border: 'border-emerald-500/15' },
    { label:'Avg Confidence',value: loading ? '—' : `${avgConf}%`,             icon: BarChart3,     accent: 'text-amber-400-400',   bg: 'bg-amber-500-500/[0.08]',   border: 'border-amber-500/15'   },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 overflow-x-hidden">

      {/* Pull-to-refresh indicator */}
      {isPulling && (
        <div className="flex items-center justify-center py-1 lg:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-[#0f0f17] px-4 py-2 rounded-full border border-white/[0.06]">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            Refreshing…
          </div>
        </div>
      )}

      {/* ── Welcome ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22,1,0.36,1] }}
      >
        <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
          Welcome back, <span className="gradient-text">{name}</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {totalScans === 0
            ? 'Run your first scan below — completely free.'
            : `You've run ${totalScans.toLocaleString()} scan${totalScans !== 1 ? 's' : ''} so far.`}
        </p>
      </motion.div>

      {/* ── Stat cards ── */}
      <motion.div
        variants={stagger} initial="hidden" animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {STAT_CARDS.map((s) => (
          <motion.div key={s.label} variants={fadeUp}
            className="flex items-center gap-3 p-4 sm:p-5 rounded-[14px]
                       bg-[#0f0f17] border border-white/[0.08]
                       hover:border-white/[0.13] hover:-translate-y-px transition-all duration-200"
          >
            <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.border} border flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.accent}`} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-black text-slate-100 tabular-nums leading-none">{s.value}</p>
              <p className="text-[11px] text-slate-500 mt-1 truncate">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Onboarding card (new users) ── */}
      {totalScans === 0 && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="p-5 rounded-[14px] bg-[#0f0f17] border border-blue-500/20"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 mb-1">You're all set 🎉</h3>
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                Pick a detection tool to run your first scan. Free — no limits on basic scans.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/detect/text"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors">
                  <FileText className="w-3.5 h-3.5" /> Try Text Detection
                </Link>
                <Link href="/detect/image"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/[0.08] text-xs font-semibold text-slate-400 hover:text-white hover:border-white/[0.14] transition-all">
                  <ImageIcon className="w-3.5 h-3.5" /> Try Image Detection
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Tool cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
      >
        <p className="section-eyebrow mb-3">Detection Tools</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href}
              className="flex flex-col items-center gap-2.5 p-4 rounded-[14px]
                         bg-[#0f0f17] border border-white/[0.08]
                         hover:border-white/[0.14] hover:-translate-y-px
                         transition-all duration-200 text-center group"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: `${t.accent}18`, border: `1px solid ${t.accent}28` }}
              >
                <t.icon className={`w-5 h-5 ${t.iconColor}`} strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{t.label}</p>
                <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">{t.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* ── Verdict balance bar ── */}
      {totalScans > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="p-5 rounded-[14px] bg-[#0f0f17] border border-white/[0.08]"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-100">Detection Balance</h2>
            <span className="text-xs text-slate-500">{totalScans.toLocaleString()} scans</span>
          </div>
          <div className="flex rounded-full overflow-hidden h-2 gap-px">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${aiPct}%` }}
              transition={{ duration: 0.9, ease: [0.22,1,0.36,1] }}
              className="bg-rose-500-500 h-full"
            />
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${uncertPct}%` }}
              transition={{ duration: 0.9, ease: [0.22,1,0.36,1], delay: 0.1 }}
              className="bg-amber-500-500/60 h-full"
            />
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${humanPct}%` }}
              transition={{ duration: 0.9, ease: [0.22,1,0.36,1], delay: 0.2 }}
              className="bg-emerald-500-500 h-full"
            />
          </div>
          <div className="flex items-center gap-5 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500-500" />{aiPct}% AI</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500-500/60" />{uncertPct}% Uncertain</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500-500" />{humanPct}% Human</span>
          </div>
        </motion.div>
      )}

      {/* ── Recent scans ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.25 }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="section-eyebrow">Recent Scans</p>
          <div className="flex items-center gap-2">
            <button onClick={loadDashboard} title="Refresh"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg
                         text-slate-600 hover:text-slate-400 hover:bg-white/[0.04] transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {scans.length > 0 && (
              <Link href="/history"
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[60px] rounded-[14px] shimmer" />
            ))}
          </div>
        ) : fetchError ? (
          <div className="p-8 rounded-[14px] bg-[#0f0f17] border border-white/[0.08] text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400-400 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium mb-1">Couldn't load scan history</p>
            <p className="text-slate-600 text-xs mb-4">Check your connection and try again</p>
            <button onClick={loadDashboard}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141420]
                         border border-white/[0.08] text-sm font-semibold text-slate-400
                         hover:text-slate-100 transition-all">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : scans.length === 0 ? (
          <div className="p-10 rounded-[14px] bg-[#0f0f17] border border-white/[0.08] text-center">
            <Shield className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium mb-1">No scans yet</p>
            <p className="text-slate-600 text-xs mb-5">Pick a tool above to run your first detection</p>
            <Link href="/detect/text"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
              <FileText className="w-4 h-4" /> Try Text Detector
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {scans.map((scan) => (
              <div key={scan.id}
                className="flex items-center gap-3 px-4 py-3 rounded-[14px]
                           bg-[#0f0f17] border border-white/[0.08]
                           hover:border-white/[0.13] transition-all duration-200"
              >
                <div className="text-slate-600 flex-shrink-0">{mediaIcon(scan.media_type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">
                    {scan.content_preview?.slice(0, 60) || `${scan.media_type} scan`}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <VerdictIcon verdict={scan.verdict} />
                    <span className="text-[11px] text-slate-500">{timeAgo(scan.created_at)}</span>
                    <span className="text-[11px] text-slate-700">·</span>
                    <span className="text-[11px] text-slate-500">
                      {Math.round((scan.confidence_score ?? 0) * 100)}% conf
                    </span>
                  </div>
                </div>
                <VerdictBadge verdict={scan.verdict} />
              </div>
            ))}
          </div>
        )}
      </motion.div>

    </div>
  )
}
