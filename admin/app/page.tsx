'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Lock, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    })
    if (res.ok) { router.push('/dashboard') }
    else { setError('Invalid admin password'); setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/25">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-text-1">Aiscern</h1>
          <p className="text-text-3 text-sm mt-1">admin.aiscern.com</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          <h2 className="text-lg font-bold text-text-1 mb-1">Admin Access</h2>
          <p className="text-text-3 text-sm mb-6">Enter your admin password to continue</p>

          {error && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-xl mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-2 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                <input
                  type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)}
                  placeholder="••••••••••••" required
                  className="w-full bg-bg border border-border rounded-xl px-10 py-3 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent transition-colors"
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-2">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading || !pw}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-accent to-accent2 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity shadow-lg shadow-accent/25">
              {loading ? (
                <span className="flex gap-1">{[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}</span>
              ) : (<>Enter Admin Panel <ArrowRight className="w-4 h-4" /></>)}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-text-3 mt-6">
          Restricted access — authorized personnel only
        </p>
      </div>
    </div>
  )
}
