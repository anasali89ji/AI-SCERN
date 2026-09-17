'use client'
// Static-build stub — see scripts/build-cf-pages.mjs for why.
interface AuthUser { uid: string; email: string | null; displayName: string | null; photoURL: string | null; username: string | null }
interface AuthContextValue { user: AuthUser | null; loading: boolean; signOut: () => Promise<void> }

export function useAuth(): AuthContextValue {
  return { user: null, loading: false, signOut: async () => {} }
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
