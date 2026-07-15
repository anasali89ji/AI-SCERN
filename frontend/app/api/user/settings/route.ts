import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    return NextResponse.json({
      userId,
      notifications: { email: true, push: false, marketing: false },
      display: { theme: 'system', density: 'comfortable', reducedMotion: false },
      privacy: { publicProfile: false, shareHistory: false },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    return NextResponse.json({ success: true, updated: body })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
