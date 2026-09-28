import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '7')
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const db = getAdminDb()

  const { data: costs } = await db.from('pipeline_costs').select('*').gte('created_at', since).order('day', { ascending: true })
  const { data: flags } = await db.from('fallback_flags').select('*').order('created_at', { ascending: false }).limit(10)

  const totals: Record<string, Record<string, number>> = {}
  const daily: Record<string, any> = {}

  for (const c of costs || []) {
    if (!totals[c.vendor]) totals[c.vendor] = {}
    totals[c.vendor][c.day] = (totals[c.vendor][c.day] || 0) + c.calls

    if (!daily[c.day]) daily[c.day] = { day: c.day, gemini: 0, nvidia_nim: 0, huggingface: 0 }
    if (c.vendor === 'gemini') daily[c.day].gemini += c.calls
    if (c.vendor === 'nvidia_nim') daily[c.day].nvidia_nim += c.calls
    if (c.vendor === 'huggingface') daily[c.day].huggingface += c.calls
  }

  return NextResponse.json({
    totals,
    daily: Object.values(daily),
    fallback_flags: flags || [],
  })
}
