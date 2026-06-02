'use client'
/**
 * /sso-callback
 *
 * Clerk redirects here after Google (and all other OAuth providers) complete.
 * Without this page, the redirect lands on Next.js's 404 handler.
 *
 * AuthenticateWithRedirectCallback finishes the OAuth handshake, creates /
 * restores the Clerk session, then hands off to our AuthProvider which
 * redirects to /dashboard (or the original redirect_url).
 */
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'

export default function SSOCallbackPage() {
  return (
    <>
      {/* Full-screen loader shown while Clerk validates the OAuth token */}
      <div className="min-h-screen bg-[#050510] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-9 h-9 text-blue-500 animate-spin" />
        <p className="text-sm text-slate-400 tracking-wide">Finishing sign-in…</p>
      </div>

      {/*
        AuthenticateWithRedirectCallback must be rendered on this page.
        It reads the Clerk hash params, exchanges the OAuth code for a
        session, then triggers the AuthProvider redirect to /dashboard.
      */}
      <AuthenticateWithRedirectCallback
        afterSignInUrl="/dashboard"
        afterSignUpUrl="/dashboard"
      />
    </>
  )
}
