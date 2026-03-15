/**
 * DETECTAI — Reliable Google Auth Helper
 *
 * Fixes two issues:
 * 1. signInWithPopup hangs on unauthorized domains → timeout + redirect fallback
 * 2. getRedirectResult() is called on every page load (300-500ms wasted) →
 *    only call it when a redirect flag is set in sessionStorage
 */

import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult as firebaseGetRedirectResult,
  UserCredential,
  Auth,
  AuthProvider,
} from 'firebase/auth'

const POPUP_TIMEOUT_MS    = 10_000
const REDIRECT_FLAG_KEY   = '__detectai_google_redirect'

/** Mark that we're about to do a Google redirect (call before signInWithRedirect) */
export function markGoogleRedirect(): void {
  try { sessionStorage.setItem(REDIRECT_FLAG_KEY, '1') } catch {}
}

/** Check + clear the redirect flag. Returns true only on post-redirect page load. */
export function consumeGoogleRedirectFlag(): boolean {
  try {
    const val = sessionStorage.getItem(REDIRECT_FLAG_KEY)
    if (val) { sessionStorage.removeItem(REDIRECT_FLAG_KEY); return true }
  } catch {}
  return false
}

/**
 * Only call getRedirectResult when we're actually returning from a Google redirect.
 * Skips the 300-500ms Firebase call on all other page loads.
 */
export async function getRedirectResultIfExpected(
  auth: Auth,
): Promise<UserCredential | null> {
  if (!consumeGoogleRedirectFlag()) return null
  return firebaseGetRedirectResult(auth)
}

/**
 * Try popup with 10s timeout → auto-falls back to redirect if popup hangs/blocked.
 * Returns credential if popup succeeded, null if redirect was initiated.
 */
export async function googleSignInWithFallback(
  auth: Auth,
  provider: AuthProvider,
  onRedirectFallback?: () => void,
): Promise<UserCredential | null> {
  let popupTimedOut = false

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => { popupTimedOut = true; reject(new Error('popup-timeout')) }, POPUP_TIMEOUT_MS)
  )

  try {
    const cred = await Promise.race([signInWithPopup(auth, provider), timeoutPromise])
    return cred
  } catch (err: any) {
    const code = err?.code ?? ''
    const msg  = err?.message ?? ''

    const shouldRedirect =
      popupTimedOut ||
      code === 'auth/unauthorized-domain' ||
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      msg.includes('popup-timeout') ||
      msg.includes('unauthorized-domain') ||
      msg.includes('popup-blocked')

    if (shouldRedirect) {
      onRedirectFallback?.()
      markGoogleRedirect()  // set flag so result is picked up on return
      await signInWithRedirect(auth, provider)
      return null
    }

    // User closed popup deliberately
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return null
    }

    throw err
  }
}
