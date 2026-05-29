'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Search, Filter, Download, Trash2, Eye, MoreHorizontal,
  ImageIcon, FileText, Music, Video, ChevronLeft, ChevronRight,
  Brain, CheckCircle, AlertTriangle, HelpCircle, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { DetectionBadge } from '@/components/ui/detection-badge'
import { FadeIn } from '@/components/motion/FadeIn'
import { useAuth } from '@/components/auth-provider'

const TYPE_ICONS: Record<string, React.ElementType> = {
  image: ImageIcon, text: FileText, audio: Music, video: Video,
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

const PAGE_SIZE = 10

export default function HistoryPage() {
  const { user } = useAuth()
  const [scans, setScans]           = useState<any[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [searchQuery, setSearch]    = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterResult, setFilterResult] = useState('all')

  const load = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
        sort: 'newest',
      })
      const res = await fetch(`/api/user/scans?${params}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        const rows = Array.isArray(json) ? json : (json.data ?? [])
        setScans(rows)
        setTotal(json.total ?? rows.length)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [user?.uid, page])

  useEffect(() => { load() }, [load])

  const filtered = scans.filter(s => {
    const name = (s.filename || s.file_name || s.id || '').toLowerCase()
    const matchSearch = name.includes(searchQuery.toLowerCase())
    const matchType   = filterType === 'all'   || s.content_type === filterType || s.type === filterType
    const matchResult = filterResult === 'all' || (s.verdict || '').toLowerCase().includes(filterResult)
    return matchSearch && matchType && matchResult
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
              Detection History
            </h1>
            <p className="text-text-muted mt-1 text-sm">
              All your past scans — {total.toLocaleString()} total
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={load}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.05}>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
                <Input
                  placeholder="Search by filename..."
                  value={searchQuery}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex gap-2">
                {/* Type filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 h-9">
                      <Filter className="w-3.5 h-3.5" />
                      {filterType === 'all' ? 'Type' : filterType}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setFilterType('all')}>All Types</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {['image', 'text', 'audio', 'video'].map(t => (
                      <DropdownMenuItem key={t} onClick={() => setFilterType(t)} className="capitalize gap-2">
                        {(() => { const I = TYPE_ICONS[t]; return <I className="w-4 h-4" /> })()}
                        {t}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Result filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 h-9">
                      <Filter className="w-3.5 h-3.5" />
                      {filterResult === 'all' ? 'Result' : filterResult}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setFilterResult('all')}>All Results</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFilterResult('ai')} className="gap-2">
                      <Brain className="w-4 h-4 text-rose-400" /> AI Generated
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterResult('human')} className="gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" /> Human Made
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterResult('uncertain')} className="gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-400" /> Uncertain
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Table */}
      <FadeIn delay={0.1}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Brain className="w-10 h-10 text-text-disabled mb-3" />
                <p className="text-text-secondary font-medium">No scans found</p>
                <p className="text-text-muted text-sm mt-1">
                  {searchQuery || filterType !== 'all' || filterResult !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Run your first detection to see results here'}
                </p>
                {!(searchQuery || filterType !== 'all' || filterResult !== 'all') && (
                  <Button asChild className="mt-4 gap-2 bg-gradient-to-r from-blue-700 to-blue-600 text-white hover:opacity-90" size="sm">
                    <Link href="/detect/image">Start Detecting</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>File / Source</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((scan, i) => {
                      const type = scan.content_type || scan.type || 'text'
                      const Icon = TYPE_ICONS[type] ?? FileText
                      const verdict = mapVerdict(scan.verdict || 'UNCERTAIN')
                      const confidence = scan.confidence
                        ? Math.round(scan.confidence <= 1 ? scan.confidence * 100 : scan.confidence)
                        : undefined
                      const filename = scan.filename || scan.file_name || `Scan #${scan.id?.slice(-6) || i + 1}`
                      return (
                        <motion.tr
                          key={scan.id || i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-surface-active flex items-center justify-center shrink-0">
                                <Icon className="w-4 h-4 text-text-muted" />
                              </div>
                              <span className="capitalize text-xs text-text-muted hidden sm:block">{type}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-text-primary max-w-[200px] truncate">
                            {filename}
                          </TableCell>
                          <TableCell>
                            <DetectionBadge result={verdict} size="sm" />
                          </TableCell>
                          <TableCell>
                            {confidence !== undefined ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-surface-active overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      verdict === 'ai' ? 'bg-rose' : verdict === 'human' ? 'bg-emerald' : 'bg-amber'
                                    }`}
                                    style={{ width: `${confidence}%` }}
                                  />
                                </div>
                                <span className="text-xs text-text-muted">{confidence}%</span>
                              </div>
                            ) : (
                              <span className="text-xs text-text-disabled">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-text-muted whitespace-nowrap">
                            {scan.created_at ? timeAgo(scan.created_at) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild className="gap-2">
                                  <Link href={`/history/${scan.id}`}>
                                    <Eye className="w-4 h-4" />
                                    View Details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 text-rose-400 focus:text-rose-400 focus:bg-rose/10">
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </motion.tr>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {!loading && filtered.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                <p className="text-xs text-text-muted">
                  Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-xs text-text-muted px-1">
                    {page} / {Math.max(1, totalPages)}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
