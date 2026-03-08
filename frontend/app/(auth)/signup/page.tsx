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
import { motion } from 'framer-motion'
import { Shield, Mail, Lock, User, ArrowRight, Eye, EyeOff, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const schema = z.object({
  name:            z.string().min(2, 'Name too short'),
  email:           z.string().email('Invalid email'),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

const perks = ['50 free scans per month', 'Image, audio, video & text AI detection', 'Full scan history & analytics', 'Web scraper access']

async function syncToSupabase(uid: string, email: string, name: string, avatar: string | null) {
  const supabase = createClient()
  await supabase.from('profiles').upsert({
    id: uid,
    email,
    display_name: name,
    avatar_url: avatar,
    plan: 'free',
    scan_count: 0,
    monthly_scans: 0,
  }, { onConflict: 'id' })
}


async function setSessionCookie(user: any) {
  const idToken = await user.getIdToken()
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
}

export default function SignupPage() {
  const [showPw, setShowPw]       = useState(false)
  const [googleLoading, setGoogle] = useState(false)
  const router = useRouter()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, data.email, data.password)
      await setSessionCookie(cred.user)
      await updateProfile(cred.user, { displayName: data.name })
      await syncToSupabase(cred.user.uid, data.email, data.name, null)
      toast.success('Account created! Welcome to DETECTAI 🎉')
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed'
      if (msg.includes('email-already-in-use')) toast.error('Email already in use. Try signing in.')
      else toast.error(msg)
    }
  }

  const signUpWithGoogle = async () => {
    setGoogle(true)
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      await setSessionCookie(cred.user)
      const u = cred.user
      await syncToSupabase(u.uid, u.email!, u.displayName || u.email!.split('@')[0], u.photoURL)
      toast.success('Account created! Welcome to DETECTAI 🎉')
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-up failed'
      if (!msg.includes('popup-closed')) toast.error(msg)
    } finally {
      setGoogle(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/25">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black gradient-text">DETECTAI</h1>
          <p className="text-text-muted text-sm">Join thousands detecting AI content</p>
        </div>

        <div className="card space-y-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-2">✨ Free forever plan</div>
            <h2 className="text-lg font-bold text-text-primary">Create your account</h2>
          </div>

          {/* Perks */}
          <div className="grid grid-cols-2 gap-1.5">
            {perks.map(p => (
              <div key={p} className="flex items-center gap-2 text-xs text-text-secondary">
                <Check className="w-3.5 h-3.5 text-emerald flex-shrink-0" />{p}
              </div>
            ))}
          </div>

          <button onClick={signUpWithGoogle} disabled={googleLoading}
            className="w-full py-2.5 px-4 rounded-xl border border-border bg-surface hover:bg-surface-active transition-all flex items-center justify-center gap-2.5 text-sm font-medium text-text-primary disabled:opacity-50">
            {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
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

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input {...register('name')} placeholder="Display name"
                  className="input-field pl-10 w-full py-2.5 text-sm" />
              </div>
              {errors.name && <p className="text-rose text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input type="email" {...register('email')} placeholder="Email address"
                  className="input-field pl-10 w-full py-2.5 text-sm" />
              </div>
              {errors.email && <p className="text-rose text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input type={showPw ? 'text' : 'password'} {...register('password')} placeholder="Password (8+ chars)"
                  className="input-field pl-10 pr-10 w-full py-2.5 text-sm" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-rose text-xs mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input type="password" {...register('confirmPassword')} placeholder="Confirm password"
                  className="input-field pl-10 w-full py-2.5 text-sm" />
              </div>
              {errors.confirmPassword && <p className="text-rose text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting}
              className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-xs text-text-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
