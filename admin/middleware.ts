import { NextRequest, NextResponse } from 'next/server'
const COOKIE = 'admin_session'
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  if (path.startsWith('/api/auth') || path === '/') return NextResponse.next()
  if (path.startsWith('/dashboard')) {
    if (!req.cookies.get(COOKIE)?.value) return NextResponse.redirect(new URL('/', req.url))
  }
  return NextResponse.next()
}
export const config = { matcher: ['/dashboard/:path*', '/api/:path*'] }
