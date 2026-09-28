'use client'
import { createContext, useContext, useEffect, useRef } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'

interface AuthUser {
  uid:         string
  email:       string | null
  displayName: string | null
  photoURL:    string | null
  username:    string | null
}
interface AuthContextValue {
  user:    AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: false, signOut: async () => {} })

const AUTH_PAGES = ['/login', '/signup']

async function syncProfile(user: AuthUser) {
  try {
    await fetch('/api/profiles/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid, email: user.email, display_name: user.displayName, username: user.username }),
    })
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()
  const { signOut: clerkSignOut } = useClerk()
  const router        = useRouter()
  const pathname      = usePathname()
  const syncedRef     = useRef<string | null>(null)
  const redirectedRef = useRef(false)

  const authUser: AuthUser | null = user ? {
    uid:         user.id,
    email:       user.primaryEmailAddress?.emailAddress ?? null,
    displayName: user.fullName ?? user.username ?? null,
    photoURL:    user.imageUrl ?? null,
    username:    user.username ?? null,
  } : null

  // Fast redirect — fires immediately when Clerk confirms sign-in on auth pages.
  // Reads redirect_url directly off window.location (not useSearchParams) so this
  // provider, which wraps the whole app at the root layout, never forces every
  // route into dynamic rendering — it only touches window inside an effect,
  // which never runs during SSR anyway. This mirrors the same redirect_url
  // logic the /login and /signup pages use themselves, so both mechanisms
  // agree on where to send the user instead of racing to different targets.
  useEffect(() => {
    if (!isLoaded || !authUser || redirectedRef.current) return
    if (AUTH_PAGES.some(p => pathname.startsWith(p))) {
      redirectedRef.current = true
      const raw    = new URLSearchParams(window.location.search).get('redirect_url') ?? ''
      const target = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'
      router.replace(target)
    }
  }, [isLoaded, authUser?.uid, pathname]) // eslint-disable-line

  useEffect(() => {
    if (isLoaded && !user) redirectedRef.current = false
  }, [isLoaded, user])

  // Sync Supabase profile once per sign-in
  useEffect(() => {
    if (authUser && syncedRef.current !== authUser.uid) {
      syncedRef.current = authUser.uid
      syncProfile(authUser)
    }
  }, [authUser?.uid]) // eslint-disable-line

  const handleSignOut = async () => {
    syncedRef.current = null
    redirectedRef.current = false
    try {
      await clerkSignOut({ redirectUrl: '/' })
    } catch {
      window.location.href = '/'
    }
  }

  return (
    <AuthContext.Provider value={{ user: authUser, loading: !isLoaded, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
