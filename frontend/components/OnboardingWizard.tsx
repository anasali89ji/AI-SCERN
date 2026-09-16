'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/components/auth-provider'
import {
  FileType2, Image, Mic, Video, Globe, ChevronRight,
  X, Sparkles, User, Zap, Check, AlertTriangle, LoaderCircle,
} from 'lucide-react'

const STEPS = ['welcome', 'modalities', 'username', 'ready'] as const
type Step = typeof STEPS[number]

const MODALITY_OPTIONS = [
  { id: 'text',  icon: FileType2, label: 'Text',  sub: 'Analyze AI-written articles & essays' },
  { id: 'image', icon: Image,     label: 'Image', sub: 'Spot AI-generated photos & art' },
  { id: 'audio', icon: Mic,       label: 'Audio', sub: 'Identify synthetic voices' },
  { id: 'video', icon: Video,     label: 'Video', sub: 'Find deepfakes in videos' },
  { id: 'url',   icon: Globe,     label: 'Web',   sub: 'Analyze entire websites for AI content' },
]

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error'
type LoadState = 'loading' | 'ready' | 'error'

// Onboarding's single source of truth is `profiles.onboarding_completed`
// (Supabase, admin-side, keyed by the authenticated Clerk user id) — the
// same row /api/profiles/me and /api/profiles/update already read/write.
// This component used to query that table directly from the browser with
// the anon Supabase client, which depends on RLS recognizing a Clerk JWT
// as `auth.uid()` — an assumption that's fragile to verify and easy to
// silently break. Routing through the existing authenticated API avoids
// that entirely and keeps one path for reading/writing onboarding state.
export function OnboardingWizard() {
  const { user } = useAuth()
  const [show, setShow]         = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [step, setStep]         = useState<Step>('welcome')
  const [selected, setSelected] = useState<string[]>([])
  const [username, setUsername] = useState('')
  const [uStatus, setUStatus]   = useState<UsernameStatus>('idle')
  const [suggestions, setSugg]  = useState<string[]>([])
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState(false)

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)
  const abortRef      = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch('/api/profiles/me')
      .then(res => { if (!res.ok) throw new Error('failed'); return res.json() })
      .then(data => {
        if (cancelled) return
        if (!data.onboarding_completed) setShow(true)
        setLoadState('ready')
      })
      .catch(() => { if (!cancelled) setLoadState('error') })
    return () => { cancelled = true }
  }, [user])

  // Race-safe username check: a stale response (e.g. "alice" resolving
  // after "alice1" was already typed) is dropped instead of overwriting
  // the newer result. Each keystroke also aborts the in-flight request
  // for the previous value.
  const checkUsername = useCallback((val: string) => {
    setUsername(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()

    if (!val || val.length < 3) { setUStatus('idle'); return }

    setUStatus('checking')
    const myRequestId = ++requestIdRef.current

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await fetch(`/api/profiles/username?username=${encodeURIComponent(val)}`, { signal: controller.signal })
        const data = await res.json()
        if (requestIdRef.current !== myRequestId) return // a newer keystroke superseded this response
        if (!res.ok) { setUStatus('error'); return }
        setUStatus(data.available ? 'available' : 'taken')
        setSugg(data.suggestions || [])
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        if (requestIdRef.current === myRequestId) setUStatus('error')
      }
    }, 400)
  }, [])

  const next = () => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  const finish = async () => {
    if (!user) return
    setSaving(true)
    setSaveError(false)
    const update: Record<string, unknown> = { onboarding_completed: true, preferred_modalities: selected }
    if (username && uStatus === 'available') update.username = username
    try {
      const res = await fetch('/api/profiles/update', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update),
      })
      if (!res.ok) throw new Error('save failed')
      setShow(false)
    } catch {
      // Do not close on failure — a silently-swallowed error here would
      // let the wizard disappear while onboarding_completed is still
      // false, forcing it to reappear unexpectedly on the next load.
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  if (!user || loadState === 'loading' || loadState === 'error' || !show) return null

  const stepIdx = STEPS.indexOf(step)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-surface-deep/85">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-sm bg-surface-deep border border-white/20 rounded-2xl overflow-hidden"
        >
          {/* Progress dots */}
          <div className="flex justify-center gap-2 pt-6 mb-2">
            {STEPS.map((s, i) => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${i <= stepIdx ? 'bg-accent w-8' : 'bg-white/15 w-4'}`} />
            ))}
          </div>

          <div className="p-6 pt-4">

            {step === 'welcome' && (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-xl mx-auto flex items-center justify-center bg-accent/10 border border-accent/20">
                  <Sparkles className="w-7 h-7 text-accent" />
                </div>
                <h2 className="text-xl font-semibold text-silver-900 tracking-tight">Welcome to Aiscern</h2>
                <p className="text-silver-600 text-sm leading-relaxed">
                  The standard for AI content verification. Let&apos;s get you set up in 30 seconds.
                </p>
                <div className="grid grid-cols-3 gap-2.5 mt-5">
                  {[['Accurate', 'Multi-model'], ['Fast', 'Seconds'], ['Private', 'Not stored']].map(([h, s]) => (
                    <div key={h} className="bg-surface border border-white/15 rounded-lg p-2.5 text-center">
                      <p className="text-xs font-semibold text-silver-900">{h}</p>
                      <p className="text-[10px] text-silver-600 mt-0.5">{s}</p>
                    </div>
                  ))}
                </div>
                <button onClick={next}
                  className="w-full mt-3 py-3 rounded-lg font-semibold text-sm text-surface-deep bg-accent hover:bg-accent-hover transition-colors duration-300 flex items-center justify-center gap-2">
                  Get Started <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {step === 'modalities' && (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-silver-900">What will you analyze?</h2>
                  <p className="text-silver-600 text-xs mt-1">Select all that apply — you can use all of them anytime</p>
                </div>
                <div className="space-y-2">
                  {MODALITY_OPTIONS.map(m => {
                    const Icon = m.icon
                    const active = selected.includes(m.id)
                    return (
                      <button key={m.id}
                        onClick={() => setSelected(s => s.includes(m.id) ? s.filter(x => x !== m.id) : [...s, m.id])}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all duration-300 ${active ? 'border-accent/40 bg-accent/10' : 'border-white/15 bg-surface hover:border-white/25'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-accent/20' : 'bg-white/5'}`}>
                          <Icon className={`w-4 h-4 ${active ? 'text-accent' : 'text-silver-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${active ? 'text-silver-900' : 'text-silver-700'}`}>{m.label}</p>
                          <p className="text-[11px] text-silver-600 truncate">{m.sub}</p>
                        </div>
                        {active && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
                      </button>
                    )
                  })}
                </div>
                <button onClick={next}
                  className="w-full py-3 rounded-lg font-semibold text-sm text-surface-deep bg-accent hover:bg-accent-hover transition-colors duration-300">
                  Continue
                </button>
              </div>
            )}

            {step === 'username' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-11 h-11 rounded-lg mx-auto flex items-center justify-center mb-1 bg-surface border border-white/15">
                    <User className="w-5 h-5 text-accent" />
                  </div>
                  <h2 className="text-lg font-semibold text-silver-900">Choose a username</h2>
                  <p className="text-silver-600 text-xs mt-1">Optional — you can set it later in your profile</p>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-silver-600 text-sm">@</span>
                  <input
                    value={username}
                    onChange={e => checkUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="yourname"
                    maxLength={30}
                    className="w-full bg-surface border border-white/20 rounded-lg pl-8 pr-10 py-3 text-[16px] sm:text-sm text-silver-900 placeholder:text-silver-600 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-300"
                  />
                  {uStatus === 'checking'  && <LoaderCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent animate-spin" />}
                  {uStatus === 'available' && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />}
                  {(uStatus === 'taken' || uStatus === 'error') && <X className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400" />}
                </div>
                {uStatus === 'available' && <p className="text-xs text-accent">@{username} is available!</p>}
                {uStatus === 'error' && <p className="text-xs text-rose-400">Couldn&apos;t check that username — try again, or skip for now.</p>}
                {uStatus === 'taken' && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-rose-400">@{username} is taken. Try one of these:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map(s => (
                        <button key={s} onClick={() => { setUsername(s); setUStatus('available') }}
                          className="px-2.5 py-1 rounded-md border border-accent/25 bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors duration-300">
                          @{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setUsername(''); setUStatus('idle'); next() }}
                    className="flex-1 py-2.5 rounded-lg border border-white/15 text-xs text-silver-600 hover:text-silver-900 hover:border-white/25 font-medium transition-colors duration-300">
                    Skip for now
                  </button>
                  <button onClick={next} disabled={uStatus === 'checking'}
                    className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-surface-deep bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors duration-300">
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 'ready' && (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-xl mx-auto flex items-center justify-center bg-accent/10 border border-accent/20">
                  <Zap className="w-7 h-7 text-accent" />
                </div>
                <h2 className="text-xl font-semibold text-silver-900 tracking-tight">You&apos;re all set!</h2>
                <p className="text-silver-600 text-sm leading-relaxed">
                  Your account is ready. Start with a free scan — no upload required for AI text verification.
                </p>
                <div className="text-left space-y-2">
                  {[
                    ['10 scans/day', 'on your free plan'],
                    ['3 audio + 3 video', 'free trial credits'],
                    ['All results saved', 'in your history'],
                  ].map(([h, s]) => (
                    <div key={h} className="flex items-center gap-3 p-2.5 bg-surface border border-white/15 rounded-lg">
                      <Check className="w-4 h-4 text-accent flex-shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-silver-900">{h} </span>
                        <span className="text-xs text-silver-600">{s}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {saveError && (
                  <div className="flex items-start gap-2 text-left bg-rose-500/5 border border-rose-500/20 rounded-lg px-3 py-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-400 leading-relaxed">
                      Couldn&apos;t save your setup — check your connection and try again.
                    </p>
                  </div>
                )}
                <button onClick={finish} disabled={saving}
                  className="w-full py-3 rounded-lg font-semibold text-sm text-surface-deep bg-accent hover:bg-accent-hover disabled:opacity-70 transition-colors duration-300 flex items-center justify-center gap-2">
                  {saving && <LoaderCircle className="w-4 h-4 animate-spin" />}
                  {saving ? 'Setting up…' : saveError ? 'Retry' : 'Go to Dashboard →'}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
