import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getAuth, GoogleAuthProvider,
  browserLocalPersistence, setPersistence,
  signInWithRedirect, getRedirectResult,
  signInWithPopup
} from 'firebase/auth'

// Firebase config — env vars preferred, hardcoded values as fallback
// Note: Firebase client API keys are NOT secrets (by Firebase's design).
// Security is enforced via Firebase Security Rules + authorized domains.
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
}

const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

let _auth: ReturnType<typeof getAuth> | null = null

export function getFirebaseAuth() {
  if (typeof window === 'undefined') return null
  if (!_auth) {
    _auth = getAuth(app)
    setPersistence(_auth, browserLocalPersistence).catch(() => {})
  }
  return _auth
}

export const auth = typeof window !== 'undefined' ? getAuth(app) : null as any

const provider = new GoogleAuthProvider()
provider.addScope('email')
provider.addScope('profile')
provider.setCustomParameters({ prompt: 'select_account' })
export const googleProvider = provider

// Re-export for convenience in pages
export { signInWithRedirect, getRedirectResult, signInWithPopup }

export function parseFirebaseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('auth/unauthorized-domain')) {
    return 'Domain not authorized. Please contact support@detectai.io'
  }
  if (msg.includes('auth/user-not-found') || msg.includes('auth/wrong-password') || msg.includes('auth/invalid-credential')) {
    return 'Incorrect email or password. Please try again.'
  }
  if (msg.includes('auth/email-already-in-use')) return 'An account with this email already exists.'
  if (msg.includes('auth/weak-password')) return 'Password must be at least 6 characters.'
  if (msg.includes('auth/too-many-requests')) return 'Too many attempts. Please wait a moment and try again.'
  if (msg.includes('auth/network-request-failed')) return 'Network error. Check your connection.'
  if (msg.includes('auth/popup-closed-by-user') || msg.includes('popup-closed')) return ''
  if (msg.includes('auth/popup-blocked')) return 'Popup blocked — please allow popups and try again.'
  return msg.replace('Firebase: ', '').replace(/\(auth\/.*?\)\.?/, '').trim()
}

export default app
