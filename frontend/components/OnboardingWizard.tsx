'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import {
  FileText, Image, Mic, Video, Globe, Shield, ChevronRight,
  X, Sparkles, User, Zap, Check
} from 'lucide-react'

const STEPS = ['welcome','modalities','username','ready'] as const
type Step = typeof STEPS[number]

const MODALITY_OPTIONS = [
  { id:'text',  icon: FileText, label:'Text',   sub:'Detect AI-written articles & essays' },
  { id:'image', icon: Image,    label:'Image',  sub:'Spot AI-generated photos & art' },
  { id:'audio', icon: Mic,      label:'Audio',  sub:'Identify synthetic voices' },
  { id:'video', icon: Video,    label:'Video',  sub:'Find deepfakes in videos' },
  { id:'url',   icon: Globe,    label:'Web',    sub:'Analyze entire websites for AI content' },
]

export function OnboardingWizard() {
  const { user }       = useAuth()
  const [show, setShow]         = useState(false)
  const [step, setStep]         = useState<Step>('welcome')
  const [selected, setSelected] = useState<string[]>([])
  const [username, setUsername] = useState('')
  const [uStatus, setUStatus]   = useState<'idle'|'checking'|'available'|'taken'>('idle')
  const [suggestions, setSugg]  = useState<string[]>([])
  const [saving, setSaving]     = useState(false)
  const [debounce, setDebounce] = useState<NodeJS.Timeout|null>(null)

  useEffect(() => {
    if (!user) return
    const db = createClient()
    db.from('profiles').select('onboarding_completed').eq('id', user.uid).single()
      .then(({ data }) => { if (data && !data.onboarding_completed) setShow(true) })
  }, [user])

  const checkUsername = (val: string) => {
    setUsername(val)
    if (debounce) clearTimeout(debounce)
    if (!val || val.length < 3) { setUStatus('idle'); return }
    setUStatus('checking')
    const t = setTimeout(async () => {
      const res  = await fetch(`/api/profiles/username?username=${encodeURIComponent(val)}`)
      const data = await res.json()
      setUStatus(data.available ? 'available' : 'taken')
      setSugg(data.suggestions || [])
    }, 400)
    setDebounce(t)
  }

  const next = () => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  const finish = async () => {
    if (!user) return
    setSaving(true)
    const update: Record<string,any> = { onboarding_completed: true, preferred_modalities: selected }
    if (username && uStatus === 'available') update.username = username
    await fetch('/api/profiles/update', {
      method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(update)
    }).catch(() => {})
    setSaving(false)
    setShow(false)
  }

  if (!show) return null

  const stepIdx = STEPS.indexOf(step)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      >
        <motion.div
          key={step}
          initial={{ opacity:0, y:16, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }}
          exit={{ opacity:0, y:-12 }} transition={{ duration:0.25 }}
          className="w-full max-w-lg bg-[#07070d] border border-[#1e1e35] rounded-3xl p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Top gradient */}
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl" style={{ background:`linear-gradient(90deg,#7c3aed,#2563eb)` }} />

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-8">
            {STEPS.map((s,i) => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${i <= stepIdx ? 'bg-[#7c3aed] w-8' : 'bg-[#1e1e35] w-4'}`} />
            ))}
          </div>

          {/* STEP: welcome */}
          {step === 'welcome' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background:'linear-gradient(135deg,#7c3aed,#2563eb)' }}>
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white">Welcome to Aiscern</h2>
              <p className="text-[#64748b] text-sm leading-relaxed">
                The most accurate AI content detection platform. Let's get you set up in 30 seconds.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-6">
                {[['Accurate','Multi-model ensemble'],['Fast','Results in seconds'],['Private','Files never stored']].map(([h,s]) => (
                  <div key={h} className="bg-[#ffffff05] border border-[#1e1e35] rounded-xl p-3 text-center">
                    <p className="text-xs font-bold text-white">{h}</p>
                    <p className="text-[10px] text-[#4a5568] mt-0.5">{s}</p>
                  </div>
                ))}
              </div>
              <button onClick={next} className="w-full mt-4 py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2" style={{ background:'linear-gradient(135deg,#7c3aed,#2563eb)' }}>
                Get Started <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP: modalities */}
          {step === 'modalities' && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-black text-white">What will you detect?</h2>
                <p className="text-[#4a5568] text-xs mt-1">Select all that apply — you can use all of them anytime</p>
              </div>
              <div className="space-y-2">
                {MODALITY_OPTIONS.map(m => {
                  const Icon = m.icon
                  const active = selected.includes(m.id)
                  return (
                    <button key={m.id}
                      onClick={() => setSelected(s => s.includes(m.id) ? s.filter(x => x !== m.id) : [...s, m.id])}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${active ? 'border-[#7c3aed50] bg-[#7c3aed12]' : 'border-[#1e1e35] bg-[#ffffff03] hover:border-[#2a2a45]'}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-[#7c3aed30]' : 'bg-[#ffffff08]'}`}>
                        <Icon className={`w-4 h-4 ${active ? 'text-[#a78bfa]' : 'text-[#4a5568]'}`} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-[#94a3b8]'}`}>{m.label}</p>
                        <p className="text-[11px] text-[#4a5568]">{m.sub}</p>
                      </div>
                      {active && <Check className="w-4 h-4 text-[#a78bfa] flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
              <button onClick={next} className="w-full py-3.5 rounded-2xl font-bold text-sm text-white" style={{ background:'linear-gradient(135deg,#7c3aed,#2563eb)' }}>
                Continue <ChevronRight className="w-4 h-4 inline ml-1" />
              </button>
            </div>
          )}

          {/* STEP: username */}
          {step === 'username' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 bg-[#ffffff08] border border-[#1e1e35]">
                  <User className="w-5 h-5 text-[#a78bfa]" />
                </div>
                <h2 className="text-xl font-black text-white">Choose a username</h2>
                <p className="text-[#4a5568] text-xs mt-1">This is optional — you can set it later in your profile</p>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4a5568] text-sm">@</span>
                <input
                  value={username}
                  onChange={e => checkUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))}
                  placeholder="yourname"
                  maxLength={30}
                  className="w-full bg-[#0d0d18] border border-[#1e1e35] rounded-xl pl-8 pr-10 py-3 text-sm text-white placeholder:text-[#2a2a45] focus:outline-none focus:border-[#7c3aed] transition-colors"
                />
                {uStatus === 'checking'  && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-[#1e1e35] border-t-[#7c3aed] animate-spin" />}
                {uStatus === 'available' && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />}
                {uStatus === 'taken'     && <X     className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400" />}
              </div>
              {uStatus === 'available' && <p className="text-xs text-emerald-400">@{username} is available!</p>}
              {uStatus === 'taken' && (
                <div className="space-y-1.5">
                  <p className="text-xs text-rose-400">@{username} is taken. Try one of these:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map(s => (
                      <button key={s} onClick={() => { setUsername(s); setUStatus('available') }}
                        className="px-3 py-1 rounded-lg border border-[#7c3aed30] bg-[#7c3aed12] text-[#a78bfa] text-xs hover:bg-[#7c3aed20]">
                        @{s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={next} className="flex-1 py-3 rounded-2xl border border-[#1e1e35] text-xs text-[#64748b] hover:text-white font-semibold">
                  Skip for now
                </button>
                <button onClick={next} disabled={uStatus === 'checking'}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm text-white disabled:opacity-50"
                  style={{ background:'linear-gradient(135deg,#7c3aed,#2563eb)' }}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP: ready */}
          {step === 'ready' && (
            <div className="text-center space-y-5">
              <motion.div
                animate={{ scale:[1,1.05,1] }} transition={{ duration:1.5, repeat:Infinity }}
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background:'linear-gradient(135deg,#7c3aed,#2563eb)' }}
              >
                <Zap className="w-8 h-8 text-white" />
              </motion.div>
              <h2 className="text-2xl font-black text-white">You're all set!</h2>
              <p className="text-[#64748b] text-sm leading-relaxed">
                Your account is ready. Start with a free scan — no upload required for text detection.
              </p>
              <div className="text-left space-y-2">
                {[
                  ['10 scans/day', 'on your free plan'],
                  ['3 audio + 3 video', 'free trial credits'],
                  ['All results saved', 'in your history'],
                ].map(([h,s]) => (
                  <div key={h} className="flex items-center gap-3 p-3 bg-[#ffffff04] border border-[#1e1e35] rounded-xl">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-white">{h} </span>
                      <span className="text-xs text-[#4a5568]">{s}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={finish} disabled={saving}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white disabled:opacity-70 transition-all hover:scale-[1.02]"
                style={{ background:'linear-gradient(135deg,#7c3aed,#2563eb)' }}>
                {saving ? 'Setting up…' : 'Go to Dashboard →'}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
