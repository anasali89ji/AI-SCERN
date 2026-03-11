import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from './lib/auth'

const PROTECTED = ['/dashboard']
const PUBLIC    = ['/', '/api/auth']

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  if (path.startsWith('/_next') || path === '/favicon.ico') return NextResponse.next()
  if (PUBLIC.some(p => path.startsWith(p))) return NextResponse.next()

  if (PROTECTED.some(p => path.startsWith(p))) {
    const token = req.cookies.get('admin_session')?.value
    const valid = await verifyAdminSession(token)
    if (!valid) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
