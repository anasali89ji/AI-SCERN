'use client'
/**
 * UsageLimitBanner — OPEN SOURCE MODE
 * All limits removed. This component is kept as a no-op stub so existing
 * imports don't break. The site is free and open — no scan limits.
 */

type Tool = 'text' | 'image' | 'audio' | 'video'

// No-op: renders nothing — no more usage limits or upgrade prompts
export function UsageLimitBanner({ _tool, _isPro = false }: { _tool: Tool; _isPro?: boolean }) {
  return null
}

// No-op stubs — kept so existing call sites don't break
export function incrementUsage(_tool: Tool) {}
export function isLimitReached(_tool: Tool): boolean { return false }
