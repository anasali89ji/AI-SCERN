/**
 * DETECTAI — Reliable Google Auth Helper
 *
 * Root cause of hang: signInWithPopup silently hangs when the current domain
 * is not in Firebase's authorized domains list. Firebase opens the popup,
 * user selects account, but the popup handler at detectai-prod.firebaseapp.com
 * refuses to postMessage back to an unauthorized origin — so the Promise
 * never resolves or rejects.
 *
 * Fix: race signInWithPopup against a 10-second timeout. If it hangs,
 * fall back to signInWithRedirect which always works (goes through
 * detectai-prod.firebaseapp.com, which is always an authorized domain).
 */

import {
  signInWithPopup,
  signInWithRedirect,
  UserCredential,
  Auth,
  AuthProvider,
} from 'firebase/auth'

const POPUP_TIMEOUT_MS = 10_000  // 10 seconds — enough for a real popup, catches hangs

/**
 * Try popup with timeout. Falls back to redirect if popup hangs or is blocked.
 * Returns the credential if popup succeeded, or null if redirecting (page will reload).
 */
export async function googleSignInWithFallback(
  auth: Auth,
  provider: AuthProvider,
  onRedirectFallback?: () => void,
): Promise<UserCredential | null> {
  let popupTimedOut = false

  const popupPromise = signInWithPopup(auth, provider)

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      popupTimedOut = true
      reject(new Error('popup-timeout'))
    }, POPUP_TIMEOUT_MS)
  )

  try {
    // Race: popup vs timeout
    const cred = await Promise.race([popupPromise, timeoutPromise])
    return cred
  } catch (err: any) {
    const code = err?.code ?? ''
    const msg  = err?.message ?? ''

    // Conditions that warrant falling back to redirect:
    const shouldRedirect =
      popupTimedOut ||                           // popup hung (unauthorized domain)
      code === 'auth/unauthorized-domain' ||
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      msg.includes('popup-timeout') ||
      msg.includes('unauthorized-domain') ||
      msg.includes('popup-blocked')

    if (shouldRedirect) {
      onRedirectFallback?.()
      await signInWithRedirect(auth, provider)
      // Page navigates away; getRedirectResult() handles the result on return
      return null
    }

    // User closed popup deliberately — not an error
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return null
    }

    // Real error — rethrow so callers can show it
    throw err
  }
}
