'use client'
/**
 * DETECTAI — Auth Provider (Clerk)
 * Wraps Clerk's useUser/useClerk hooks into the same interface
 * the rest of the app expects: { user, loading, signOut }
 *
 * user.uid  → Clerk userId  (maps to user_id in Supabase profiles/scans)
 * user.email → primary email address
 */
import { createContext, useContext } from 'react'
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
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()
  const { signOut: clerkSignOut } = useClerk()

  const authUser: AuthUser | null = user ? {
    uid:         user.id,
    email:       user.primaryEmailAddress?.emailAddress ?? null,
    displayName: user.fullName ?? user.username ?? null,
    photoURL:    user.imageUrl ?? null,
  } : null

  const handleSignOut = async () => {
    await clerkSignOut({ redirectUrl: '/login' })
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
