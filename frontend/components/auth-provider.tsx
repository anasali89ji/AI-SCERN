'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  onAuthStateChanged, User, signOut as firebaseSignOut,
  setPersistence, browserLocalPersistence,
} from 'firebase/auth'
import { auth } from '@/lib/firebase/client'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
})

/** Check if the __session cookie already exists (set by login page before redirect) */
function hasSessionCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(c => c.trim().startsWith('__session='))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (auth) {
      setPersistence(auth, browserLocalPersistence).catch(console.error)
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setLoading(false)

      if (u) {
        // Skip session POST if login page already set the cookie.
        // This eliminates the double-write that was causing an extra
        // network round-trip before the dashboard could render.
        if (hasSessionCookie()) return

        try {
          const idToken = await u.getIdToken()
          await fetch('/api/auth/session', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ idToken }),
          })
        } catch (e) {
          console.error('Session sync error:', e)
        }
      } else {
        try { await fetch('/api/auth/session', { method: 'DELETE' }) } catch {}
      }
    })
    return unsub
  }, [])

  const signOut = async () => {
    await firebaseSignOut(auth)
    await fetch('/api/auth/session', { method: 'DELETE' })
    window.location.href = '/'
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
