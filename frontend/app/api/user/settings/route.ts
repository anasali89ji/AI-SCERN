/**
 * /api/user/settings — real per-user settings storage for the Settings page.
 * Uses Clerk auth + admin client to bypass Supabase RLS (see lib/supabase/admin.ts).
 * Backed by the `user_settings` table (supabase/migrations/v30_user_settings.sql).
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_SETTINGS = {
  emailNotif: true, batchAlerts: true, weeklyReport: false, autoSave: true, upgradeAlerts: true,
  highAccMode: false, saveHistory: true, autoDownload: false, showConfidence: true, showSignals: true,
  defaultModality: 'text',
  publicProfile: false, shareAnon: true, analyticsOptOut: false, dataRetention: '90',
  theme: 'dark', language: 'en', compactView: false, animationsOff: false,
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getSupabaseAdmin()
    const { data, error } = await db
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[settings GET] Supabase error:', error)
      return NextResponse.json({ settings: DEFAULT_SETTINGS })
    }

    return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) } })
  } catch (err) {
    console.error('[settings GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 })
    }

    const db = getSupabaseAdmin()

    // Merge with whatever is already stored so a partial PATCH never
    // clobbers fields the client didn't send.
    const { data: existing } = await db
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .maybeSingle()

    const merged = { ...DEFAULT_SETTINGS, ...(existing?.settings ?? {}), ...body }

    const { error } = await db
      .from('user_settings')
      .upsert({ user_id: userId, settings: merged }, { onConflict: 'user_id' })

    if (error) {
      console.error('[settings PATCH] Supabase error:', error)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }

    return NextResponse.json({ success: true, settings: merged })
  } catch (err) {
    console.error('[settings PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
