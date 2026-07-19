import { NextResponse } from 'next/server'

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1'

export async function GET() {
  const apiKey = process.env.NVIDIA_API_KEY || ''
  const apiKeyFallback = process.env.NVIDIA_API_KEY_FALLBACK || process.env.NVIDIA_API_KEY_2 || ''

  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nvidia_primary_key_set: !!apiKey,
    nvidia_fallback_key_set: !!apiKeyFallback,
    nvidia_primary_connected: false,
    nvidia_fallback_connected: false,
    nvidia_primary_error: null,
    nvidia_fallback_error: null,
    models_available: 0,
  }

  async function testKey(key: string, label: string) {
    if (!key) return { ok: false, error: 'Key not configured' }
    try {
      const res = await fetch(`${NVIDIA_BASE}/models`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        const text = await res.text()
        return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
      }
      const data = await res.json()
      return { ok: true, models: data.data?.length || 0 }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  const [primary, fallback] = await Promise.all([
    testKey(apiKey, 'primary'),
    testKey(apiKeyFallback, 'fallback'),
  ])

  checks.nvidia_primary_connected = primary.ok
  checks.nvidia_primary_error = primary.error || null
  checks.nvidia_fallback_connected = fallback.ok
  checks.nvidia_fallback_error = fallback.error || null
  checks.models_available = primary.models || fallback.models || 0

  const allOk = primary.ok || fallback.ok

  return NextResponse.json(checks, { status: allOk ? 200 : 503 })
}
