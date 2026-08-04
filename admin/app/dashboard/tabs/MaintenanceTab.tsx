'use client'
import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { 
  Wrench, RefreshCw, Save, Power, Shield, Clock, 
  AlertTriangle, CheckCircle2, XCircle, Eye, EyeOff, Copy, Check
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { ShimmerCard } from '../components/ShimmerBlock'

interface MaintenanceSettings {
  enabled: boolean
  message: string
  estimated_duration: string
  allowed_ips: string[]
}

export default function MaintenanceTab() {
  const { data, isLoading, error, mutate } = useSWR<MaintenanceSettings>('/maintenance', (p: string) => api<MaintenanceSettings>(p))
  const [form, setForm] = useState<MaintenanceSettings>({ 
    enabled: false, 
    message: '', 
    allowed_ips: [], 
    estimated_duration: '' 
  })
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [confirmEnable, setConfirmEnable] = useState(false)
  const [copied, setCopied] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  useEffect(() => {
    if (data) {
      setForm({
        enabled: data.enabled ?? false,
        message: data.message ?? '',
        estimated_duration: data.estimated_duration ?? '',
        allowed_ips: data.allowed_ips ?? [],
      })
    }
  }, [data])

  const enabled = form.enabled

  const save = async () => {
    if (enabled && !confirmEnable) {
      setConfirmEnable(true)
      return
    }
    setConfirmEnable(false)
    setSaving(true)
    try {
      await api('/maintenance', 'PATCH', form)
      await mutate()
      setLastSaved(new Date().toLocaleTimeString())
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : 'error'}`)
    } finally {
      setSaving(false)
    }
  }

  const copyAllowedIPs = () => {
    navigator.clipboard.writeText(form.allowed_ips.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getClientIP = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json')
      const { ip } = await res.json()
      if (ip && !form.allowed_ips.includes(ip)) {
        setForm(f => ({ ...f, allowed_ips: [...f.allowed_ips, ip] }))
      }
    } catch {
      alert('Could not fetch your IP. Please enter it manually.')
    }
  }

  if (error) return (
    <div className="text-center py-10 text-sm text-rose-400">
      <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-70" />
      Failed to load maintenance settings
    </div>
  )

  if (isLoading) return (
    <div className="space-y-3">{Array(4).fill(0).map((_, i) => <ShimmerCard key={i} />)}</div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? 'bg-rose-500/20' : 'bg-emerald-500/20'}`}>
            <Wrench className={`w-5 h-5 ${enabled ? 'text-rose-400' : 'text-emerald-400'}`} />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary">Maintenance Mode</h2>
            <p className="text-xs text-text-muted">
              {enabled 
                ? 'Site is currently in maintenance mode' 
                : 'Site is live and accessible to all users'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => mutate()} 
            className="p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setShowPreview(!showPreview)} 
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary text-xs font-medium transition-colors"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? 'Hide Preview' : 'Preview'}
          </button>
          <button 
            onClick={save} 
            disabled={saving} 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all ${
              enabled && !confirmEnable 
                ? 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400' 
                : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400'
            }`}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : confirmEnable ? 'Confirm Enable' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className={`rounded-xl border p-4 flex items-center gap-3 ${
        enabled 
          ? 'bg-rose-500/5 border-rose-500/20' 
          : 'bg-emerald-500/5 border-emerald-500/20'
      }`}>
        {enabled ? (
          <>
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-400">Maintenance Mode is ACTIVE</p>
              <p className="text-xs text-text-muted">
                Only allowed IPs can access the site. All other visitors will see the maintenance page.
              </p>
            </div>
            <XCircle className="w-5 h-5 text-rose-400/50" />
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-400">Site is Live</p>
              <p className="text-xs text-text-muted">
                All users can access the site normally. Toggle below to enable maintenance mode.
              </p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400/50" />
          </>
        )}
      </div>

      {confirmEnable && (
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Are you sure?</p>
              <p className="text-xs text-text-muted mt-1">
                Enabling maintenance mode will block all users except those with allowed IPs. 
                Make sure your IP is in the allowed list or you will lock yourself out.
              </p>
            </div>
          </div>
          <div className="flex gap-2 pl-8">
            <button 
              onClick={() => setConfirmEnable(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={save}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600 text-white hover:bg-rose-500 transition-colors"
            >
              Yes, Enable Maintenance
            </button>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-surface px-4 py-2 border-b border-border flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-medium text-text-muted">User Preview</span>
          </div>
          <div className="bg-[#0a0a12] p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto">
              <Wrench className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white">Under Maintenance</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto">{form.message || 'We are currently performing scheduled maintenance.'}</p>
            {form.estimated_duration && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-blue-400 font-medium">Estimated: {form.estimated_duration}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card p-6 space-y-6">
        <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${enabled ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`}>
              <Power className={`w-4 h-4 ${enabled ? 'text-rose-400' : 'text-emerald-400'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Maintenance Mode</p>
              <p className="text-xs text-text-muted">When enabled, only allowed IPs can access the site</p>
            </div>
          </div>
          <button 
            onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))} 
            className={`relative flex-shrink-0 rounded-full transition-colors duration-200 ${enabled ? 'bg-rose-600' : 'bg-surface border border-border'}`} 
            style={{ width: 48, height: 26 }}
          >
            <span 
              className="absolute top-[3px] left-[3px] w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm" 
              style={{ transform: enabled ? 'translateX(22px)' : 'none' }} 
            />
          </button>
        </div>

        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">
            Maintenance Message
          </label>
          <textarea 
            rows={3} 
            value={form.message} 
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))} 
            placeholder="Enter the message users will see during maintenance..."
            className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50 resize-none placeholder:text-text-muted/50"
          />
          <p className="text-xs text-text-muted mt-1">{form.message.length}/500 characters</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">
            Estimated Duration
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input 
              value={form.estimated_duration} 
              onChange={e => setForm(f => ({ ...f, estimated_duration: e.target.value }))} 
              placeholder="e.g. 2 hours, 30 minutes" 
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-text-muted/50"
            />
          </div>
          <p className="text-xs text-text-muted mt-1">Shown to users so they know when to check back</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-text-primary">
              Allowed IPs
            </label>
            <div className="flex items-center gap-2">
              <button 
                onClick={getClientIP}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                + Add My IP
              </button>
              <span className="text-border">|</span>
              <button 
                onClick={copyAllowedIPs}
                className="text-xs text-text-muted hover:text-text-primary font-medium transition-colors flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <textarea 
            rows={4} 
            value={form.allowed_ips.join('\n')} 
            onChange={e => setForm(f => ({ 
              ...f, 
              allowed_ips: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) 
            }))} 
            placeholder={`127.0.0.1\n192.168.1.1\n10.0.0.1\n...`}
            className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface border border-border text-text-primary outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono placeholder:text-text-muted/50"
          />
          <div className="flex items-center gap-2 mt-1.5">
            <Shield className="w-3 h-3 text-text-muted" />
            <p className="text-xs text-text-muted">
              Only these IPs can access the site during maintenance. Leave empty to block everyone.
            </p>
          </div>
        </div>
      </div>

      {lastSaved && (
        <div className="flex items-center justify-center gap-2 text-xs text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Last saved at {lastSaved}
        </div>
      )}
    </div>
  )
}
