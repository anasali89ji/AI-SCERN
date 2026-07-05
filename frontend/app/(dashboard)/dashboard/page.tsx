'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Brain, FileText, BarChart3, AlertTriangle, CheckCircle,
  HelpCircle, Image as ImageIcon, Video, Music, Sparkles,
  Layers, RefreshCw, Bot, Shield, ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

const TOOLS = [
  { href: '/detect/text',  icon: FileText,   label: 'Text',  desc: 'Detect AI writing'      },
  { href: '/detect/image', icon: ImageIcon,  label: 'Image', desc: 'Deepfake detection'      },
  { href: '/detect/audio', icon: Music,      label: 'Audio', desc: 'Voice clone detection'   },
  { href: '/detect/video', icon: Video,      label: 'Video', desc: 'Deepfake video analysis' },
  { href: '/batch',        icon: Layers,     label: 'Batch', desc: 'Scan 20 files at once'   },
  { href: '/chat',         icon: Bot,        label: 'ARIA',  desc: 'AI detection assistant'  },
]

function verdictColors(verdict: string) {
  if (verdict === 'AI')    return { text: 'text-[#FF4444]', bg: 'bg-[#FF4444]/10', border: 'border-[#FF4444]/20', dot: 'bg-[#FF4444]' }
  if (verdict === 'HUMAN') return { text: 'text-[#2BEE34]', bg: 'bg-[#2BEE34]/10', border: 'border-[#2BEE34]/20', dot: 'bg-[#2BEE34]' }
  return                          { text: 'text-[#FFB800]', bg: 'bg-[#FFB800]/10', border: 'border-[#FFB800]/20', dot: 'bg-[#FFB800]' }
}

function VerdictIcon({ verdict }: { verdict: string }) {
  const c = verdictColors(verdict)
  if (verdict === 'AI')    return <AlertTriangle className={`w-3.5 h-3.5 ${c.text} flex-shrink-0`} />
  if (verdict === 'HUMAN') return <CheckCircle   className={`w-3.5 h-3.5 ${c.text} flex-shrink-0`} />
  return                          <HelpCircle    className={`w-3.5 h-3.5 ${c.text} flex-shrink-0`} />
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const c = verdictColors(verdict)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider ${c.bg} ${c.border} ${c.text}`}>
      {verdict}
    </span>
  )
}

function timeAgo(ts: string) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function normalizeConf(c: number | null | undefined) {
  if (c == null) return 0
  return Math.round(c <= 1 ? c * 100 : c)
}

function MediaIcon({ type }: { type: string }) {
  const icons: Record<string, any> = { text: FileText, image: ImageIcon, audio: Music, video: Video }
  const Icon = icons[type] ?? Brain
  return <Icon className="w-3.5 h-3.5 flex-shrink-0 text-[#6B6B6B]" />
}

export default function DashboardPage() {
  const { user }                    = useAuth()
  const [stats,      setStats]      = useState<any>(null)
  const [scans,      setScans]      = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [isPulling,  setIsPulling]  = useState(false)
  const mountedRef                  = useRef(false)
  const touchStartY                 = useRef(0)
  const name = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  const loadDashboard = useCallback(async () => {
    if (!user?.uid) return
    try {
      setFetchError(false)
      const [statsRes, scansRes] = await Promise.all([
        fetch('/api/user/stats',                     { cache: 'no-store' }),
        fetch('/api/user/scans?limit=8&sort=newest', { cache: 'no-store' }),
      ])
      if (statsRes.ok) {
        const d = await statsRes.json()
        const rawAvg = d.avg_confidence ?? 0
        setStats({ ...d, avg_confidence: rawAvg <= 1 ? Math.round(rawAvg * 100) : Math.round(rawAvg) })
      }
      if (scansRes.ok) {
        const json = await scansRes.json()
        setScans(json.scans ?? json.data ?? [])
      }
    } catch { setFetchError(true) }
    finally  { setLoading(false)  }
  }, [user?.uid])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY }
    const onTouchEnd   = (e: TouchEvent) => {
      if (e.changedTouches[0].clientY - touchStartY.current > 80 && window.scrollY < 10) {
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

  const totalScans = stats?.total_scans    ?? 0
  const aiCount    = stats?.ai_detected    ?? 0
  const humanCount = stats?.human_detected ?? 0
  const avgConf    = stats?.avg_confidence ?? 0
  const aiPct      = totalScans > 0 ? Math.round(aiCount    / totalScans * 100) : 0
  const humanPct   = totalScans > 0 ? Math.round(humanCount / totalScans * 100) : 0
  const uncertPct  = Math.max(0, 100 - aiPct - humanPct)

  const STAT_CARDS = [
    { label: 'Total Scans',   value: loading ? '—' : totalScans.toLocaleString(), icon: Brain         },
    { label: 'AI Detected',   value: loading ? '—' : `${aiPct}%`,                 icon: AlertTriangle },
    { label: 'Human Rate',    value: loading ? '—' : `${humanPct}%`,              icon: CheckCircle   },
    { label: 'Avg Confidence',value: loading ? '—' : `${avgConf}%`,               icon: BarChart3     },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

      {/* Pull-to-refresh */}
      {isPulling && (
        <div className="flex items-center justify-center py-1 lg:hidden">
          <div className="flex items-center gap-2 text-xs text-[#6B6B6B] bg-[#1A1A1A] px-4 py-2 rounded-full border border-[#2A2A2A]">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2BEE34]" />
            Refreshing…
          </div>
        </div>
      )}

      {/* Welcome */}
      <div className="animate-fade-in">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Welcome back, <span className="text-[#2BEE34]">{name}</span>
        </h1>
        <p className="text-[#6B6B6B] text-sm mt-1">
          {totalScans === 0
            ? 'Run your first scan below — completely free.'
            : `You've run ${totalScans.toLocaleString()} scan${totalScans !== 1 ? 's' : ''} so far.`}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-slide-up">
        {STAT_CARDS.map(s => (
          <div key={s.label}
            className="flex items-center gap-3 p-4 sm:p-5 rounded-xl
                       bg-[#141414] border border-[#1E1E1E]
                       hover:border-[#2A2A2A] transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-[#2BEE34]/10 border border-[#2BEE34]/20 flex items-center justify-center flex-shrink-0">
              <s.icon className="w-5 h-5 text-[#2BEE34]" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-black text-white tabular-nums leading-none">{s.value}</p>
              <p className="text-[11px] text-[#6B6B6B] mt-1 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Onboarding (new users) */}
      {totalScans === 0 && !loading && (
        <div className="p-5 rounded-xl bg-[#141414] border border-[#2BEE34]/20 animate-slide-up">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#2BEE34]/10 border border-[#2BEE34]/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-[#2BEE34]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white mb-1">You're all set 🎉</h3>
              <p className="text-sm text-[#A3A3A3] mb-4 leading-relaxed">
                Pick a detection tool to run your first scan. Free — no limits on basic scans.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/detect/text"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg
                             bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] text-xs font-bold transition-colors">
                  <FileText className="w-3.5 h-3.5" /> Try Text Detection
                </Link>
                <Link href="/detect/image"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg
                             border border-[#2A2A2A] text-xs font-semibold text-[#A3A3A3]
                             hover:text-white hover:border-[#3A3A3A] transition-all">
                  <ImageIcon className="w-3.5 h-3.5" /> Try Image Detection
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tool cards */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6B6B6B] mb-3">Detection Tools</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {TOOLS.map(t => (
            <Link key={t.href} href={t.href}
              className="flex flex-col items-center gap-2.5 p-4 rounded-xl
                         bg-[#141414] border border-[#1E1E1E]
                         hover:border-[#2BEE34]/30 hover:-translate-y-px
                         transition-all duration-200 text-center group"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center
                              bg-[#1A1A1A] border border-[#2A2A2A]
                              group-hover:border-[#2BEE34]/40 transition-colors">
                <t.icon className="w-5 h-5 text-[#A3A3A3] group-hover:text-[#2BEE34] transition-colors" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#E5E5E5] group-hover:text-white transition-colors">{t.label}</p>
                <p className="text-[10px] text-[#6B6B6B] mt-0.5 leading-tight">{t.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Verdict balance bar */}
      {totalScans > 0 && (
        <div className="p-5 rounded-xl bg-[#141414] border border-[#1E1E1E]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Detection Balance</h2>
            <span className="text-xs text-[#6B6B6B]">{totalScans.toLocaleString()} scans</span>
          </div>
          <div className="flex rounded-full overflow-hidden h-2 gap-px">
            <div className="bg-[#FF4444] h-full transition-all duration-700" style={{ width: `${aiPct}%` }} />
            <div className="bg-[#FFB800] h-full transition-all duration-700" style={{ width: `${uncertPct}%` }} />
            <div className="bg-[#2BEE34] h-full transition-all duration-700" style={{ width: `${humanPct}%` }} />
          </div>
          <div className="flex items-center gap-5 mt-3 text-xs text-[#6B6B6B]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#FF4444]" />{aiPct}% AI</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#FFB800]" />{uncertPct}% Uncertain</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#2BEE34]" />{humanPct}% Human</span>
          </div>
        </div>
      )}

      {/* Recent scans */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6B6B6B]">Recent Scans</p>
          <div className="flex items-center gap-2">
            <button onClick={loadDashboard} title="Refresh"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg
                         text-[#6B6B6B] hover:text-[#A3A3A3] hover:bg-[#1A1A1A] transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {scans.length > 0 && (
              <Link href="/history"
                className="text-xs text-[#2BEE34] hover:text-[#4FFF58] font-medium flex items-center gap-1 transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[60px] rounded-xl bg-[#1A1A1A] animate-pulse" />
            ))}
          </div>
        ) : fetchError ? (
          <div className="p-8 rounded-xl bg-[#141414] border border-[#1E1E1E] text-center">
            <AlertTriangle className="w-8 h-8 text-[#FFB800] mx-auto mb-3" />
            <p className="text-[#A3A3A3] text-sm font-medium mb-1">Couldn't load scan history</p>
            <p className="text-[#6B6B6B] text-xs mb-4">Check your connection and try again</p>
            <button onClick={loadDashboard}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A1A1A]
                         border border-[#2A2A2A] text-sm font-semibold text-[#A3A3A3]
                         hover:text-white transition-all">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : scans.length === 0 ? (
          <div className="p-10 rounded-xl bg-[#141414] border border-[#1E1E1E] text-center">
            <Shield className="w-10 h-10 text-[#3A3A3A] mx-auto mb-3" />
            <p className="text-[#A3A3A3] text-sm font-medium mb-1">No scans yet</p>
            <p className="text-[#6B6B6B] text-xs mb-5">Pick a tool above to run your first detection</p>
            <Link href="/detect/text"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl
                         bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] text-sm font-semibold transition-colors">
              <FileText className="w-4 h-4" /> Try Text Detector
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {scans.map(scan => (
              <div key={scan.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl
                           bg-[#141414] border border-[#1E1E1E]
                           hover:border-[#2A2A2A] transition-all duration-200"
              >
                <MediaIcon type={scan.media_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#E5E5E5] truncate">
                    {scan.content_preview?.slice(0, 60) || `${scan.media_type} scan`}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <VerdictIcon verdict={scan.verdict} />
                    <span className="text-[11px] text-[#6B6B6B]">{timeAgo(scan.created_at)}</span>
                    <span className="text-[11px] text-[#3A3A3A]">·</span>
                    <span className="text-[11px] text-[#6B6B6B]">
                      {normalizeConf(scan.confidence_score)}% conf
                    </span>
                  </div>
                </div>
                <VerdictBadge verdict={scan.verdict} />
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
