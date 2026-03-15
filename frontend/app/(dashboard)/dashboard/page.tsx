'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, Eye, FileText, Mic, BarChart3, TrendingUp, Clock, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import type { UserStats, Scan } from '@/types'
import { formatRelativeTime, getVerdictColor } from '@/lib/utils/helpers'

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType, label: string, value: string | number, color: string, sub?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex items-start gap-4 group hover:border-primary/40 transition-all"
    >
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-text-muted text-sm mb-1">{label}</p>
        <p className="text-3xl font-black text-text-primary">{value}</p>
        {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
      </div>
    </motion.div>
  )
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, string> = {
    AI: 'badge-ai',
    HUMAN: 'badge-human',
    UNCERTAIN: 'badge-uncertain',
  }
  return <span className={styles[verdict] || 'badge-uncertain'}>{verdict}</span>
}

export default function DashboardPage() {
  const { user: firebaseUser } = useAuth()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Don't wait for firebaseUser — read UID from cookie immediately via
    // a lightweight decode. Dashboard renders skeleton instantly, data loads fast.
    if (!firebaseUser?.uid) return
    const uid = firebaseUser.uid
    async function loadData() {
      // Run all queries in parallel — no sequential fallback
      const [rpcResult, scansResult, allScansResult] = await Promise.all([
        supabase.rpc('get_user_stats', { p_user_id: uid }),
        supabase.from('scans').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(10),
        supabase.from('scans').select('verdict,confidence_score,media_type').eq('user_id', uid),
      ])

      if (rpcResult.data && !rpcResult.error) {
        const avgConf = (rpcResult.data.avg_confidence ?? 0) <= 1
          ? Math.round(rpcResult.data.avg_confidence * 100)
          : Math.round(rpcResult.data.avg_confidence)
        setStats({ ...rpcResult.data, avg_confidence: avgConf })
      } else if (allScansResult.data) {
        const allScans = allScansResult.data
        const total = allScans.length
        setStats({
          total_scans:    total,
          ai_detected:    allScans.filter(s => s.verdict === 'AI').length,
          human_detected: allScans.filter(s => s.verdict === 'HUMAN').length,
          avg_confidence: total > 0 ? Math.round(allScans.reduce((s: number, r: any) => s + (r.confidence_score ?? 0), 0) / total * 100) : 0,
          image_scans:    allScans.filter(s => s.media_type === 'image').length,
          video_scans:    allScans.filter(s => s.media_type === 'video').length,
          audio_scans:    allScans.filter(s => s.media_type === 'audio').length,
          text_scans:     allScans.filter(s => s.media_type === 'text').length,
          uncertain:      allScans.filter(s => s.verdict === 'UNCERTAIN').length,
        })
      }
      if (scansResult.data) setScans(scansResult.data)
      setLoading(false)
    }
    loadData()

    const channel = supabase
      .channel(`scans-rt-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans', filter: `user_id=eq.${uid}` }, (payload) => {
        setScans(prev => [payload.new as Scan, ...prev.slice(0, 9)])
        setStats(prev => prev ? { ...prev, total_scans: prev.total_scans + 1 } : prev)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [firebaseUser?.uid])

  if (loading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-28 skeleton" />
          ))}
        </div>
        <div className="card h-96 skeleton" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text-primary mb-1">Dashboard</h1>
        <p className="text-text-muted">Real-time AI detection analytics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={BarChart3} label="Total Scans"
          value={stats?.total_scans ?? 0}
          color="bg-primary/10 text-primary"
          sub="All time"
        />
        <StatCard
          icon={Brain} label="AI Detected"
          value={stats?.ai_detected ?? 0}
          color="bg-rose/10 text-rose"
          sub={stats ? `${Math.round((stats.ai_detected / Math.max(stats.total_scans, 1)) * 100)}% of total` : ''}
        />
        <StatCard
          icon={TrendingUp} label="Human Content"
          value={stats?.human_detected ?? 0}
          color="bg-emerald/10 text-emerald"
          sub="Verified human"
        />
        <StatCard
          icon={Zap} label="Avg Confidence"
          value={`${stats?.avg_confidence ?? 0}%`}
          color="bg-cyan/10 text-cyan"
          sub="Detection accuracy"
        />
      </div>

      {/* Media type breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Eye, label: 'Images', count: stats?.image_scans ?? 0, color: 'text-primary bg-primary/10' },
          { icon: Zap, label: 'Videos', count: stats?.video_scans ?? 0, color: 'text-secondary bg-secondary/10' },
          { icon: Mic, label: 'Audio', count: stats?.audio_scans ?? 0, color: 'text-cyan bg-cyan/10' },
          { icon: FileText, label: 'Text', count: stats?.text_scans ?? 0, color: 'text-amber bg-amber/10' },
        ].map(m => (
          <div key={m.label} className="card py-4 text-center">
            <div className={`w-10 h-10 rounded-xl ${m.color} flex items-center justify-center mx-auto mb-2`}>
              <m.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-text-primary">{m.count}</div>
            <div className="text-xs text-text-muted">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { href: '/detect/image', label: 'Detect Image',  color: 'from-primary/20 to-primary/5   border-primary/20   text-primary',   icon: Eye   },
          { href: '/detect/text',  label: 'Analyze Text',  color: 'from-amber/20  to-amber/5    border-amber/20    text-amber',    icon: FileText },
          { href: '/detect/audio', label: 'Check Audio',   color: 'from-cyan/20   to-cyan/5     border-cyan/20     text-cyan',     icon: Mic   },
          { href: '/batch',        label: 'Batch Scan',    color: 'from-secondary/20 to-secondary/5 border-secondary/20 text-secondary', icon: Zap },
        ].map(({ href, label, color, icon: Icon }) => (
          <a key={href} href={href}
            className={`card bg-gradient-to-br ${color} border py-4 flex flex-col items-center gap-2 text-center hover:scale-[1.02] transition-all group cursor-pointer`}>
            <Icon className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold">{label}</span>
          </a>
        ))}
      </div>

      {/* Detection breakdown bar */}
      {stats && stats.total_scans > 0 && (
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Detection Breakdown</h3>
            <span className="text-xs text-text-muted">{stats.total_scans} total</span>
          </div>
          <div className="h-3 bg-border rounded-full overflow-hidden flex">
            {stats.ai_detected > 0 && (
              <div className="h-full bg-rose transition-all rounded-l-full"
                style={{ width: `${(stats.ai_detected / stats.total_scans) * 100}%` }}
                title={`AI: ${stats.ai_detected}`} />
            )}
            {stats.human_detected > 0 && (
              <div className="h-full bg-emerald transition-all"
                style={{ width: `${(stats.human_detected / stats.total_scans) * 100}%` }}
                title={`Human: ${stats.human_detected}`} />
            )}
            {(stats.uncertain ?? 0) > 0 && (
              <div className="h-full bg-amber transition-all rounded-r-full"
                style={{ width: `${((stats.uncertain ?? 0) / stats.total_scans) * 100}%` }}
                title={`Uncertain: ${stats.uncertain}`} />
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose" />AI ({stats.ai_detected})</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald" />Human ({stats.human_detected})</div>
            {(stats.uncertain ?? 0) > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber" />Uncertain ({stats.uncertain})</div>}
          </div>
        </div>
      )}

      {/* Recent Scans */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Recent Scans
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse ml-1" />
          </h2>
        </div>

        {scans.length === 0 ? (
          <div className="text-center py-16">
            <Brain className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-muted">No scans yet. Start detecting AI content!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-border">
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Content</th>
                  <th className="pb-3 pr-4">Verdict</th>
                  <th className="pb-3 pr-4">Confidence</th>
                  <th className="pb-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {scans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="text-xs font-medium bg-surface px-2 py-1 rounded-md text-text-secondary uppercase">
                        {scan.media_type}
                      </span>
                    </td>
                    <td className="py-3 pr-4 max-w-xs">
                      <span className="text-sm text-text-secondary truncate block">
                        {scan.file_name || scan.source_url || scan.content_preview?.substring(0, 40) + '...' || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {scan.verdict ? <VerdictBadge verdict={scan.verdict} /> : (
                        <span className="text-xs text-text-muted">{scan.status}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                            style={{ width: `${Math.round((scan.confidence_score ?? 0) * ((scan.confidence_score ?? 0) <= 1 ? 100 : 1))}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted">{Math.round((scan.confidence_score ?? 0) * ((scan.confidence_score ?? 0) <= 1 ? 100 : 1))}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-xs text-text-muted">{formatRelativeTime(scan.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
