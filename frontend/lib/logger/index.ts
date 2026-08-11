type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const entry = { level, service: 'aiscern-api', msg, ...meta, time: new Date().toISOString() };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (service: string, message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
    }
  },

  info: (service: string, message: string, data?: Record<string, unknown>) => {
  },

  warn: (service: string, message: string, data?: Record<string, unknown>) => {
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
