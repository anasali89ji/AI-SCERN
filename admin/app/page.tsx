'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff, AlertCircle, ArrowRight, Shield } from 'lucide-react'

function AiscernLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="url(#lg_login)" />
      <path d="M20 8L30 28H10L20 8Z" fill="white" fillOpacity="0.92" />
      <circle cx="20" cy="25" r="3.5" fill="white" fillOpacity="0.6" />
      <defs>
        <linearGradient id="lg_login" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function LoginPage() {
  const [pw, setPw]         = useState('')
  const [show, setShow]     = useState(false)
  const [loading, setLoad]  = useState(false)
  const [error, setError]   = useState('')
  const [rateLimited, setRL]= useState(false)
  const cardRef             = useRef<HTMLDivElement>(null)
  const router              = useRouter()

  // Spotlight effect
  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const move = (e: MouseEvent) => {
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mouse-x', `${e.clientX - r.left}px`)
      card.style.setProperty('--mouse-y', `${e.clientY - r.top}px`)
    }
    card.addEventListener('mousemove', move)
    return () => card.removeEventListener('mousemove', move)
  }, [])

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw || loading) return
    setLoad(true); setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else if (res.status === 429) {
        setRL(true)
        setError('Too many attempts. Please wait 15 minutes.')
        setLoad(false)
      } else if (res.status === 503) {
        const d = await res.json() as { missing?: string[] }
        setError(`Server misconfigured: ${d.missing?.join(', ') ?? 'check logs'}`)
        setLoad(false)
      } else {
        setError('Invalid admin password')
        setLoad(false)
      }
    } catch {
      setError('Network error — try again')
      setLoad(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-background">
      {/* Mesh background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full animate-mesh-drift"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full animate-mesh-drift"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)', animationDelay: '6s' }} />
        <div className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="w-full max-w-[400px] animate-slide-up-fade">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <AiscernLogo size={44} />
            <div className="text-left">
              <div className="text-xl font-black text-text-primary tracking-tight">Aiscern</div>
              <div className="text-xs text-text-disabled font-semibold tracking-widest uppercase">Admin Panel</div>
            </div>
          </div>
          <p className="text-sm text-text-muted">Restricted access — authorized personnel only</p>
        </div>

        {/* Login card */}
        <div ref={cardRef}
          className="spotlight-card rounded-2xl border border-border p-8"
          style={{ background: '#0f0f17' }}>

          {/* Lock icon */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center animate-glow-pulse"
              style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.2)' }}>
              <Shield className="w-5 h-5 text-primary" />
            </div>
          </div>

          <h1 className="text-lg font-bold text-text-primary text-center mb-1">Sign in to Admin</h1>
          <p className="text-xs text-text-muted text-center mb-6">Enter your admin password to continue</p>

          {error && (
            <div className="flex items-center gap-2 rounded-xl p-3 mb-5 text-xs text-rose-300"
              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2" htmlFor="password">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  placeholder="Enter password"
                  disabled={loading || rateLimited}
                  aria-label="Admin password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm text-text-primary placeholder-text-disabled
                    outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50"
                  style={{ background: '#141420', border: '1px solid #1c1c2e' }}
                />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-secondary transition-colors"
                  aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={!pw || loading || rateLimited}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold
                text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-primary/50"
              style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
              {loading ? (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white spinner" />
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-text-disabled mt-6">
            Session expires after 2 hours of inactivity
          </p>
        </div>

        <p className="text-center text-xs text-text-disabled mt-6 opacity-50">
          Aiscern Admin • Restricted Access
        </p>
      </div>
    </div>
  )
}
