import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminPassword, createAdminSession, getClientIp, COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { password, email } = await req.json()
    const ip = getClientIp(req)
    const userAgent = req.headers.get('user-agent') || 'unknown'

    const result = await verifyAdminPassword(password)
    if (!result.valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = await createAdminSession(ip, userAgent, result.adminId, result.email)

    const response = NextResponse.json({ success: true, role: result.role })
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 2 * 60 * 60, // 2 hours
      path: '/',
    })

    return response
  } catch (err: any) {
    console.error('[Auth] Login error:', err)
    return NextResponse.json({ error: err.message || 'Authentication failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const response = NextResponse.json({ success: true })
  response.cookies.set({ name: COOKIE_NAME, value: '', maxAge: 0, path: '/' })
  return response
}
