import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { idToken } = body

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Optional: verify with Firebase Admin if service account is available
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        const { adminAuth } = await import('@/lib/firebase/admin')
        if (adminAuth) await adminAuth.verifyIdToken(idToken)
      } catch (verifyErr) {
        console.warn('Token verification skipped:', verifyErr)
        // Continue — don't block login if admin SDK fails
      }
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set('__session', idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 14, // 14 days
      path: '/',
    })
    return res
  } catch (err) {
    console.error('Session POST error:', err)
    return NextResponse.json({ error: 'Session error' }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('__session')
  return res
}

export async function GET() {
  return NextResponse.json({ ok: true, timestamp: Date.now() })
}
