export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T = unknown>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' = 'GET',
  body?: unknown,
  options?: { timeout?: number; retries?: number }
): Promise<T> {
  const controller = new AbortController()
  const timeout = options?.timeout ?? 15000
  const id = setTimeout(() => controller.abort(), timeout)

  let lastError: Error | null = null
  const retries = options?.retries ?? 1

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`/api${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      clearTimeout(id)

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as Record<string, unknown>
        throw new ApiError(
          (errData.error as string) || `${res.status} ${res.statusText}`,
          res.status,
          errData.code as string
        )
      }
      return res.json() as Promise<T>
    } catch (e) {
      lastError = e as Error
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }

  clearTimeout(id)
  throw lastError
}

export function typedFetcher<T>() {
  return (path: string) => api<T>(path)
}
