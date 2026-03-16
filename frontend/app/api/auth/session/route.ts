/**
 * DETECTAI — Session API
 * With Clerk, session management is handled automatically by the SDK.
 * This route is kept for backward compatibility but does nothing.
 * Clerk sets __session cookie via its own middleware.
 */
import { NextResponse } from 'next/server'

export async function POST() {
  // Clerk handles sessions — no manual session creation needed
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  // Clerk handles sign-out client-side via useClerk().signOut()
  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
