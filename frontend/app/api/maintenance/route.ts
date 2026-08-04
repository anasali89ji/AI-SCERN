import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ enabled: false }, { status: 200 })
    }

    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data } = await db
      .from('site_settings')
      .select('key, value')
      .in('key', ['maintenance_enabled', 'maintenance_message', 'maintenance_duration'])

    const settings: Record<string, string> = {}
    for (const row of data || []) {
      settings[row.key] = row.value
    }

    return NextResponse.json({
      enabled: settings.maintenance_enabled === 'true',
      message: settings.maintenance_message || '',
      duration: settings.maintenance_duration || '',
    })
  } catch {
    return NextResponse.json({ enabled: false }, { status: 200 })
  }
}
