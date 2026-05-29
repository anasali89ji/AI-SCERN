'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Brain, FileText, Mic, BarChart3, Zap, ArrowRight, Shield,
  CheckCircle, AlertTriangle, HelpCircle, Image as ImageIcon,
  Video, Music, Sparkles, Layers, RefreshCw, TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { GlassCard } from '@/components/ui/glass-card'
import { DetectionBadge } from '@/components/ui/detection-badge'
import { NumberCounter } from '@/components/motion/NumberCounter'
import { FadeIn } from '@/components/motion/FadeIn'
import { StaggerContainer, StaggerItem } from '@/components/motion/StaggerContainer'

// ── Constants ─────────────────────────────────────────────────────────────────
const TOOLS = [
  { href: '/detect/text',  icon: FileText,  label: 'Text',   color: 'from-amber/20 to-amber/5',       iconColor: 'text-amber',     desc: 'Detect AI-written text'      },
  { href: '/detect/image', icon: ImageIcon, label: 'Image',  color: 'from-violet-500/20 to-violet-500/5', iconColor: 'text-violet-400', desc: 'AI image & deepfake detection' },
  { href: '/detect/audio', icon: Mic,       label: 'Audio',  color: 'from-cyan/20 to-cyan/5',         iconColor: 'text-cyan',      desc: 'Voice clone detection'       },
  { href: '/detect/video', icon: Video,     label: 'Video',  color: 'from-rose/20 to-rose/5',         iconColor: 'text-rose',      desc: 'Deepfake video analysis'     },
  { href: '/batch',        icon: Layers,    label: 'Batch',  color: 'from-emerald/20 to-emerald/5',   iconColor: 'text-emerald',   desc: 'Scan up to 20 files'         },
  { href: '/chat',         icon: Zap,       label: 'ARIA',   color: 'from-indigo-500/20 to-indigo-500/5', iconColor: 'text-indigo-400', desc: 'AI detection assistant'   },
]

const TYPE_ICONS: Record<string, React.ElementType> = {
  text: FileText, image: ImageIcon, audio: Music, video: Video,
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

function mapVerdict(v: string): 'ai' | 'human' | 'uncertain' {
  if (v === 'AI')    return 'ai'
  if (v === 'HUMAN') return 'human'
  return 'uncertain'
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({
  title, value, icon: Icon, suffix = '', trend, trendUp, delay = 0,
}: {
  title: string; value: number; icon: React.ElementType
  suffix?: string; trend?: string; trendUp?: boolean; delay?: number
}) {
  return (
    <FadeIn delay={delay}>
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-blue-400" />
          </div>
          {trend && (
            <span className={`flex items-center gap-1 text-xs font-medium ${trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              <TrendingUp className={`w-3 h-3 ${trendUp ? '' : 'rotate-180'}`} />
              {trend}
            </span>
          )}
        </div>
        <div className="text-2xl font-bold text-text-primary tabular-nums">
          <NumberCounter value={value} suffix={suffix} />
        </div>
        <p className="text-xs text-text-muted mt-1">{title}</p>
      </GlassCard>
    </FadeIn>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const [stats,   setStats]   = useState<any>(null)
  const [scans,   setScans]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  const mountedRef = useRef(true)

  const name = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  const loadDashboard = useCallback(async () => {
    if (!user?.uid) return
    setError(false)
    try {
      const [statsRes, scansRes] = await Promise.all([
        fetch('/api/user/stats',                      { cache: 'no-store' }),
        fetch('/api/user/scans?limit=6&sort=newest',  { cache: 'no-store' }),
      ])
      if (!mountedRef.current) return

      if (statsRes.ok) {
        const d = await statsRes.json()
        const rawAvg = d.avg_confidence ?? 0
        setStats({ ...d, avg_confidence: rawAvg <= 1 ? Math.round(rawAvg * 100) : Math.round(rawAvg) })
      }
      if (scansRes.ok) {
        const json = await scansRes.json()
        setScans(Array.isArray(json) ? json : (json.data ?? []))
      }
    } catch {
      if (mountedRef.current) setError(true)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    mountedRef.current = true
    loadDashboard()
    return () => { mountedRef.current = false }
  }, [loadDashboard])

  const totalScans  = stats?.total_scans  ?? 0
  const aiDetected  = stats?.ai_count     ?? 0
  const humanCount  = stats?.human_count  ?? 0
  const avgConfidence = stats?.avg_confidence ?? 0
  const aiRate = totalScans > 0 ? Math.round((aiDetected / totalScans) * 100) : 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
              Hey, {name} 👋
            </h1>
            <p className="text-text-muted mt-1 text-sm">
              {totalScans > 0
                ? `${totalScans.toLocaleString()} scans total — here's your overview`
                : 'Welcome to Aiscern. Run your first detection below.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 self-start sm:self-auto"
            onClick={loadDashboard}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </FadeIn>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard title="Total Scans"    value={totalScans}    icon={BarChart3} delay={0}    trend="+12%" trendUp />
            <StatCard title="AI Detected"    value={aiDetected}    icon={AlertTriangle} delay={0.05} trend="+5%"  trendUp />
            <StatCard title="Human Verified" value={humanCount}    icon={CheckCircle}   delay={0.1}  trend="+8%"  trendUp />
            <StatCard title="Avg Accuracy"   value={avgConfidence} icon={Brain}         delay={0.15} suffix="%" trend="+2%" trendUp />
          </>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* Detection distribution */}
        <FadeIn delay={0.1} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detection Overview</CardTitle>
              <CardDescription>Breakdown of your scan results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
              ) : totalScans === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Brain className="w-10 h-10 text-text-disabled mb-3" />
                  <p className="text-sm text-text-muted">No scans yet — run a detection to see stats here</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {[
                      { label: 'AI Generated', pct: aiRate,         color: 'bg-rose',    icon: AlertTriangle, iconClass: 'text-rose-400' },
                      { label: 'Human Made',   pct: 100 - aiRate,   color: 'bg-emerald', icon: CheckCircle,   iconClass: 'text-emerald-400' },
                    ].map(row => (
                      <div key={row.label}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="flex items-center gap-2 text-text-secondary">
                            <row.icon className={`w-4 h-4 ${row.iconClass}`} />
                            {row.label}
                          </span>
                          <span className="font-semibold text-text-primary tabular-nums">{row.pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-active overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${row.pct}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                            className={`h-full rounded-full ${row.color}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Per-modality breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    {(['text', 'image', 'audio', 'video'] as const).map(type => {
                      const Icon = TYPE_ICONS[type]
                      const count = scans.filter(s => (s.content_type || s.type) === type).length
                      return (
                        <Link key={type} href={`/detect/${type}`}>
                          <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-active hover:bg-white/[0.04] transition-colors cursor-pointer">
                            <Icon className="w-5 h-5 text-text-muted" />
                            <div className="text-xl font-bold text-text-primary tabular-nums">{count}</div>
                            <div className="text-xs text-text-muted capitalize">{type}</div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Recent scans */}
        <FadeIn delay={0.15}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Scans</CardTitle>
              <CardDescription>Your latest detections</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : scans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Sparkles className="w-8 h-8 text-text-disabled mb-2" />
                  <p className="text-xs text-text-muted">No scans yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scans.slice(0, 5).map((scan, i) => {
                    const type = scan.content_type || scan.type || 'text'
                    const Icon = TYPE_ICONS[type] ?? FileText
                    const verdict = mapVerdict(scan.verdict || 'UNCERTAIN')
                    const filename = scan.filename || scan.file_name || `Scan #${i + 1}`
                    return (
                      <motion.div
                        key={scan.id || i}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-surface-active flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-text-muted" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">{filename}</p>
                          <p className="text-[10px] text-text-disabled">
                            {scan.created_at ? timeAgo(scan.created_at) : '—'}
                          </p>
                        </div>
                        <DetectionBadge result={verdict} size="sm" />
                      </motion.div>
                    )
                  })}
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-4 gap-2 text-text-muted hover:text-text-secondary"
                asChild
              >
                <Link href="/history">
                  View All History
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Quick detect grid */}
      <div>
        <FadeIn delay={0.2}>
          <h2 className="text-base font-semibold text-text-primary mb-4">Quick Detection</h2>
        </FadeIn>
        <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {TOOLS.map(tool => (
            <StaggerItem key={tool.href}>
              <Link href={tool.href}>
                <GlassCard className="p-4 text-center group cursor-pointer h-full">
                  <div className={`w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center bg-gradient-to-br ${tool.color} transition-transform group-hover:scale-110`}>
                    <tool.icon className={`w-5 h-5 ${tool.iconColor}`} />
                  </div>
                  <p className="text-xs font-semibold text-text-primary">{tool.label}</p>
                  <p className="text-[10px] text-text-muted mt-0.5 leading-tight hidden sm:block">{tool.desc}</p>
                </GlassCard>
              </Link>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>

      {error && (
        <div className="rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-sm text-rose-400 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Failed to load dashboard data.</span>
          <button onClick={loadDashboard} className="ml-auto text-xs underline hover:no-underline">
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
