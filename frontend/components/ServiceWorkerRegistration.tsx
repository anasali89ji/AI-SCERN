'use client'
import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return  // only in prod

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        // Check for updates every 60 minutes
        setInterval(() => reg.update(), 60 * 60 * 1000)
      })
      .catch(() => {})  // fail silently — SW is enhancement only
  }, [])

  return null
}
