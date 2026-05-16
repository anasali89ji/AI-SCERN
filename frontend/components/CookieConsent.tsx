'use client'

/**
 * components/CookieConsent.tsx
 *
 * GDPR/CCPA compliant cookie consent banner.
 * - Granular controls: necessary, analytics, marketing
 * - Persists consent to localStorage (no cookies needed to store consent itself)
 * - Respects navigator.doNotTrack
 * - Shown on first visit; hides after consent or rejection
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ConsentState {
  given: boolean
  necessary: true          // always true — cannot be disabled
  analytics: boolean
  marketing: boolean
  timestamp: number
}

const CONSENT_KEY = 'aiscern_cookie_consent'

function getStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    return raw ? (JSON.parse(raw) as ConsentState) : null
  } catch {
    return null
  }
}

function storeConsent(state: ConsentState) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(state))
  } catch {}
}

export function CookieConsent() {
  const [visible, setVisible]       = useState(false)
  const [expanded, setExpanded]     = useState(false)
  const [analytics, setAnalytics]   = useState(false)
  const [marketing, setMarketing]   = useState(false)

  useEffect(() => {
    const stored = getStoredConsent()
    // Don't show if already consented
    if (stored?.given) return

    // Respect Do Not Track
    if (navigator.doNotTrack === '1') {
      storeConsent({ given: true, necessary: true, analytics: false, marketing: false, timestamp: Date.now() })
      return
    }

    // Short delay before showing banner
    const t = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(t)
  }, [])

  function acceptAll() {
    storeConsent({ given: true, necessary: true, analytics: true, marketing: true, timestamp: Date.now() })
    setVisible(false)
  }

  function rejectAll() {
    storeConsent({ given: true, necessary: true, analytics: false, marketing: false, timestamp: Date.now() })
    setVisible(false)
  }

  function savePreferences() {
    storeConsent({ given: true, necessary: true, analytics, marketing, timestamp: Date.now() })
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm shadow-2xl"
    >
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium mb-1">We use cookies</p>
            <p className="text-xs text-muted-foreground">
              We use necessary cookies to make the site work, and optional analytics cookies to improve
              your experience. No data is ever sold.{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </Link>
            </p>

            {/* Expanded preferences */}
            {expanded && (
              <div className="mt-3 space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                {/* Necessary — always on */}
                <label className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    <span className="font-medium">Necessary</span>
                    <span className="text-muted-foreground ml-1">— session, auth, rate limiting</span>
                  </span>
                  <input type="checkbox" checked disabled className="accent-primary cursor-not-allowed opacity-60" />
                </label>

                {/* Analytics */}
                <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                  <span>
                    <span className="font-medium">Analytics</span>
                    <span className="text-muted-foreground ml-1">— page views, scan counts (anonymised)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={e => setAnalytics(e.target.checked)}
                    className="accent-primary cursor-pointer"
                  />
                </label>

                {/* Marketing */}
                <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                  <span>
                    <span className="font-medium">Marketing</span>
                    <span className="text-muted-foreground ml-1">— personalised content (currently unused)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={e => setMarketing(e.target.checked)}
                    className="accent-primary cursor-pointer"
                  />
                </label>
              </div>
            )}

            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {expanded ? 'Hide preferences' : 'Manage preferences'}
            </button>
          </div>

          {/* Buttons */}
          <div className="flex flex-shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
            <button
              onClick={acceptAll}
              className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Accept all
            </button>
            {expanded ? (
              <button
                onClick={savePreferences}
                className="rounded-md border border-border px-4 py-2 text-xs font-medium hover:bg-muted transition-colors"
              >
                Save preferences
              </button>
            ) : (
              <button
                onClick={rejectAll}
                className="rounded-md border border-border px-4 py-2 text-xs font-medium hover:bg-muted transition-colors"
              >
                Reject optional
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Hook to check if a specific consent category has been granted */
export function useConsent(category: 'analytics' | 'marketing'): boolean {
  const [granted, setGranted] = useState(false)

  useEffect(() => {
    const stored = getStoredConsent()
    setGranted(stored?.given ? stored[category] : false)
  }, [category])

  return granted
}
