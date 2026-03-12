'use client'
export const dynamic = 'force-dynamic'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Upload, X, Play, CheckCircle, AlertTriangle, HelpCircle, Loader2, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import { formatFileSize } from '@/lib/utils/helpers'

interface BatchFile { id: string; file: File; status: 'queued' | 'processing' | 'done' | 'error'; verdict?: string; confidence?: number }

export default function BatchPage() {
  const { user: firebaseUser } = useAuth()
  const [files, setFiles] = useState<BatchFile[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const supabase = createClient()

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles = accepted.map(f => ({ id: Math.random().toString(36).slice(2), file: f, status: 'queued' as const }))
    setFiles(prev => [...prev, ...newFiles].slice(0, 20))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'audio/*': [], 'video/*': [], 'text/*': [] },
    maxSize: 50 * 1024 * 1024, multiple: true
  })

  const detectType = (f: File) => f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'audio' : f.type.startsWith('video/') ? 'video' : 'text'

  const runBatch = async () => {
    if (!files.length || running) return
    setRunning(true); setDone(0)
    const user = firebaseUser ? { id: firebaseUser.uid } : null

    for (let i = 0; i < files.length; i++) {
      const bf = files[i]
      setFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'processing' } : f))

      try {
        const mediaType = detectType(bf.file)
        const formData = new FormData()
        formData.append('file', bf.file)
        const endpoint = mediaType === 'text' ? '/api/detect/text' : `/api/detect/${mediaType}`
        let res, data
        if (mediaType === 'text') {
          const text = await bf.file.text()
          res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
        } else {
          res = await fetch(endpoint, { method: 'POST', body: formData })
        }
        data = await res.json()

        if (data.success) {
          setFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'done', verdict: data.data.verdict, confidence: data.data.confidence } : f))
          if (user) {
            await supabase.from('scans').insert({ user_id: user.id, media_type: mediaType, file_name: bf.file.name, file_size: bf.file.size, verdict: data.data.verdict, confidence_score: data.data.confidence, signals: data.data.signals, model_used: data.data.model_used, status: 'complete' })
          }
        } else {
          setFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'error' } : f))
        }
      } catch {
        setFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'error' } : f))
      }
      setDone(i + 1)
      await new Promise(r => setTimeout(r, 300))
    }
    setRunning(false)
  }

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))
  const clear = () => { setFiles([]); setDone(0) }

  const completed = files.filter(f => f.status === 'done').length
  const aiCount = files.filter(f => f.verdict === 'AI').length
  const progress = files.length ? Math.round((done / files.length) * 100) : 0

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text-primary mb-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
            <Layers className="w-6 h-6 text-secondary" />
          </div>
          Batch Processing
        </h1>
        <p className="text-text-muted ml-14">Upload up to 20 files and analyze them all at once</p>
      </div>

      {/* Drop Zone */}
      <div {...getRootProps()} className={`card border-2 border-dashed cursor-pointer transition-all mb-6 py-10 flex flex-col items-center gap-3
        ${isDragActive ? 'border-secondary bg-secondary/5 scale-[1.01]' : 'border-border hover:border-secondary/50'}`}>
        <input {...getInputProps()} />
        <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center">
          <Upload className={`w-8 h-8 ${isDragActive ? 'text-secondary' : 'text-text-muted'}`} />
        </div>
        <p className="font-semibold text-text-primary">{isDragActive ? 'Drop files here' : 'Drop up to 20 files'}</p>
        <p className="text-sm text-text-muted">Images · Audio · Video · Text files</p>
      </div>

      {files.length > 0 && (
        <>
          {/* Progress bar when running */}
          {running && (
            <div className="card mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-text-secondary font-medium">Processing batch...</span>
                <span className="text-text-muted">{done}/{files.length} files</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                  animate={{ width: `${progress}%` }} transition={{ ease: 'easeOut' }} />
              </div>
            </div>
          )}

          {/* Summary when done */}
          {!running && completed > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="card text-center py-4">
                <div className="text-2xl font-black text-text-primary">{completed}</div>
                <div className="text-xs text-text-muted">Completed</div>
              </div>
              <div className="card text-center py-4 border-rose/30 bg-rose/5">
                <div className="text-2xl font-black text-rose">{aiCount}</div>
                <div className="text-xs text-text-muted">AI Detected</div>
              </div>
              <div className="card text-center py-4 border-emerald/30 bg-emerald/5">
                <div className="text-2xl font-black text-emerald">{completed - aiCount}</div>
                <div className="text-xs text-text-muted">Human/Real</div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3 mb-4">
            <button onClick={runBatch} disabled={running || files.every(f => f.status === 'done')}
              className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? `Analyzing ${done}/${files.length}...` : 'Run Batch Detection'}
            </button>
            <button onClick={clear} disabled={running} className="btn-ghost flex items-center gap-2 disabled:opacity-50">
              <X className="w-4 h-4" /> Clear All
            </button>
          </div>

          {/* File list */}
          <div className="space-y-2">
            <AnimatePresence>
              {files.map((bf, i) => (
                <motion.div key={bf.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }} transition={{ delay: i * 0.02 }}
                  className={`card flex items-center gap-3 py-3 px-4 transition-all ${
                    bf.status === 'processing' ? 'border-primary/40 bg-primary/5' :
                    bf.verdict === 'AI' ? 'border-rose/20' :
                    bf.verdict === 'HUMAN' ? 'border-emerald/20' : ''
                  }`}>
                  {/* Status icon */}
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    {bf.status === 'queued' && <div className="w-3 h-3 rounded-full bg-border" />}
                    {bf.status === 'processing' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                    {bf.status === 'done' && bf.verdict === 'AI' && <AlertTriangle className="w-5 h-5 text-rose" />}
                    {bf.status === 'done' && bf.verdict === 'HUMAN' && <CheckCircle className="w-5 h-5 text-emerald" />}
                    {bf.status === 'done' && bf.verdict === 'UNCERTAIN' && <HelpCircle className="w-5 h-5 text-amber" />}
                    {bf.status === 'error' && <X className="w-5 h-5 text-rose" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate font-medium">{bf.file.name}</p>
                    <p className="text-xs text-text-muted">{formatFileSize(bf.file.size)} · {detectType(bf.file)}</p>
                  </div>
                  {bf.status === 'done' && bf.verdict && (
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={bf.verdict === 'AI' ? 'badge-ai' : bf.verdict === 'HUMAN' ? 'badge-human' : 'badge-uncertain'}>
                        {bf.verdict}
                      </span>
                      <span className="text-sm font-bold text-text-muted">{bf.confidence !== undefined ? Math.round(bf.confidence <= 1 ? bf.confidence * 100 : bf.confidence) : 0}%</span>
                    </div>
                  )}
                  {bf.status === 'queued' && (
                    <button onClick={() => removeFile(bf.id)} className="text-text-muted hover:text-rose p-1 rounded hover:bg-rose/10 transition-colors">
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
          <p className="text-text-muted text-sm">Drop files above to start batch analysis</p>
        </div>
      )}
    </div>
  )
}
