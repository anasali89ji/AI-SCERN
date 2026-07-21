'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Database, Download, RefreshCw, Plus, CheckCircle } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface Backup {
  id: string; name: string; tables: string[]; total_rows: number
  created_at: string; created_by: string
}

export default function BackupTab() {
  const { data, isLoading, error, mutate } = useSWR<{ backups: Backup[] }>('/backup', (p: string) => api(p))
  const [modal, setModal] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const createBackup = async () => {
    setCreating(true)
    try {
      await api('/backup', 'POST', { name: name || undefined })
      await mutate(); setModal(false); setName('')
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
    finally { setCreating(false) }
  }

  const downloadBackup = (backup: Backup) => {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup_${backup.id}_${new Date().toISOString().slice(0,10)}.json`
    a.click()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" /> Backup & Restore
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all">
            <Plus className="w-4 h-4" /> Backup Now
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <ShimmerCard key={i} h="h-20" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load backups</div>
      ) : (
        <div className="space-y-3">
          {(data?.backups ?? []).length === 0 && <div className="text-center py-10 text-sm text-text-muted">No backups yet</div>}
          {(data?.backups ?? []).map(b => (
            <div key={b.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm font-semibold text-text-primary">{b.name}</p>
                </div>
                <button onClick={() => downloadBackup(b)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-text-muted">
                <span>{b.total_rows.toLocaleString()} rows</span>
                <span>{b.tables.length} tables</span>
                <span>{new Date(b.created_at).toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {b.tables.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-surface border border-border text-text-muted">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Create Backup" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Backup Name (optional)</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Manual backup"
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <button onClick={createBackup} disabled={creating}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all">
            {creating ? 'Creating…' : 'Create Backup'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
