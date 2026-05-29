'use client'
import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Shield, Save, Loader2, Trash2, Key, Palette,
  Globe, Download, AlertTriangle, Copy, Check, Lock,
  Moon, Sun, Monitor, Mail, Database,
  RefreshCw, CheckCircle2, Eye, EyeOff, User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { useClerk } from '@clerk/nextjs'
import { ScrollToTop } from '@/components/ScrollToTop'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FadeIn } from '@/components/motion/FadeIn'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Prefs {
  email_notifications: boolean
  scan_complete_email: boolean
  weekly_summary: boolean
  marketing_emails: boolean
  auto_delete_days: number
  default_language: string
}
const defaultPrefs: Prefs = {
  email_notifications: true,
  scan_complete_email: false,
  weekly_summary: true,
  marketing_emails: false,
  auto_delete_days: 90,
  default_language: 'en',
}

// ── Setting Row ────────────────────────────────────────────────────────────────
function SettingRow({
  icon: Icon,
  label,
  description,
  action,
  badge,
}: {
  icon: React.ElementType
  label: string
  description?: string
  action: React.ReactNode
  badge?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-surface-active flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-text-muted" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-text-primary">{label}</p>
            {badge && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {badge}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const { signOut } = useClerk()
  const supabase = createClient()

  const [prefs, setPrefs]       = useState<Prefs>(defaultPrefs)
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [saved, setSaved]       = useState(false)
  const [apiKey, setApiKey]     = useState<string | null>(null)
  const [showKey, setShowKey]   = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [copied, setCopied]     = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [theme, setTheme]       = useState<'dark' | 'light' | 'system'>('dark')

  // Load preferences
  const load = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('users')
        .select('preferences, api_key_preview')
        .eq('id', user.uid)
        .single() as { data: { preferences?: Prefs; api_key_preview?: string } | null; error: unknown }

      if (data?.preferences) {
        setPrefs({ ...defaultPrefs, ...data.preferences })
      }
      if (data?.api_key_preview) {
        setApiKey(data.api_key_preview)
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [user?.uid, supabase])

  useEffect(() => { load() }, [load])

  const toggle = (key: keyof Prefs) => {
    setPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  const handleSave = async () => {
    if (!user?.uid) return
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('users')
        .update({ preferences: prefs })
        .eq('id', user.uid)
      setSaved(true)
      toast.success('Settings saved')
      setTimeout(() => setSaved(false), 3000)
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const generateApiKey = async () => {
    if (!user?.uid) return
    setGenLoading(true)
    try {
      const res = await fetch('/api/user/api-key', { method: 'POST' })
      if (res.ok) {
        const { key } = await res.json()
        setApiKey(key)
        setShowKey(true)
        toast.success('New API key generated')
      } else {
        toast.error('Failed to generate key')
      }
    } catch {
      toast.error('Request failed')
    } finally {
      setGenLoading(false)
    }
  }

  const copyKey = () => {
    if (!apiKey) return
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    try {
      await signOut({ redirectUrl: '/' })
      toast.success('Account deletion initiated')
    } catch {
      toast.error('Failed to delete account')
    }
  }

  return (
    <>
      <ScrollToTop />
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6 pb-20 lg:pb-8">
        {/* Header */}
        <FadeIn>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
              Settings
            </h1>
            <p className="text-text-muted mt-1 text-sm">
              Manage your account preferences and notifications
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Tabs defaultValue="notifications" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-9 mb-6">
              <TabsTrigger value="notifications" className="gap-1.5 text-xs">
                <Bell className="w-3 h-3" />
                <span className="hidden sm:inline">Notifications</span>
                <span className="sm:hidden">Notifs</span>
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-1.5 text-xs">
                <Palette className="w-3 h-3" />
                <span className="hidden sm:inline">Appearance</span>
                <span className="sm:hidden">Theme</span>
              </TabsTrigger>
              <TabsTrigger value="api" className="gap-1.5 text-xs">
                <Key className="w-3 h-3" />
                <span>API</span>
              </TabsTrigger>
              <TabsTrigger value="danger" className="gap-1.5 text-xs">
                <Shield className="w-3 h-3" />
                <span>Security</span>
              </TabsTrigger>
            </TabsList>

            {/* ── Notifications ─────────────────────────────────────────────── */}
            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Email Notifications</CardTitle>
                  <CardDescription>Choose when we contact you</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-white/5">
                  <SettingRow
                    icon={Mail}
                    label="All Email Notifications"
                    description="Master toggle for all email communication"
                    action={
                      <Switch
                        checked={prefs.email_notifications}
                        onCheckedChange={() => toggle('email_notifications')}
                      />
                    }
                  />
                  <SettingRow
                    icon={Bell}
                    label="Scan Complete"
                    description="Notify when a long-running scan finishes"
                    action={
                      <Switch
                        checked={prefs.scan_complete_email}
                        onCheckedChange={() => toggle('scan_complete_email')}
                        disabled={!prefs.email_notifications}
                      />
                    }
                  />
                  <SettingRow
                    icon={Globe}
                    label="Weekly Summary"
                    description="Weekly digest of your detection activity"
                    badge="Pro"
                    action={
                      <Switch
                        checked={prefs.weekly_summary}
                        onCheckedChange={() => toggle('weekly_summary')}
                        disabled={!prefs.email_notifications}
                      />
                    }
                  />
                  <SettingRow
                    icon={Mail}
                    label="Product Updates"
                    description="News about new features and improvements"
                    action={
                      <Switch
                        checked={prefs.marketing_emails}
                        onCheckedChange={() => toggle('marketing_emails')}
                      />
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Data Retention</CardTitle>
                  <CardDescription>Control how long scan history is kept</CardDescription>
                </CardHeader>
                <CardContent>
                  <SettingRow
                    icon={Database}
                    label="Auto-delete scans after"
                    description="Older scans will be automatically removed"
                    action={
                      <select
                        value={prefs.auto_delete_days}
                        onChange={e => setPrefs(p => ({ ...p, auto_delete_days: Number(e.target.value) }))}
                        className="text-sm bg-surface-active border border-white/10 rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value={30}>30 days</option>
                        <option value={60}>60 days</option>
                        <option value={90}>90 days (default)</option>
                        <option value={180}>180 days</option>
                        <option value={365}>1 year</option>
                        <option value={0}>Never</option>
                      </select>
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Appearance ────────────────────────────────────────────────── */}
            <TabsContent value="appearance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Theme</CardTitle>
                  <CardDescription>Choose your preferred display mode</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { value: 'dark',   label: 'Dark',   icon: Moon },
                      { value: 'light',  label: 'Light',  icon: Sun },
                      { value: 'system', label: 'System', icon: Monitor },
                    ] as const).map(t => (
                      <button
                        key={t.value}
                        onClick={() => setTheme(t.value)}
                        className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-150 ${
                          theme === t.value
                            ? 'border-primary bg-primary/10 text-blue-400'
                            : 'border-white/8 bg-surface-active text-text-muted hover:border-white/20 hover:text-text-secondary'
                        }`}
                      >
                        <t.icon className="w-6 h-6" />
                        <span className="text-sm font-medium">{t.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-text-disabled mt-4">
                    Full light mode coming soon. Dark mode is the current default.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── API ───────────────────────────────────────────────────────── */}
            <TabsContent value="api" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">API Access</CardTitle>
                  <CardDescription>
                    Integrate Aiscern detection into your own apps
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {apiKey ? (
                    <div className="space-y-2">
                      <Label className="text-xs text-text-muted">Your API Key</Label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-surface-active border border-white/10 rounded-lg px-3 py-2 font-mono text-sm text-text-secondary">
                          <span className="flex-1 truncate">
                            {showKey ? apiKey : '•'.repeat(32)}
                          </span>
                          <button
                            onClick={() => setShowKey(s => !s)}
                            className="text-text-disabled hover:text-text-muted transition-colors shrink-0"
                          >
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={copyKey}
                        >
                          {copied
                            ? <Check className="w-4 h-4 text-emerald-400" />
                            : <Copy className="w-4 h-4" />
                          }
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
                      <Key className="w-8 h-8 text-text-disabled mx-auto mb-3" />
                      <p className="text-sm text-text-muted mb-4">
                        No API key generated yet
                      </p>
                      <Button
                        onClick={generateApiKey}
                        disabled={genLoading}
                        className="gap-2"
                        size="sm"
                      >
                        {genLoading
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Key className="w-4 h-4" />
                        }
                        Generate API Key
                      </Button>
                    </div>
                  )}

                  {apiKey && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={generateApiKey}
                        disabled={genLoading}
                      >
                        {genLoading
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />
                        }
                        Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        asChild
                      >
                        <a href="/docs/api" target="_blank" rel="noopener noreferrer">
                          <Globe className="w-3.5 h-3.5" />
                          API Docs
                        </a>
                      </Button>
                    </div>
                  )}

                  <Alert variant="warning">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription className="text-xs">
                      Keep your API key secret. Regenerating will invalidate the current key immediately.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Security / Danger ─────────────────────────────────────────── */}
            <TabsContent value="danger" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Account Security</CardTitle>
                  <CardDescription>Manage your account and data</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-white/5">
                  <SettingRow
                    icon={Download}
                    label="Export your data"
                    description="Download all your scan history as a CSV file"
                    action={
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="w-3.5 h-3.5" />
                        Export
                      </Button>
                    }
                  />
                  <SettingRow
                    icon={Lock}
                    label="Change password"
                    description="Update via your Clerk account settings"
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        asChild
                      >
                        <a href="https://accounts.aiscern.com/user" target="_blank" rel="noopener noreferrer">
                          <Lock className="w-3.5 h-3.5" />
                          Manage
                        </a>
                      </Button>
                    }
                  />
                </CardContent>
              </Card>

              <Card className="border-rose/20">
                <CardHeader>
                  <CardTitle className="text-base text-rose-400">Danger Zone</CardTitle>
                  <CardDescription>Irreversible actions — proceed with care</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-rose/20 bg-rose/5">
                    <div className="flex items-start gap-3">
                      <Trash2 className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">Delete Account</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          Permanently delete your account and all associated data. This cannot be undone.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="shrink-0 gap-2"
                      onClick={handleDeleteAccount}
                    >
                      {deleteConfirm ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Confirm
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </>
                      )}
                    </Button>
                  </div>
                  {deleteConfirm && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Alert variant="destructive">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription className="text-xs">
                          Click <strong>Confirm</strong> again to permanently delete your account.
                          You will be signed out immediately.
                        </AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </FadeIn>

        {/* Save button — always visible */}
        <FadeIn delay={0.1}>
          <div className="flex items-center justify-end gap-3 pt-2">
            <AnimatePresence>
              {saved && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 text-emerald-400 text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Saved
                </motion.div>
              )}
            </AnimatePresence>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="gap-2 min-w-[120px]"
            >
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Save className="w-4 h-4" />
              }
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </FadeIn>
      </div>
    </>
  )
}
