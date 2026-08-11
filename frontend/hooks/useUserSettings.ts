/**
 * useUserSettings — F.2 read side
 *
 * Provides a thin, cached settings reader for any page that needs to react
 * to user settings (results display, detect pages, history).
 *
 * Reads from:
 *   1. localStorage cache (instant, zero flicker)
 *   2. /api/user/settings (authoritative, fires once on first mount)
 *
 * Does NOT write — use patchSettings() from the settings page for writes.
 * Does NOT require the user to be on the settings page — import and use
 * anywhere in the dashboard.
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { SETTINGS_DEFAULTS, type UserSettings } from '@/lib/settings/types'

let _cache: UserSettings | null = null
let _fetching = false
const _listeners = new Set<(s: UserSettings) => void>()

function notify(s: UserSettings) {
  _cache = s
  _listeners.forEach(fn => fn(s))
}

async function fetchSettings(uid?: string) {
  if (_fetching) return
  _fetching = true
  try {
    // Try localStorage cache first
    if (uid) {
      const raw = localStorage.getItem(`aiscern_settings_cache_${uid}`)
      if (raw) { try { notify({ ...SETTINGS_DEFAULTS, ...JSON.parse(raw) }) } catch {} }
    }
    const res = await fetch('/api/user/settings')
    if (res.ok) {
      const { settings } = await res.json() as { settings: UserSettings }
      notify({ ...SETTINGS_DEFAULTS, ...settings })
      if (uid) localStorage.setItem(`aiscern_settings_cache_${uid}`, JSON.stringify(settings))
    }
  } catch { /* use cache */ } finally {
    _fetching = false
  }
}

export function useUserSettings(uid?: string): UserSettings {
  const [settings, setSettings] = useState<UserSettings>(() => {
    // Immediate hydration from in-memory cache or localStorage
    if (_cache) return _cache
    if (uid) {
      try {
        const raw = localStorage.getItem(`aiscern_settings_cache_${uid}`)
        if (raw) return { ...SETTINGS_DEFAULTS, ...JSON.parse(raw) }
      } catch {}
    }
    return SETTINGS_DEFAULTS
  })

  const update = useCallback((s: UserSettings) => setSettings({ ...s }), [])

  useEffect(() => {
    _listeners.add(update)
    // Only fetch if we don't already have a fresh cache
    if (!_cache) void fetchSettings(uid)
    else update(_cache)
    return () => { _listeners.delete(update) }
  }, [uid, update])

  return settings
}
