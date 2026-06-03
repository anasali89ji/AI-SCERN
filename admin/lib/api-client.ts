export async function api<T = unknown>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
  options?: { timeout?: number }
): Promise<T> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), options?.timeout ?? 15000)
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    clearTimeout(id)
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>
      throw new Error((err.error as string) || `${res.status} ${res.statusText}`)
    }
    return res.json() as Promise<T>
  } catch (e) {
    clearTimeout(id)
    throw e
  }
}

// Typed SWR-compatible fetcher factory
export function typedFetcher<T>() {
  return (path: string) => api<T>(path)
}
