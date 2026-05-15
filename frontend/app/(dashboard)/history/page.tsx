'use client'
import { ScrollToTop } from '@/components/ScrollToTop'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Search, Filter, Download, Trash2, Eye, Image as ImgIcon, Video, Mic, FileText, Globe, RefreshCw, X, ChevronDown } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import type { Scan } from '@/types'
import { formatRelativeTime, formatFileSize } from '@/lib/utils/helpers'

// ── FIX B.5: Swipe-to-delete row wrapper (mobile only) ──────────────────────
// On touch devices, swipe left > 72px reveals a full-height delete button.
// On desktop, the existing hover-reveal Trash2 button is used instead.
function SwipeToDeleteRow({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const startX  = useRef(0)
  const offsetX = useRef(0)
  const rowRef  = useRef<HTMLDivElement>(null)
  const [swiped, setSwiped] = useState(false)

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    offsetX.current = 0
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current
    if (dx > 0) return   // ignore rightward swipe
    offsetX.current = Math.max(dx, -100)
    if (rowRef.current) rowRef.current.style.transform = `translateX(${offsetX.current}px)`
  }
  const onTouchEnd = () => {
    const committed = offsetX.current < -60
    if (rowRef.current) {
      rowRef.current.style.transition = 'transform 0.2s ease'
      rowRef.current.style.transform  = committed ? 'translateX(-80px)' : 'translateX(0)'
    }
    setSwiped(committed)
    setTimeout(() => { if (rowRef.current) rowRef.current.style.transition = '' }, 200)
  }
  const reset = () => {
    setSwiped(false)
    if (rowRef.current) { rowRef.current.style.transition = 'transform 0.2s ease'; rowRef.current.style.transform = 'translateX(0)' }
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete reveal — shown when swiped */}
      {swiped && (
        <div className="absolute right-0 top-0 h-full flex">
          <button onClick={reset} className="px-3 bg-surface-active text-text-muted text-xs">Cancel</button>
          <button onClick={onDelete} className="px-4 bg-rose text-white font-bold flex items-center gap-1.5 text-sm">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
      {/* Row content */}
      <div ref={rowRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {children}
      </div>
    </div>
  )
}

const mediaIcons = { image: ImgIcon, video: Video, audio: Mic, text: FileText, url: Globe }
const mediaColors = {
  image: 'text-primary bg-primary/10',
  video: 'text-secondary bg-secondary/10',
  audio: 'text-cyan bg-cyan/10',
  text:  'text-amber bg-amber/10',
  url:   'text-emerald bg-emerald/10',
}

function normalizeConf(c: number | null) {
  if (c == null) return null
  return Math.round(c <= 1 ? c * 100 : c)
}

function ScanDetailModal({ scan, onClose }: { scan: Scan; onClose: () => void }) {
  const conf = normalizeConf(scan.confidence_score)
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'tween', duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="card w-full max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-text-primary">Scan Details</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-active text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Type</span>
            <span className="text-text-primary font-medium capitalize">{scan.media_type}</span>
          </div>
          {scan.file_name && (
            <div className="flex justify-between gap-4">
              <span className="text-text-muted shrink-0">File</span>
              <span className="text-text-primary font-medium text-right truncate">{scan.file_name}</span>
            </div>
          )}
          {scan.file_size && (
            <div className="flex justify-between">
              <span className="text-text-muted">Size</span>
              <span className="text-text-primary">{formatFileSize(scan.file_size)}</span>
            </div>
          )}
          {scan.content_preview && (
            <div>
              <span className="text-text-muted block mb-1">Content preview</span>
              <p className="text-text-secondary text-xs leading-relaxed p-2 bg-surface-active rounded-lg line-clamp-3">
                {scan.content_preview}
              </p>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-text-muted">Verdict</span>
            <span className={scan.verdict === 'AI' ? 'badge-ai' : scan.verdict === 'HUMAN' ? 'badge-human' : 'badge-uncertain'}>
              {scan.verdict}
            </span>
          </div>
          {conf != null && (
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-text-muted">Confidence</span>
                <span className="font-bold text-text-primary">{conf}%</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all" style={{ width: `${Math.max(0, Math.min(100, conf ?? 0))}%` }} />
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-text-muted">Analyzed</span>
            <span className="text-text-secondary">{new Date(scan.created_at).toLocaleString()}</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function HistoryPage() {
  const { user: currentUser } = useAuth()
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [mediaFilter, setMediaFilter] = useState<string>('all')
  const [verdictFilter, setVerdictFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'confidence'>('newest')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const loadScans = useCallback(async (showRefresh = false) => {
    if (!currentUser?.uid) { setLoading(false); return }
    if (showRefresh) setRefreshing(true)

    try {
      const res = await fetch('/api/user/scans?limit=200')
      if (res.ok) {
        const { data } = await res.json()
        if (data) setScans(data as any)
      }
    } catch { /* silent */ }
    setLoading(false)
    setRefreshing(false)
  }, [currentUser?.uid])

  useEffect(() => {
    loadScans()
    const onVisible  = () => { if (document.visibilityState === 'visible') loadScans() }
    const onFocus    = () => loadScans()
    const onScanSaved = () => loadScans()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('aiscern:scan-saved', onScanSaved)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('aiscern:scan-saved', onScanSaved)
    }
  }, [loadScans])

  async function deleteScan(id: string) {
    setDeleting(id)
    await fetch(`/api/user/scans?id=${id}`, { method: 'DELETE' })
    setScans(prev => prev.filter(s => s.id !== id))
    setDeleting(null)
  }

  async function deleteAll() {
    if (!confirm(`Delete all ${scans.length} scans? This cannot be undone.`)) return
    await fetch('/api/user/scans', { method: 'DELETE' })
    setScans([])
  }

  const exportCSV = () => {
    const rows = [['File/Content', 'Type', 'Verdict', 'Confidence', 'Model', 'Date'],
      ...filtered.map(s => [
        s.file_name || s.source_url || (s.content_preview?.substring(0, 60) || ''),
        s.media_type,
        s.verdict || '',
        normalizeConf(s.confidence_score) != null ? `${normalizeConf(s.confidence_score)}%` : '',
        s.model_used || '',
        new Date(s.created_at).toLocaleString(),
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `aiscern-history-${Date.now()}.csv`; a.click()
  }

  let filtered = scans.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.file_name?.toLowerCase().includes(q) ||
      s.content_preview?.toLowerCase().includes(q) ||
      s.source_url?.toLowerCase().includes(q)
    const matchMedia   = mediaFilter === 'all' || s.media_type === mediaFilter
    const matchVerdict = verdictFilter === 'all' || s.verdict === verdictFilter
    return matchSearch && matchMedia && matchVerdict
  })

  // Sort
  if (sortBy === 'oldest') filtered = [...filtered].reverse()
  else if (sortBy === 'confidence') filtered = [...filtered].sort((a, b) => (normalizeConf(b.confidence_score) ?? 0) - (normalizeConf(a.confidence_score) ?? 0))

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = filtered.length > paginated.length

  return (
    <>
      {selectedScan && <ScanDetailModal scan={selectedScan} onClose={() => setSelectedScan(null)} />}

      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              Scan History
            </h1>
            <p className="text-text-muted ml-14 text-sm">
              {scans.length > 0 ? `${scans.length} total scans` : 'All your previous detection results'}
            </p>
          </div>
          <button onClick={() => loadScans(true)} disabled={refreshing}
            className="btn-ghost p-2 shrink-0" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filters */}
        <div className="card mb-5 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input type="text" placeholder="Search by filename or content…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="input-field pl-9 py-2" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Media type filter */}
            <div className="flex items-center gap-1 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-text-muted shrink-0" />
              {['all', 'image', 'video', 'audio', 'text'].map(f => (
                <button key={f} onClick={() => { setMediaFilter(f); setPage(1) }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize ${mediaFilter === f ? 'bg-primary text-white' : 'bg-surface border border-border/55 text-text-muted hover:border-primary/50'}`}>
                  {f}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-border hidden sm:block mx-1" />

            {/* Verdict filter */}
            <div className="flex items-center gap-1 flex-wrap">
              {['all', 'AI', 'HUMAN', 'UNCERTAIN'].map(f => (
                <button key={f} onClick={() => { setVerdictFilter(f); setPage(1) }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${verdictFilter === f ? 'bg-primary text-white' : 'bg-surface border border-border/55 text-text-muted hover:border-primary/50'}`}>
                  {f}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="ml-auto">
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                className="text-xs bg-surface border border-border/55 rounded-lg px-2.5 py-1.5 text-text-muted focus:outline-none focus:border-primary/50">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="confidence">By confidence</option>
              </select>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-text-muted">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            {(search || mediaFilter !== 'all' || verdictFilter !== 'all') && (
              <button onClick={() => { setSearch(''); setMediaFilter('all'); setVerdictFilter('all') }}
                className="ml-2 text-primary hover:underline text-xs">Clear filters</button>
            )}
          </p>
          <div className="flex gap-2">
            {filtered.length > 0 && (
              <button onClick={exportCSV} className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
            {scans.length > 0 && (
              <button onClick={deleteAll} className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5 text-text-muted hover:text-rose hover:border-rose/30">
                <Trash2 className="w-3.5 h-3.5" /> Clear All
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-surface-active" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-20 text-center">
            <Clock className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="font-semibold text-text-primary mb-2">No scans found</h3>
            <p className="text-text-muted text-sm">
              {search || mediaFilter !== 'all' || verdictFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start detecting AI content to see your history here'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {paginated.map((scan, i) => {
                  const Icon = mediaIcons[scan.media_type as keyof typeof mediaIcons] || FileText
                  const color = mediaColors[scan.media_type as keyof typeof mediaColors] || 'text-text-muted bg-surface'
                  const conf = normalizeConf(scan.confidence_score)
                  return (
                    <SwipeToDeleteRow key={scan.id} onDelete={() => deleteScan(scan.id)}>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ delay: Math.min(i * 0.02, 0.15), ease: 'easeOut' }}
                      className="card flex items-center gap-3 sm:gap-4 py-3.5 hover:border-primary/25 transition-all group cursor-pointer"
                      onClick={() => setSelectedScan(scan)}>

                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {scan.file_name || scan.source_url || (scan.content_preview?.substring(0, 60)) || 'Unknown content'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-text-muted uppercase">{scan.media_type}</span>
                          {scan.file_size && <span className="text-xs text-text-muted">{formatFileSize(scan.file_size)}</span>}
                          <span className="text-xs text-text-disabled">{formatRelativeTime(scan.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {scan.verdict && (
                          <span className={scan.verdict === 'AI' ? 'badge-ai' : scan.verdict === 'HUMAN' ? 'badge-human' : 'badge-uncertain'}>
                            {scan.verdict}
                          </span>
                        )}
                        {conf != null && (
                          <div className="text-right hidden sm:block w-12">
                            <p className="text-sm font-bold text-text-primary tabular-nums">{conf}%</p>
                            <div className="h-1 bg-border rounded-full overflow-hidden mt-0.5">
                              <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                                style={{ width: `${Math.max(0, Math.min(100, conf ?? 0))}%` }} />
                            </div>
                          </div>
                        )}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setSelectedScan(scan)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteScan(scan.id)} disabled={deleting === scan.id}
                            className="p-1.5 rounded-lg text-text-muted hover:text-rose hover:bg-rose/10 transition-colors disabled:opacity-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                    </SwipeToDeleteRow>
                  )
                })}
              </AnimatePresence>
            </div>

            {hasMore && (
              <button onClick={() => setPage(p => p + 1)}
                className="w-full mt-4 btn-ghost py-3 flex items-center justify-center gap-2 text-sm">
                <ChevronDown className="w-4 h-4" />
                Load more ({filtered.length - paginated.length} remaining)
              </button>
            )}
          </>
        )}
            <ScrollToTop />
    </div>
    </>
  )
}
