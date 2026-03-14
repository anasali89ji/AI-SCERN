import { NextRequest, NextResponse } from 'next/server'
import { analyzeText } from '@/lib/inference/hf-analyze'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'


export async function POST(req: NextRequest) {
  // API key authentication (Pro+ users)
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json({ error: 'X-API-Key header required', docs: '/docs/api' }, { status: 401 })
  }

  // Look up user by API key
  const { data: profile } = await getSupabaseAdmin()
    .from('profiles')
    .select('id, plan_id, credits_remaining')
    .eq('api_key', apiKey)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  // Check plan allows API access
  const planAllowsApi = ['pro', 'enterprise'].includes(profile.plan_id)
  if (!planAllowsApi) {
    return NextResponse.json({ error: 'API access requires Pro or Enterprise plan', upgradeUrl: '/pricing' }, { status: 403 })
  }

  // Consume credit atomically
  const { data: creditResult } = await getSupabaseAdmin().rpc('consume_credit', {
    p_user_id: profile.id, p_scan_type: 'text_api', p_scan_id: null
  })
  if (!creditResult?.ok) {
    return NextResponse.json({
      error: 'Credits exhausted',
      code: 'CREDITS_EXHAUSTED',
      creditsRemaining: 0,
      upgradeUrl: '/pricing',
    }, { status: 402 })
  }

  const { text } = await req.json()
  if (!text || text.length < 50) return NextResponse.json({ error: 'text must be at least 50 characters' }, { status: 400 })
  if (text.length > 10000) return NextResponse.json({ error: 'text must be under 10,000 characters' }, { status: 400 })

  const start  = Date.now()
  const result = await analyzeText(text)

  return NextResponse.json({
    verdict:          result.verdict,
    confidence:       result.confidence,
    signals:          result.signals,
    processing_time:  Date.now() - start,
    credits_remaining: creditResult.balance,
  })
}
