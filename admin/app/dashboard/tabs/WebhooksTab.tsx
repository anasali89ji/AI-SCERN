'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Webhook, Plus, RefreshCw, Trash2, Copy, Check } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface WebhookConfig {
  id: string; url: string; events: string[]; active: boolean
  description: string; secret: string; created_at: string
}

const EVENT_OPTIONS = ['user.signup', 'user.banned', 'scan.completed', 'payment.succeeded', 'payment.failed', 'ticket.created', 'announcement.published']

export default function WebhooksTab() {
  const { data, isLoading, error, mutate } = useSWR<WebhookConfig[]>('/webhooks', (p: string) => api<WebhookConfig[]>(p))
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ url: '', events: [] as string[], description: '', active: true })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')

  const create = async () => {
    setSaving(true)
    try {
      await api('/webhooks', 'POST', form)
      await mutate(); setModal(false)
      setForm({ url: '', events: [], description: '', active: true })
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
    finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this webhook?')) return
    try { await api(`/webhooks/${id}`, 'DELETE'); await mutate() }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
  }

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret)
    setCopied(secret)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Webhook className="w-5 h-5 text-primary" /> Webhooks
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <ShimmerCard key={i} h="h-24" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load webhooks</div>
      ) : (
        <div className="space-y-3">
          {(data ?? []).length === 0 && <div className="text-center py-10 text-sm text-text-muted">No webhooks configured</div>}
          {(data ?? []).map(wh => (
            <div key={wh.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${wh.active ? 'bg-emerald-400' : 'bg-text-disabled'}`} />
                  <p className="text-sm font-semibold text-text-primary">{wh.description || wh.url}</p>
                </div>
                <button onClick={() => remove(wh.id)} className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-400/10">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-primary mb-2 break-all">{wh.url}</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {wh.events.map(e => (
                  <span key={e} className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-surface border border-border text-text-muted">{e}</span>
                ))}
              </div>
              {wh.secret && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-border">
                  <span className="text-[10px] text-text-disabled font-mono">{wh.secret.slice(0, 20)}...</span>
                  <button onClick={() => copySecret(wh.secret)} className="p-1 rounded text-text-muted hover:text-primary">
                    {copied === wh.secret ? <Check className="w-3 h-3 text-emerald-400"/> : <Copy className="w-3 h-3"/>}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Webhook" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">URL</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Events</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_OPTIONS.map(e => (
                <label key={e} className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer border transition-all ${form.events.includes(e) ? 'bg-primary text-white border-primary' : 'bg-surface text-text-muted border-border hover:text-text-primary'}`}>
                  <input type="checkbox" className="hidden" checked={form.events.includes(e)} onChange={() => setForm(f => ({ ...f, events: f.events.includes(e) ? f.events.filter(x => x !== e) : [...f.events, e] }))} />
                  {e}
                </label>
              ))}
            </div>
          </div>
          <button onClick={create} disabled={saving || !form.url || form.events.length === 0}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all">
            {saving ? 'Creating…' : 'Create Webhook'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
