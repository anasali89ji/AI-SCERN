'use client'
export const dynamic = 'force-dynamic'
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
    async function loadData() {
      const uid = firebaseUser?.uid
      if (!uid) return
      const user = { id: uid }

      const { data: statsData } = await supabase.rpc('get_user_stats', { p_user_id: user.id })
      if (statsData) setStats(statsData)

      const { data: scansData } = await supabase
        .from('scans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (scansData) setScans(scansData)
      setLoading(false)
    }
    loadData()

    // Realtime subscription
    const channel = supabase
      .channel('scans-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans' }, (payload) => {
        setScans(prev => [payload.new as Scan, ...prev.slice(0, 9)])
        setStats(prev => prev ? { ...prev, total_scans: prev.total_scans + 1 } : prev)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

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
                            style={{ width: `${scan.confidence_score ?? 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted">{scan.confidence_score ?? 0}%</span>
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
