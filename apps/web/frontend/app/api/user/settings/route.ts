/**
 * /api/user/settings — GET/PATCH for user_settings table (Module F)
 *
 * Source of truth: Supabase user_settings table (v17 migration).
 * localStorage is used as a read-cache on the client only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@clerk/nextjs/server'
import { getSupabaseAdmin }          from '@/lib/supabase/admin'
import { SETTINGS_DEFAULTS, type UserSettings } from '@/lib/settings/types'

export const dynamic = 'force-dynamic'

// ── Validation ────────────────────────────────────────────────────────────────
function validatePatch(body: Record<string, unknown>): Partial<UserSettings> {
  const patch: Partial<UserSettings> = {}
  const bools: (keyof UserSettings)[] = [
    'email_notif','batch_alerts','weekly_report','auto_save','upgrade_alerts',
    'high_acc_mode','save_history','auto_download_pdf','show_confidence','show_signals',
    'public_profile','share_anon','analytics_opt_out','compact_view','animations_off',
  ]
  for (const k of bools) {
    if (k in body && typeof body[k] === 'boolean') (patch as Record<string, unknown>)[k] = body[k]
  }
  if ('default_modality' in body && ['text','image','audio','video','url'].includes(body.default_modality as string)) {
    patch.default_modality = body.default_modality as UserSettings['default_modality']
  }
  if ('data_retention_days' in body && [30,90,365,-1].includes(body.data_retention_days as number)) {
    patch.data_retention_days = body.data_retention_days as UserSettings['data_retention_days']
  }
  if ('theme' in body && ['dark','light','system'].includes(body.theme as string)) {
    patch.theme = body.theme as UserSettings['theme']
  }
  if ('language' in body && ['en','ur','ar','es','fr'].includes(body.language as string)) {
    patch.language = body.language as UserSettings['language']
  }
  return patch
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseAdmin()
  const { data } = await db
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  const settings: UserSettings = { ...SETTINGS_DEFAULTS, ...(data ?? {}) }
  // Strip Supabase meta columns
  const { user_id: _u, created_at: _c, updated_at: _up, ...clean } = settings as UserSettings & Record<string, unknown>
  void _u; void _c; void _up
  return NextResponse.json({ settings: clean })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const patch = validatePatch(body)

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'No valid fields in body' }, { status: 400 })
  }

  const db = getSupabaseAdmin()
  const { error } = await db
    .from('user_settings')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mirror public_profile + analytics_opt_out back to profiles (legacy compat)
  if ('public_profile' in patch || 'analytics_opt_out' in patch) {
    try {
      await db.from('profiles').update({
        ...(patch.public_profile    !== undefined ? { public_profile:    patch.public_profile }    : {}),
        ...(patch.analytics_opt_out !== undefined ? { analytics_opt_out: patch.analytics_opt_out } : {}),
      }).eq('id', userId)
    } catch { /* non-fatal mirror */ }
  }

  return NextResponse.json({ success: true })
}
