'use client'
import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Upload, X, Play, Pause, CheckCircle, AlertTriangle, HelpCircle, Loader2, BarChart3, Download, RotateCcw, Clock } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { formatFileSize } from '@/lib/utils/helpers'
import { ReviewSuggestion } from '@/components/ReviewSuggestion'


interface BatchFile {
  id: string; file: File
  status: 'queued' | 'processing' | 'done' | 'error'
  verdict?: string; confidence?: number; processingTime?: number
  error?: string
}

const MAX_FILES = 20
const CONCURRENCY = 5  // 5 parallel workers

function detectType(f: File) {
  if (f.type.startsWith('image/')) return 'image'
  if (f.type.startsWith('audio/')) return 'audio'
  if (f.type.startsWith('video/')) return 'video'
  if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) return 'pdf'
  return 'text'
}

function normalizeConf(c: number | undefined) {
  if (c == null) return 0
  return Math.round(c <= 1 ? c * 100 : c)
}

export default function BatchPage() {
  const { user: currentUser } = useAuth()
  const displayName: string | null =
    currentUser?.displayName?.split(' ')[0] ||
    currentUser?.email?.split('@')[0] ||
    null
  const [files, setFiles] = useState<BatchFile[]>([])
  const [running, setRunning] = useState(false)
  const [correlation, setCorrelation] = useState<{score:number;pattern:string}|null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState<'all' | 'AI' | 'HUMAN' | 'UNCERTAIN' | 'error'>('all')
  const [elapsed, setElapsed] = useState(0)
  const pauseRef = useRef(false)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const completed = files.filter(f => f.status === 'done').length
  const errored   = files.filter(f => f.status === 'error').length
  const aiCount   = files.filter(f => f.verdict === 'AI').length
  const humanCount = files.filter(f => f.verdict === 'HUMAN').length
  const progress  = files.length ? Math.round(((completed + errored) / files.length) * 100) : 0
  const avgConf   = completed > 0
    ? Math.round(files.filter(f => f.status === 'done').reduce((s, f) => s + normalizeConf(f.confidence), 0) / completed)
    : 0

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.file.name + f.file.size))
      const novel = accepted.filter(f => !existing.has(f.name + f.size))
      return [...prev, ...novel.map(f => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file: f, status: 'queued' as const }))]
        .slice(0, MAX_FILES)
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'audio/*': [], 'video/*': [], 'text/plain': ['.txt'], 'application/pdf': ['.pdf'] },
    maxSize: 100 * 1024 * 1024, multiple: true,
    onDropRejected: () => {}
  })

  const processFile = async (bf: BatchFile, uid: string | null): Promise<Partial<BatchFile>> => {
    const start = Date.now()
    try {
      const mediaType = detectType(bf.file)
      let res: Response
      if (mediaType === 'pdf') {
        const formData = new FormData(); formData.append('file', bf.file)
        res = await fetch('/api/detect/pdf', { method: 'POST', body: formData })
      } else if (mediaType === 'text') {
        const text = await bf.file.text()
        if (text.trim().length < 50) return { status: 'error', error: 'Text too short (min 50 chars)' }
        res = await fetch('/api/detect/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      } else {
        const formData = new FormData(); formData.append('file', bf.file)
        res = await fetch(`/api/detect/${mediaType}`, { method: 'POST', body: formData })
      }
      const data = await res.json()
      if (!data.success) return { status: 'error', error: data.error?.message || 'Failed' }

      const processingTime = Date.now() - start
      // PDF API returns { success, data: {...} }; all other APIs return { success, result: {...} }
      const payload = data.data ?? data.result
      return { status: 'done', verdict: payload?.verdict, confidence: payload?.confidence, processingTime }
    } catch (e: any) {
      return { status: 'error', error: e?.message || 'Network error' }
    }
  }

  const runBatch = async () => {
    const queued = files.filter(f => f.status === 'queued')
    if (!queued.length || running) return
    setRunning(true); setPaused(false); pauseRef.current = false
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000)

    const uid = currentUser?.uid || null

    // Process with concurrency limit
    let idx = 0
    const inProgress = new Set<string>()

    const next = async () => {
      while (idx < queued.length) {
        while (pauseRef.current) await new Promise(r => setTimeout(r, 300))
        const bf = queued[idx++]
        inProgress.add(bf.id)
        setFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'processing' } : f))
        const update = await processFile(bf, uid)
        setFiles(prev => prev.map(f => f.id === bf.id ? { ...f, ...update } : f))
        inProgress.delete(bf.id)
      }
    }

    // Spawn CONCURRENCY workers
    await Promise.all(Array.from({ length: CONCURRENCY }, next))

    if (timerRef.current) clearInterval(timerRef.current)

    // Cross-tool correlation pass
    setFiles(prev => {
      const done = prev.filter(f => f.status === 'done')
      const aiFiles = done.filter(f => f.verdict === 'AI')
      const aiRate = done.length > 0 ? aiFiles.length / done.length : 0
      if (done.length >= 3 && aiRate >= 0.6) {
        setCorrelation({ score: Math.round(aiRate * 100), pattern: `${aiFiles.length} of ${done.length} files show consistent AI-generation patterns` })
      } else {
        setCorrelation(null)
      }
      return prev
    })

    setRunning(false); setPaused(false); pauseRef.current = false
  }

  const togglePause = () => {
    const next = !paused; setPaused(next); pauseRef.current = next
  }

  const removeFile = (id: string) => {
    if (running) return
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const clearAll = () => {
    if (running) return
    setFiles([]); setElapsed(0)
  }

  const retryErrors = () => {
    setFiles(prev => prev.map(f => f.status === 'error' ? { ...f, status: 'queued', error: undefined } : f))
  }

  const exportCSV = () => {
    const rows = [
      ['File', 'Size', 'Type', 'Verdict', 'Confidence', 'Time (ms)'],
      ...files.filter(f => f.status === 'done').map(bf => [
        bf.file.name, String(bf.file.size), detectType(bf.file),
        bf.verdict || '', bf.confidence != null ? `${normalizeConf(bf.confidence)}%` : '',
        bf.processingTime ? String(bf.processingTime) : ''
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `aiscern-batch-${Date.now()}.csv`; a.click()
  }

  const filteredFiles = files.filter(bf => {
    if (filter === 'all') return true
    if (filter === 'error') return bf.status === 'error'
    return bf.verdict === filter
  })

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const exportPdfReport = async () => {
    const done = files.filter(f => f.status === 'done')
    if (!done.length) return
    setExportingPdf(true)
    try {
      // Dynamic import to avoid SSR issues
      const jsPDF = (await import('jspdf')).default
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = 210; const pageH = 297; const margin = 20; const col = pageW - margin * 2

      // ── Cover page ───────────────────────────────────────────────────
      doc.setFillColor(10, 10, 20); doc.rect(0, 0, pageW, pageH, 'F')
      doc.setFillColor(60, 20, 100); doc.rect(0, 0, pageW, 60, 'F')
      doc.setFontSize(28); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold')
      doc.text('Aiscern', margin, 35)
      doc.setFontSize(14); doc.setTextColor(180,150,255)
      doc.text('Batch Analysis Report', margin, 47)
      doc.setFontSize(10); doc.setTextColor(160,160,160); doc.setFont('helvetica','normal')
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 75)
      doc.text(`Files analyzed: ${done.length}`, margin, 83)
      doc.text(`Report ID: AISCERN-${Date.now()}`, margin, 91)
      const aiCount = done.filter(f=>f.verdict==='AI').length
      const humanCount = done.filter(f=>f.verdict==='HUMAN').length
      const overallRisk = Math.round((aiCount/done.length)*100)
      doc.setFontSize(11); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold')
      doc.text('Executive Summary', margin, 115)
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(200,200,200)
      const summaryLines = doc.splitTextToSize(`This batch scan analyzed ${done.length} files. ${aiCount} files were flagged as AI-generated (${overallRisk}% risk score). ${humanCount} files appear authentic. Overall risk level: ${overallRisk>=70?'HIGH':overallRisk>=40?'MEDIUM':'LOW'}.`, col)
      doc.text(summaryLines, margin, 125)

      // ── Per-file breakdown ────────────────────────────────────────────
      doc.addPage()
      doc.setFillColor(10,10,20); doc.rect(0,0,pageW,pageH,'F')
      doc.setFontSize(14); doc.setTextColor(180,150,255); doc.setFont('helvetica','bold')
      doc.text('Per-File Analysis', margin, 25)
      let y = 38
      for (const bf of done) {
        if (y > pageH - 40) { doc.addPage(); doc.setFillColor(10,10,20); doc.rect(0,0,pageW,pageH,'F'); y = 25 }
        const conf = normalizeConf(bf.confidence)
        const isAI = bf.verdict==='AI'
        doc.setFillColor(isAI?80:30, isAI?20:70, 30); doc.roundedRect(margin, y-4, col, 18, 2, 2, 'F')
        doc.setFontSize(9); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold')
        doc.text(bf.file.name.slice(0,50), margin+3, y+4)
        doc.setFont('helvetica','normal'); doc.setTextColor(isAI?255:100, isAI?100:220, 100)
        doc.text(`${bf.verdict} — ${conf}%`, margin+3, y+11)
        doc.setTextColor(160,160,160)
        doc.text(`${detectType(bf.file).toUpperCase()} · ${formatFileSize(bf.file.size)}`, col-20, y+4, {align:'right'})
        y += 22
      }

      // ── Footer ────────────────────────────────────────────────────────
      const total = doc.getNumberOfPages()
      for (let i = 1; i <= total; i++) {
        doc.setPage(i)
        doc.setFontSize(8); doc.setTextColor(60,60,80); doc.setFont('helvetica','normal')
        doc.text(`Aiscern · AI Content Detection Platform · Page ${i}/${total}`, pageW/2, pageH-8, {align:'center'})
      }

      doc.save(`aiscern-batch-report-${Date.now()}.pdf`)
    } catch (e) { console.error('PDF export failed', e) }
    setExportingPdf(false)
  }

  return (
    <>
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6 text-secondary" />
          </div>
          Batch Processing
        </h1>
        <p className="text-text-muted ml-14 text-sm">
          Analyze up to {MAX_FILES} files · PDF, images, audio, video, text · {CONCURRENCY} concurrent workers · Correlation detection · PDF export
        </p>
      </div>

      {/* Drop Zone */}
      <div {...getRootProps()} className={`card border-2 border-dashed cursor-pointer transition-all mb-5 py-8 flex flex-col items-center gap-3
        ${isDragActive ? 'border-secondary bg-secondary/5 scale-[1.01]' : 'border-border/60 hover:border-secondary/50'}`}>
        <input {...getInputProps()} />
        <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center">
          <Upload className={`w-7 h-7 ${isDragActive ? 'text-secondary' : 'text-text-muted'}`} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-text-primary">{isDragActive ? 'Drop files here' : `Drop up to ${MAX_FILES} files`}</p>
          <p className="text-sm text-text-muted mt-1">Images · Audio · Video · Text (.txt)</p>
          {files.length > 0 && <p className="text-xs text-text-disabled mt-1">{files.length}/{MAX_FILES} files added</p>}
        </div>
      </div>

      {files.length > 0 && (
        <>
          {/* Progress bar */}
          {(running || completed + errored > 0) && (
            <div className="card mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary font-medium">
                    {running ? (paused ? 'Paused' : 'Processing…') : 'Complete'}
                  </span>
                  <span className="text-text-muted">{completed + errored}/{files.length} files</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  {(running || elapsed > 0) && (
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatElapsed(elapsed)}</span>
                  )}
                  <span className="font-bold text-text-primary">{progress}%</span>
                </div>
              </div>
              <div className="h-2.5 bg-border rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                  animate={{ width: `${progress}%` }} transition={{ ease: 'easeOut' }} />
              </div>
              {completed > 0 && avgConf > 0 && (
                <p className="text-xs text-text-muted mt-2">Average confidence: {avgConf}%</p>
              )}
            </div>
          )}

          {/* Summary stats */}
          {(completed + errored) > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {displayName && completed > 0 && !running && (
                <div className="col-span-2 sm:col-span-4 text-xs text-text-muted mb-1">
                  Hey <span className="text-text-primary font-semibold">{displayName}</span> — batch scan complete.{' '}
                  {aiCount > 0
                    ? <span className="text-rose font-medium">{aiCount} file{aiCount > 1 ? 's' : ''} flagged as AI-generated</span>
                    : <span className="text-emerald font-medium">No AI-generated content detected</span>}
                  {humanCount > 0 && aiCount > 0 && <>, <span className="text-emerald font-medium">{humanCount} authentic</span></>}.
                </div>
              )}
              {[
                { label: 'Completed', value: completed, color: 'text-text-primary' },
                { label: 'AI Detected', value: aiCount, color: 'text-rose' },
                { label: 'Human/Real', value: humanCount, color: 'text-emerald' },
                { label: 'Errors', value: errored, color: errored > 0 ? 'text-amber' : 'text-text-muted' },
              ].map(({ label, value, color }) => (
                <div key={label} className="card text-center py-3">
                  <div className={`text-xl sm:text-2xl font-black ${color}`}>{value}</div>
                  <div className="text-xs text-text-muted mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-2 mb-4">
            {!running ? (
              <button onClick={runBatch}
                disabled={!files.some(f => f.status === 'queued')}
                className="btn-primary flex items-center gap-2 disabled:opacity-50">
                <Play className="w-4 h-4" />
                {files.some(f => f.status === 'queued')
                  ? `Run ${files.filter(f => f.status === 'queued').length} files`
                  : 'All processed'}
              </button>
            ) : (
              <button onClick={togglePause}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${paused ? 'btn-primary' : 'bg-amber/10 text-amber border border-amber/30 hover:bg-amber/20'}`}>
                {paused ? <><Play className="w-4 h-4" />Resume</> : <><Pause className="w-4 h-4" />Pause</>}
              </button>
            )}

            {errored > 0 && !running && (
              <button onClick={retryErrors} className="btn-ghost flex items-center gap-2 text-sm">
                <RotateCcw className="w-4 h-4" />Retry {errored} errors
              </button>
            )}

            <button onClick={clearAll} disabled={running} className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50">
              <X className="w-4 h-4" /> Clear All
            </button>

            {completed > 0 && (
              <div className="flex gap-2 ml-auto">
                <button onClick={exportCSV} className="btn-ghost flex items-center gap-2 text-sm">
                  <Download className="w-4 h-4" /> CSV
                </button>
                <button onClick={exportPdfReport} disabled={exportingPdf} className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50">
                  {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF Report
                </button>
              </div>
            )}
          </div>

          {/* Cross-tool correlation alert */}
          {correlation && (
            <div className="p-4 rounded-xl border border-rose/30 bg-rose/5 flex items-start gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-rose shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose">Correlated AI Pattern Detected</p>
                <p className="text-sm text-text-muted mt-0.5">{correlation.pattern} — {correlation.score}% of this batch is AI-generated</p>
              </div>
            </div>
          )}
          {/* Filter tabs */}
          {completed + errored > 0 && (
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {([
                { key: 'all',       label: 'All',       count: files.length },
                { key: 'AI',        label: 'AI',        count: aiCount },
                { key: 'HUMAN',     label: 'Human',     count: humanCount },
                { key: 'UNCERTAIN', label: 'Uncertain', count: files.filter(f => f.verdict === 'UNCERTAIN').length },
                { key: 'error',     label: 'Errors',    count: errored },
              ] as const).filter(t => t.key === 'all' || t.count > 0).map(t => (
                <button key={t.key} onClick={() => setFilter(t.key)}
                  className={`text-xs py-1.5 px-3 rounded-lg font-medium transition-all flex items-center gap-1.5 ${filter === t.key ? 'bg-primary text-white' : 'btn-ghost'}`}>
                  {t.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === t.key ? 'bg-white/20' : 'bg-surface-active text-text-muted'}`}>{t.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* File list */}
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {filteredFiles.map((bf, i) => (
                <motion.div key={bf.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  className={`card flex items-center gap-3 py-3 px-4 transition-all ${
                    bf.status === 'processing' ? 'border-primary/40 bg-primary/3' :
                    bf.verdict === 'AI' ? 'border-rose/15' :
                    bf.verdict === 'HUMAN' ? 'border-emerald/15' :
                    bf.status === 'error' ? 'border-amber/20 bg-amber/3' : ''
                  }`}>

                  {/* Status icon */}
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    {bf.status === 'queued'     && <div className="w-3 h-3 rounded-full border-2 border-border" />}
                    {bf.status === 'processing' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                    {bf.status === 'done' && bf.verdict === 'AI'        && <AlertTriangle className="w-5 h-5 text-rose" />}
                    {bf.status === 'done' && bf.verdict === 'HUMAN'     && <CheckCircle className="w-5 h-5 text-emerald" />}
                    {bf.status === 'done' && bf.verdict === 'UNCERTAIN' && <HelpCircle className="w-5 h-5 text-amber" />}
                    {bf.status === 'error' && <X className="w-5 h-5 text-amber" />}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate font-medium min-w-0">{bf.file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted">{formatFileSize(bf.file.size)}</span>
                      <span className="text-xs text-text-disabled uppercase">{detectType(bf.file)}</span>
                      {bf.status === 'error' && bf.error && (
                        <span className="text-xs text-amber truncate">{bf.error}</span>
                      )}
                      {bf.processingTime && (
                        <span className="text-xs text-text-disabled">{bf.processingTime}ms</span>
                      )}
                    </div>
                  </div>

                  {/* Result */}
                  {bf.status === 'done' && bf.verdict && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={bf.verdict === 'AI' ? 'badge-ai' : bf.verdict === 'HUMAN' ? 'badge-human' : 'badge-uncertain'}>
                        {bf.verdict}
                      </span>
                      <span className="text-sm font-bold text-text-muted w-10 text-right tabular-nums">{normalizeConf(bf.confidence)}%</span>
                    </div>
                  )}

                  {/* Remove */}
                  {bf.status === 'queued' && (
                    <button onClick={() => removeFile(bf.id)}
                      className="text-text-muted hover:text-rose p-1 rounded hover:bg-rose/10 transition-colors shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {files.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="font-semibold text-text-primary mb-2">No files added yet</h3>
          <p className="text-text-muted text-sm max-w-xs">Drop images, audio, video, or text files above to start batch analysis</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-text-muted w-full max-w-xs">
            {['Up to 20 files', '5 concurrent workers', 'Auto-saves to history', 'CSV + PDF export'].map(f => (
              <div key={f} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-active/50">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary/60 shrink-0" />{f}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    <div className="px-4 sm:px-6 pb-4">
      <ReviewSuggestion toolName="Batch AI Content Analyser" />
    </div>
  </>
  )
}
