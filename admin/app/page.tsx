'use client'
import { useState } from 'react'
import { Crown, Eye, EyeOff, AlertTriangle } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, email }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); return }
      window.location.href = '/dashboard'
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a12] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <Crown className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Aiscern Admin</h1>
          <p className="text-sm text-text-muted">Sign in to the admin console</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@aiscern.com"
              className="w-full px-4 py-3 rounded-xl text-sm bg-[#0f0f17] border border-[#1c1c2e] text-white placeholder-text-disabled outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Password</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
                className="w-full px-4 py-3 pr-10 rounded-xl text-sm bg-[#0f0f17] border border-[#1c1c2e] text-white placeholder-text-disabled outline-none focus:ring-2 focus:ring-primary/50" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading || !password} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/20">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-[10px] text-text-disabled mt-6">Aiscern Admin Console v2.0</p>
      </div>
    </div>
  )
}
