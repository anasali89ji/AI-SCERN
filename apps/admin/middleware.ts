import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAdminSession } from './lib/auth'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow login page and auth API
  if (pathname === '/' || pathname === '/api/auth' || pathname.startsWith('/_next') || pathname.startsWith('/api/log-client-error')) {
    return NextResponse.next()
  }

  // Check admin session for all other routes
  const token = req.cookies.get('admin_session')?.value
  const valid = await verifyAdminSession(token)

  if (!valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.png$).*)'],
}
