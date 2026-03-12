'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, Search, Filter, Download, Trash2, Eye, Image as ImgIcon, Video, Mic, FileText, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import type { Scan } from '@/types'
import { formatRelativeTime, formatFileSize } from '@/lib/utils/helpers'

const mediaIcons = { image: ImgIcon, video: Video, audio: Mic, text: FileText, url: Globe }
const mediaColors = { image: 'text-primary bg-primary/10', video: 'text-secondary bg-secondary/10', audio: 'text-cyan bg-cyan/10', text: 'text-amber bg-amber/10', url: 'text-emerald bg-emerald/10' }

export default function HistoryPage() {
  const { user: firebaseUser } = useAuth()
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadScans()
  }, [])

  async function loadScans() {
      const uid = firebaseUser?.uid
      if (!uid) return
      const user = { id: uid }
    const { data } = await supabase.from('scans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
    if (data) setScans(data)
    setLoading(false)
  }

  async function deleteScan(id: string) {
    setDeleting(id)
    await supabase.from('scans').delete().eq('id', id)
    setScans(prev => prev.filter(s => s.id !== id))
    setDeleting(null)
  }

  const filtered = scans.filter(s => {
    const matchSearch = !search || s.file_name?.toLowerCase().includes(search.toLowerCase()) || s.content_preview?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || s.media_type === filter || s.verdict === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          Scan History
        </h1>
        <p className="text-text-muted ml-14">All your previous detection results in one place</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input type="text" placeholder="Search by filename or content..." value={search}
              onChange={e => setSearch(e.target.value)} className="input-field pl-9 py-2" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-text-muted flex-shrink-0" />
            {['all', 'image', 'video', 'audio', 'text', 'AI', 'HUMAN'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:border-primary/50'}`}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-muted">{filtered.length} scan{filtered.length !== 1 ? 's' : ''} found</p>
        {filtered.length > 0 && (
          <button className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="card h-20 skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <Clock className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="font-semibold text-text-primary mb-2">No scans found</h3>
          <p className="text-text-muted text-sm">{search || filter !== 'all' ? 'Try adjusting your filters' : 'Start detecting AI content to see your history here'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((scan, i) => {
            const Icon = mediaIcons[scan.media_type as keyof typeof mediaIcons] || FileText
            const color = mediaColors[scan.media_type as keyof typeof mediaColors] || 'text-text-muted bg-surface'
            return (
              <motion.div key={scan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card flex items-center gap-4 py-4 hover:border-primary/30 transition-all group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {scan.file_name || scan.source_url || scan.content_preview?.substring(0, 50) || 'Unknown content'}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-text-muted uppercase">{scan.media_type}</span>
                    {scan.file_size && <span className="text-xs text-text-muted">{formatFileSize(scan.file_size)}</span>}
                    <span className="text-xs text-text-muted">{formatRelativeTime(scan.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {scan.verdict && (
                    <span className={scan.verdict === 'AI' ? 'badge-ai' : scan.verdict === 'HUMAN' ? 'badge-human' : 'badge-uncertain'}>
                      {scan.verdict}
                    </span>
                  )}
                  {scan.confidence_score !== null && (
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-text-primary">{Math.round((scan.confidence_score ?? 0) * ((scan.confidence_score ?? 0) <= 1 ? 100 : 1))}%</p>
                      <p className="text-xs text-text-muted">confidence</p>
                    </div>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteScan(scan.id)} disabled={deleting === scan.id}
                      className="p-1.5 rounded-lg text-text-muted hover:text-rose hover:bg-rose/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
