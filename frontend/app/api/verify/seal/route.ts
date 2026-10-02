import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/verify/seal (without sealNumber param)
 *
 * Module 5.4: Returns a helpful error directing users to use
 * /api/verify/seal/[sealNumber] or the /verify page to search.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    verified: false,
    error: 'SEAL_NUMBER_REQUIRED',
    message: 'Provide a seal number: /api/verify/seal/ASC-XXXXXXXX-XX',
    verify_page: '/verify',
  }, { status: 400 })
}
