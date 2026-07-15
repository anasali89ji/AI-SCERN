'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/components/auth-provider'
import { isOrganizationEmail, ORG_TYPES, ORG_TYPE_LABELS, type OrgType } from '@/lib/auth/organizationEmail'
import {
  FileText, Image, Mic, Video, Globe, ChevronRight, ChevronLeft,
  X, Sparkles, User, Zap, Check, AlertTriangle, Loader2,
  Building2, UserRound, Briefcase, GraduationCap, Users,
} from 'lucide-react'

type AccountType = 'individual' | 'organization'

const BASE_STEPS = ['welcome', 'accountType', 'modalities', 'username', 'ready'] as const
type Step = typeof BASE_STEPS[number] | 'orgDetails'

const MODALITY_OPTIONS = [
  { id: 'text',  icon: FileText, label: 'Text',  sub: 'Detect AI-written articles & essays' },
  { id: 'image', icon: Image,    label: 'Image', sub: 'Spot AI-generated photos & art' },
  { id: 'audio', icon: Mic,      label: 'Audio', sub: 'Identify synthetic voices' },
  { id: 'video', icon: Video,    label: 'Video', sub: 'Find deepfakes in videos' },
  { id: 'url',   icon: Globe,    label: 'Web',   sub: 'Analyze entire websites for AI content' },
]

const ORG_TYPE_ICONS: Record<OrgType, typeof Building2> = {
  corporate: Briefcase,
  hr:        Users,
  education: GraduationCap,
}

const ORG_TYPE_SUB: Record<OrgType, string> = {
  corporate: 'Business, agency, or company team',
  hr:        'Recruiting or hiring team screening candidates',
  education: 'School, university, or academic institution',
}

export function OnboardingWizard() {
  const { user }                 = useAuth()
  const [show, setShow]          = useState(false)
  const [step, setStep]          = useState<Step>('welcome')

  // Account type state
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [orgType, setOrgType]         = useState<OrgType | null>(null)
  const [orgName, setOrgName]         = useState('')
  const [jobTitle, setJobTitle]       = useState('')
  const [orgEmailBlocked, setOrgEmailBlocked] = useState(false)

  const [selected, setSelected]  = useState<string[]>([])
  const [username, setUsername]  = useState('')
  const [uStatus, setUStatus]    = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [suggestions, setSugg]   = useState<string[]>([])
  const [saving, setSaving]      = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const debounceRef              = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialogRef                = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    fetch('/api/profiles/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data && !data.onboarding_completed) setShow(true) })
      .catch(() => {})
  }, [user])

  // Clear any pending username-check timer on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  // Focus the dialog when it opens, for keyboard/screen-reader users
  useEffect(() => {
    if (show) dialogRef.current?.focus()
  }, [show])

  const checkUsername = (val: string) => {
    setUsername(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val || val.length < 3) { setUStatus('idle'); return }
    setUStatus('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/profiles/username?username=${encodeURIComponent(val)}`)
        const data = await res.json()
        setUStatus(data.available ? 'available' : 'taken')
        setSugg(data.suggestions || [])
      } catch {
        setUStatus('idle')
      }
    }, 400)
  }

  // The actual step sequence depends on whether an organization was chosen —
  // computed fresh each render rather than mutated, so back/forward never
  // desyncs from the current selection.
  const steps: Step[] = useMemo(() => {
    if (accountType === 'organization') {
      return ['welcome', 'accountType', 'orgDetails', 'modalities', 'username', 'ready']
    }
    return ['welcome', 'accountType', 'modalities', 'username', 'ready']
  }, [accountType])

  const stepIdx = steps.indexOf(step)
  const next = () => { if (stepIdx < steps.length - 1) setStep(steps[stepIdx + 1]) }
  const back = () => { if (stepIdx > 0) setStep(steps[stepIdx - 1]) }

  const selectAccountType = (type: AccountType) => {
    setAccountType(type)
    if (type === 'organization') {
      setOrgEmailBlocked(!isOrganizationEmail(user?.email))
    } else {
      setOrgEmailBlocked(false)
    }
  }

  const orgDetailsValid = orgType !== null && orgName.trim().length >= 2 && !orgEmailBlocked

  const persist = useCallback(async (update: Record<string, unknown>) => {
    setSaving(true); setSaveError(null)
    try {
      const res = await fetch('/api/profiles/update', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Request failed')
      setShow(false)
    } catch (err) {
      // Keep the wizard open with a visible retry instead of silently closing —
      // closing here would leave onboarding_completed unset and re-show the
      // wizard on every future page load with no way to explain why.
      setSaveError(err instanceof Error ? err.message : "Couldn't save your setup. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }, [])

  const finish = () => {
    const update: Record<string, unknown> = { onboarding_completed: true, preferred_modalities: selected }
    if (username && uStatus === 'available') update.username = username
    if (accountType) update.account_type = accountType
    if (accountType === 'organization') {
      update.organization_name = orgName.trim()
      update.organization_type = orgType
      update.job_title = jobTitle.trim() || null
    }
    persist(update)
  }

  const skip = () => persist({ onboarding_completed: true })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); skip() }
  }

  if (!show) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4"
      >
        <motion.div
          ref={dialogRef}
          key={step}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}
          className="w-full max-w-lg bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-2xl relative outline-none max-h-[90vh] overflow-y-auto"
        >
          {/* Close / skip */}
          <button
            onClick={skip}
            aria-label="Skip setup for now"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-text-disabled hover:text-text-primary hover:bg-surface-active transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-1 mt-1">
            {steps.map((s, i) => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${i <= stepIdx ? 'bg-primary w-8' : 'bg-border w-4'}`} />
            ))}
          </div>
          <p className="text-center text-[11px] text-text-disabled mb-6" aria-live="polite">
            Step {stepIdx + 1} of {steps.length}
          </p>

          {/* STEP: welcome */}
          {step === 'welcome' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 bg-primary">
                <Sparkles className="w-8 h-8 text-white" aria-hidden="true" />
              </div>
              <h2 id="onboarding-title" className="text-2xl font-black text-text-primary">Welcome to Aiscern</h2>
              <p className="text-text-muted text-sm leading-relaxed">
                The most accurate AI content detection platform. Let's get you set up in 30 seconds.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-6">
                {[['Accurate', 'Multi-model ensemble'], ['Fast', 'Results in seconds'], ['Private', 'Files never stored']].map(([h, s]) => (
                  <div key={h} className="bg-surface-active/40 border border-border rounded-xl p-3 text-center">
                    <p className="text-xs font-bold text-text-primary">{h}</p>
                    <p className="text-[10px] text-text-disabled mt-0.5">{s}</p>
                  </div>
                ))}
              </div>
              <button onClick={next} className="w-full mt-4 py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 transition-colors">
                Get Started <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* STEP: accountType */}
          {step === 'accountType' && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 id="onboarding-title" className="text-xl font-black text-text-primary">How will you use Aiscern?</h2>
                <p className="text-text-disabled text-xs mt-1">This helps us tailor your dashboard — you can change it later in settings</p>
              </div>
              <div className="space-y-2.5" role="group" aria-label="Account type">
                <button
                  type="button"
                  aria-pressed={accountType === 'individual'}
                  onClick={() => selectAccountType('individual')}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${accountType === 'individual' ? 'border-primary/50 bg-primary/10' : 'border-border bg-surface-active/20 hover:border-primary/30'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accountType === 'individual' ? 'bg-primary/25' : 'bg-surface-active/60'}`}>
                    <UserRound className={`w-5 h-5 ${accountType === 'individual' ? 'text-primary' : 'text-text-disabled'}`} aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${accountType === 'individual' ? 'text-text-primary' : 'text-text-muted'}`}>Individual</p>
                    <p className="text-[11px] text-text-disabled">Personal use — writing, research, or content you create yourself</p>
                  </div>
                  {accountType === 'individual' && <Check className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true" />}
                </button>

                <button
                  type="button"
                  aria-pressed={accountType === 'organization'}
                  onClick={() => selectAccountType('organization')}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${accountType === 'organization' ? 'border-primary/50 bg-primary/10' : 'border-border bg-surface-active/20 hover:border-primary/30'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accountType === 'organization' ? 'bg-primary/25' : 'bg-surface-active/60'}`}>
                    <Building2 className={`w-5 h-5 ${accountType === 'organization' ? 'text-primary' : 'text-text-disabled'}`} aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${accountType === 'organization' ? 'text-text-primary' : 'text-text-muted'}`}>Organization</p>
                    <p className="text-[11px] text-text-disabled">Corporate team, HR &amp; recruiting, or an educational institution</p>
                  </div>
                  {accountType === 'organization' && <Check className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true" />}
                </button>
              </div>

              {accountType === 'organization' && orgEmailBlocked && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber/10 border border-amber/20 text-left">
                  <AlertTriangle className="w-4 h-4 text-amber shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-amber leading-relaxed">
                    Organization accounts need a work or institution email. You signed up with{' '}
                    <span className="font-semibold">{user?.email}</span>, which looks like a personal address.
                    You can continue with an Individual account instead, or sign up again using your organization email.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={back} aria-label="Go back to previous step"
                  className="p-3 rounded-2xl border border-border text-text-muted hover:text-text-primary hover:border-primary/30 transition-colors">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  onClick={next}
                  disabled={!accountType || (accountType === 'organization' && orgEmailBlocked)}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                  Continue <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* STEP: orgDetails (only when accountType === 'organization') */}
          {step === 'orgDetails' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 bg-surface-active/40 border border-border">
                  <Building2 className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <h2 id="onboarding-title" className="text-xl font-black text-text-primary">Tell us about your organization</h2>
                <p className="text-text-disabled text-xs mt-1">Verified against your sign-up email: {user?.email}</p>
              </div>

              <div className="space-y-2" role="group" aria-label="Organization type">
                {ORG_TYPES.map(t => {
                  const Icon = ORG_TYPE_ICONS[t]
                  const active = orgType === t
                  return (
                    <button key={t}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setOrgType(t)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${active ? 'border-primary/50 bg-primary/10' : 'border-border bg-surface-active/20 hover:border-primary/30'}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-primary/25' : 'bg-surface-active/60'}`}>
                        <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-text-disabled'}`} aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${active ? 'text-text-primary' : 'text-text-muted'}`}>{ORG_TYPE_LABELS[t]}</p>
                        <p className="text-[11px] text-text-disabled">{ORG_TYPE_SUB[t]}</p>
                      </div>
                      {active && <Check className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>

              <div>
                <label htmlFor="onboarding-org-name" className="text-xs font-semibold text-text-muted mb-1.5 block">
                  Organization name
                </label>
                <input
                  id="onboarding-org-name"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="e.g. Northbridge College, Acme Inc."
                  maxLength={120}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label htmlFor="onboarding-job-title" className="text-xs font-semibold text-text-muted mb-1.5 block">
                  Your role <span className="text-text-disabled font-normal">(optional)</span>
                </label>
                <input
                  id="onboarding-job-title"
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                  placeholder="e.g. Recruiting Manager, Professor, Content Lead"
                  maxLength={100}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={back} aria-label="Go back to previous step"
                  className="p-3 rounded-2xl border border-border text-text-muted hover:text-text-primary hover:border-primary/30 transition-colors">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button onClick={next} disabled={!orgDetailsValid}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5">
                  Continue <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* STEP: modalities */}
          {step === 'modalities' && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 id="onboarding-title" className="text-xl font-black text-text-primary">What will you detect?</h2>
                <p className="text-text-disabled text-xs mt-1">Select all that apply — you can use all of them anytime</p>
              </div>
              <div className="space-y-2" role="group" aria-label="Content types to detect">
                {MODALITY_OPTIONS.map(m => {
                  const Icon = m.icon
                  const active = selected.includes(m.id)
                  return (
                    <button key={m.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelected(s => (s.includes(m.id) ? s.filter(x => x !== m.id) : [...s, m.id]))}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${active ? 'border-primary/50 bg-primary/10' : 'border-border bg-surface-active/20 hover:border-primary/30'}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-primary/25' : 'bg-surface-active/60'}`}>
                        <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-text-disabled'}`} aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${active ? 'text-text-primary' : 'text-text-muted'}`}>{m.label}</p>
                        <p className="text-[11px] text-text-disabled">{m.sub}</p>
                      </div>
                      {active && <Check className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={back} aria-label="Go back to previous step"
                  className="p-3 rounded-2xl border border-border text-text-muted hover:text-text-primary hover:border-primary/30 transition-colors">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button onClick={next} className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white bg-primary hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
                  Continue <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* STEP: username */}
          {step === 'username' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 bg-surface-active/40 border border-border">
                  <User className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <h2 id="onboarding-title" className="text-xl font-black text-text-primary">Choose a username</h2>
                <p className="text-text-disabled text-xs mt-1">This is optional — you can set it later in your profile</p>
              </div>
              <div className="relative">
                <label htmlFor="onboarding-username" className="sr-only">Username</label>
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-disabled text-sm" aria-hidden="true">@</span>
                <input
                  id="onboarding-username"
                  value={username}
                  onChange={e => checkUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="yourname"
                  maxLength={30}
                  autoComplete="off"
                  aria-describedby="username-status"
                  className="w-full bg-background border border-border rounded-xl pl-8 pr-10 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary transition-colors"
                />
                {uStatus === 'checking' && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled animate-spin" aria-hidden="true" />}
                {uStatus === 'available' && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald" aria-hidden="true" />}
                {uStatus === 'taken' && <X className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose" aria-hidden="true" />}
              </div>
              <div id="username-status">
                {uStatus === 'available' && <p className="text-xs text-emerald">@{username} is available!</p>}
                {uStatus === 'taken' && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-rose">@{username} is taken. Try one of these:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map(s => (
                        <button key={s} onClick={() => { setUsername(s); setUStatus('available') }}
                          className="px-3 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors">
                          @{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={back} aria-label="Go back to previous step"
                  className="p-3 rounded-2xl border border-border text-text-muted hover:text-text-primary hover:border-primary/30 transition-colors">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button onClick={() => { setUsername(''); setUStatus('idle'); next() }}
                  className="flex-1 py-3 rounded-2xl border border-border text-xs text-text-muted hover:text-text-primary font-semibold transition-colors">
                  Skip for now
                </button>
                <button onClick={next} disabled={uStatus === 'checking'}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm text-white bg-primary hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP: ready */}
          {step === 'ready' && (
            <div className="text-center space-y-5">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-primary"
              >
                <Zap className="w-8 h-8 text-white" aria-hidden="true" />
              </motion.div>
              <h2 id="onboarding-title" className="text-2xl font-black text-text-primary">You're all set!</h2>
              <p className="text-text-muted text-sm leading-relaxed">
                {accountType === 'organization' && orgName
                  ? `Your ${ORG_TYPE_LABELS[orgType as OrgType]?.toLowerCase()} account for ${orgName} is ready.`
                  : 'Your account is ready.'} Start with a free scan — no upload required for text detection.
              </p>
              <div className="text-left space-y-2">
                {[
                  ['10 scans/day', 'on your free plan'],
                  ['3 audio + 3 video', 'free trial credits'],
                  ['All results saved', 'in your history'],
                ].map(([h, s]) => (
                  <div key={h} className="flex items-center gap-3 p-3 bg-surface-active/30 border border-border rounded-xl">
                    <Check className="w-4 h-4 text-emerald flex-shrink-0" aria-hidden="true" />
                    <div>
                      <span className="text-xs font-semibold text-text-primary">{h} </span>
                      <span className="text-xs text-text-disabled">{s}</span>
                    </div>
                  </div>
                ))}
              </div>
              {saveError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose/10 border border-rose/20 text-left">
                  <AlertTriangle className="w-4 h-4 text-rose shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-rose">{saveError}</p>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={back} aria-label="Go back to previous step"
                  className="p-3 rounded-2xl border border-border text-text-muted hover:text-text-primary hover:border-primary/30 transition-colors">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button onClick={finish} disabled={saving}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white bg-primary hover:bg-primary/90 disabled:opacity-70 transition-all flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  {saving ? 'Setting up…' : saveError ? 'Try again' : 'Go to Dashboard →'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
