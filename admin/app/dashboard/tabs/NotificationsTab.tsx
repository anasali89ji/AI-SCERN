'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Bell, Send, RefreshCw, Users, AlertTriangle, Info, Megaphone, Shield } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface Notification {
  id: string; user_id: string | null; title: string; body: string
  type: string; priority: string; read: boolean; created_at: string
  target_audience: string; profiles?: { email: string; display_name: string }
}

const TYPE_ICONS: Record<string, any> = { info: Info, warning: AlertTriangle, announcement: Megaphone, system: Shield, promotion: Megaphone }
const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-text-muted', normal: 'text-blue-400', high: 'text-amber-400', urgent: 'text-rose-400'
}

export default function NotificationsTab() {
  const { data, isLoading, error, mutate } = useSWR<{ notifications: Notification[]; total: number; pages: number }>(
    '/notifications', (p: string) => api(p)
  )
  const [broadcastModal, setBroadcastModal] = useState(false)
  const [broadcastForm, setBroadcastForm] = useState({
    title: '', body: '', type: 'system', priority: 'normal', target_audience: 'all', action_url: ''
  })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)

  const sendBroadcast = async () => {
    setSending(true)
    try {
      const res = await api('/notifications/broadcast', 'POST', broadcastForm)
      setResult(res)
      setBroadcastForm({ title: '', body: '', type: 'system', priority: 'normal', target_audience: 'all', action_url: '' })
      await mutate()
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'error'}`) }
    finally { setSending(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" /> Notifications
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setBroadcastModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all">
            <Send className="w-4 h-4" /> Broadcast
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <ShimmerCard key={i} h="h-16" />)}</div>
      ) : error ? (
        <div className="text-center py-10 text-sm text-rose-400">Failed to load notifications</div>
      ) : (
        <div className="space-y-2">
          {(data?.notifications ?? []).length === 0 && <div className="text-center py-10 text-sm text-text-muted">No notifications</div>}
          {(data?.notifications ?? []).map(n => {
            const Icon = TYPE_ICONS[n.type] || Info
            return (
              <div key={n.id} className={`card flex items-start gap-3 p-3 ${!n.read ? 'border-l-2 border-l-primary' : ''}`}>
                <Icon className={`w-4 h-4 mt-0.5 ${PRIORITY_COLORS[n.priority] || 'text-text-muted'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{n.title}</p>
                  <p className="text-xs text-text-muted line-clamp-1">{n.body}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-text-disabled">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3"/> {n.target_audience}</span>
                    <span>{n.profiles?.email || 'Broadcast'}</span>
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${PRIORITY_COLORS[n.priority] || ''} bg-surface border border-border`}>
                  {n.priority}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={broadcastModal} onClose={() => setBroadcastModal(false)} title="Broadcast Notification" size="lg">
        <div className="space-y-4">
          {result && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              Broadcast sent! {result.sent} delivered, {result.failed} failed.
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Title</label>
            <input value={broadcastForm.title} onChange={e => setBroadcastForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Body</label>
            <textarea rows={3} value={broadcastForm.body} onChange={e => setBroadcastForm(f => ({ ...f, body: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Type</label>
              <select value={broadcastForm.type} onChange={e => setBroadcastForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-secondary outline-none focus:ring-2 focus:ring-primary/50">
                <option value="system">System</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="promotion">Promotion</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Priority</label>
              <select value={broadcastForm.priority} onChange={e => setBroadcastForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-secondary outline-none focus:ring-2 focus:ring-primary/50">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Audience</label>
              <select value={broadcastForm.target_audience} onChange={e => setBroadcastForm(f => ({ ...f, target_audience: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-secondary outline-none focus:ring-2 focus:ring-primary/50">
                <option value="all">All Users</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="team">Team</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <button onClick={sendBroadcast} disabled={sending || !broadcastForm.title || !broadcastForm.body}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all">
            {sending ? 'Broadcasting…' : 'Send Broadcast'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
