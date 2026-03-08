'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase/client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Mail, Lock, User, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const schema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters'),
  email:    z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormData = z.infer<typeof schema>

async function setSessionCookie(user: any) {
  const idToken = await user.getIdToken()
  await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) })
}

function FullScreenLoader({ message }: { message: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-6">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-2xl shadow-primary/30">
        <Shield className="w-10 h-10 text-white" />
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.span key={i} className="w-2 h-2 rounded-full bg-primary"
              animate={{ y: [0, -8, 0] }} transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }} />
          ))}
        </div>
        <p className="text-text-muted text-sm">{message}</p>
      </div>
    </motion.div>
  )
}

export default function SignupPage() {
  const [showPw, setShowPw]           = useState(false)
  const [googleLoading, setGoogle]    = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const router   = useRouter()
  const supabase = createClient()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const createProfile = async (uid: string, email: string, name: string) => {
    try {
      await supabase.from('profiles').upsert({ id: uid, email, display_name: name, plan: 'free', scan_count: 0, monthly_scans: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    } catch {}
  }

  const onSubmit = async (data: FormData) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, data.email, data.password)
      await updateProfile(cred.user, { displayName: data.name })
      await createProfile(cred.user.uid, data.email, data.name)
      await setSessionCookie(cred.user)
      setRedirecting(true)
      toast.success('Account created! Welcome to DETECTAI')
      setTimeout(() => router.push('/dashboard'), 900)
    } catch (err: any) {
      const msg = err?.message || 'Signup failed'
      toast.error(msg.includes('email-already-in-use') ? 'An account with this email already exists' : msg)
    }
  }

  const signUpWithGoogle = async () => {
    setGoogle(true)
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      await createProfile(cred.user.uid, cred.user.email || '', cred.user.displayName || '')
      await setSessionCookie(cred.user)
      setRedirecting(true)
      toast.success('Welcome to DETECTAI!')
      setTimeout(() => router.push('/dashboard'), 900)
    } catch (err: any) {
      if (!err?.message?.includes('popup-closed')) toast.error(err?.message || 'Google sign-up failed')
    } finally { setGoogle(false) }
  }

  return (
    <>
      <AnimatePresence>{redirecting && <FullScreenLoader message="Setting up your dashboard..." />}</AnimatePresence>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.1),transparent)] pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black gradient-text">DETECTAI</h1>
            <p className="text-text-muted mt-1 text-sm">Unmask the Machine</p>
          </div>
          <div className="card space-y-5">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Create your account</h2>
              <p className="text-text-muted text-sm mt-0.5">Free forever · No credit card</p>
            </div>
            <button onClick={signUpWithGoogle} disabled={googleLoading || isSubmitting}
              className="w-full py-3 px-4 rounded-xl border border-border bg-surface hover:bg-surface-active transition-all flex items-center justify-center gap-3 text-sm font-medium text-text-primary disabled:opacity-50">
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </button>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-text-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input type="text" {...register('name')} placeholder="Your name" className="input-field pl-10 w-full py-2.5" />
                </div>
                {errors.name && <p className="text-rose text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input type="email" {...register('email')} placeholder="you@example.com" className="input-field pl-10 w-full py-2.5" />
                </div>
                {errors.email && <p className="text-rose text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input type={showPw ? 'text' : 'password'} {...register('password')} placeholder="Min. 8 characters" className="input-field pl-10 pr-10 w-full py-2.5" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-rose text-xs mt-1">{errors.password.message}</p>}
              </div>
              <button type="submit" disabled={isSubmitting || googleLoading}
                className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</> : <>Create Free Account <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
            <p className="text-center text-sm text-text-muted">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  )
}
