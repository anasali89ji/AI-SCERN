/**
 * DETECTAI — Structured Logger
 * Provides consistent log format across all API routes.
 * In production: sends to Vercel logs + optionally Supabase error_logs table.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level:   LogLevel
  service: string
  message: string
  data?:   Record<string, unknown>
  userId?: string
  ip?:     string
  error?:  Error | unknown
}

function formatLog(entry: LogEntry): string {
  const ts = new Date().toISOString()
  const data = entry.data ? JSON.stringify(entry.data) : ''
  return `[${ts}] [${entry.level.toUpperCase()}] [${entry.service}] ${entry.message}${data ? ' ' + data : ''}`
}

export const logger = {
  debug: (service: string, message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatLog({ level: 'debug', service, message, data }))
    }
  },

  info: (service: string, message: string, data?: Record<string, unknown>) => {
    console.log(formatLog({ level: 'info', service, message, data }))
  },

  warn: (service: string, message: string, data?: Record<string, unknown>) => {
    console.warn(formatLog({ level: 'warn', service, message, data }))
  },

  error: async (
    service: string,
    message: string,
    error?: unknown,
    context: Record<string, unknown> = {},
  ) => {
    const entry: LogEntry = { level: 'error', service, message, error, data: context }
    console.error(formatLog(entry))

    // Persist to Supabase error_logs (best-effort, never throws)
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) {
        const { createClient } = await import('@supabase/supabase-js')
        const sb = createClient(url, key, { auth: { persistSession: false } })
        await sb.from('error_logs').insert({
          service,
          message: message.slice(0, 1000),
          stack_trace: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
          error_code:  error instanceof Error ? error.name : 'UNKNOWN',
          context,
        })
      }
    } catch { /* never throw from logger */ }
  },
}
