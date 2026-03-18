'use client'
/**
 * Aiscern — Auth Provider (Clerk)
 * Safe wrapper: if Clerk keys are missing the app renders with user=null.
 */
import { createContext, useContext, useEffect, useRef } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'

interface AuthUser {
  uid:         string
  email:       string | null
  displayName: string | null
  photoURL:    string | null
}

interface AuthContextValue {
  user:    AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user:    null,
  loading: false,
  signOut: async () => {},
})

async function syncProfile(user: AuthUser) {
  try {
    await fetch('/api/profiles/create', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ uid: user.uid, email: user.email, display_name: user.displayName }),
    })
  } catch { /* non-fatal */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // useUser() is safe inside ClerkProvider even with missing keys —
  // it returns { user: null, isLoaded: false } rather than throwing.
  const { user, isLoaded } = useUser()
  const { signOut: clerkSignOut } = useClerk()
  const syncedRef = useRef<string | null>(null)

  const authUser: AuthUser | null = user ? {
    uid:         user.id,
    email:       user.primaryEmailAddress?.emailAddress ?? null,
    displayName: user.fullName ?? user.username ?? null,
    photoURL:    user.imageUrl ?? null,
  } : null

  // Auto-sync Supabase profile once per sign-in
  useEffect(() => {
    if (authUser && syncedRef.current !== authUser.uid) {
      syncedRef.current = authUser.uid
      syncProfile(authUser)
    }
  }, [authUser?.uid]) // eslint-disable-line

  const handleSignOut = async () => {
    syncedRef.current = null
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

export function useAuth() {
  return useContext(AuthContext)
}
