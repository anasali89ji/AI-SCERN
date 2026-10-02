import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface VerifyResult {
  verified?: boolean
  seal_number?: string
  issued_at?: string
  scan?: {
    id: string
    verdict: string
    confidence: number
    media_type: string
    content_preview?: string
    file_name?: string
    scanned_at: string
  }
  site_scan?: {
    origin: string
    report_summary: Record<string, unknown>
  }
  signature?: string
  payload_hash?: string
  error?: string
  message?: string
  revoked?: boolean
  revoked_at?: string
  revoke_reason?: string
  expired?: boolean
  expired_at?: string
  notFound?: boolean
}

async function fetchSeal(seal: string): Promise<VerifyResult> {
  try {
    const res = await fetch(`${API_BASE}/api/verify/seal/${seal}`, {
      cache: 'no-store',
    })
    if (!res.ok) {
      if (res.status === 404) return { verified: false, notFound: true }
      if (res.status === 400) {
        const data = await res.json()
        return { verified: false, error: data.error, message: data.message }
      }
      return { verified: false, error: 'FETCH_FAILED' }
    }
    return await res.json()
  } catch {
    return { verified: false, error: 'NETWORK_ERROR' }
  }
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value && value !== '0') return null
  return (
    <div className="flex justify-between py-3">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className={`text-sm text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

/**
 * Module 5.5: Public seal verification page — shows the scan result
 * for a given seal number. No auth required.
 */
export default async function VerifySealPage({
  params,
}: {
  params: Promise<{ seal: string }>
}) {
  const { seal } = await params

  if (!seal) return notFound()

  const data = await fetchSeal(seal.toUpperCase())

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12">
      <div className="mx-auto max-w-2xl px-4">
        {/* Header */}
        <header className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <span className="text-2xl font-bold text-emerald-500">AISCERN</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Seal Verification</h1>
        </header>

        {/* Seal number display */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-200">
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Seal Number
            </label>
            <div className="font-mono text-lg bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 tracking-wider">
              {seal}
            </div>
          </div>

          {/* Verified result */}
          {data.verified === true && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <svg className="w-8 h-8 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="text-lg font-semibold text-green-900">Verified</span>
                  <p className="text-sm text-green-700">This seal is authentic and valid.</p>
                </div>
              </div>

              <dl className="divide-y divide-slate-100 border border-slate-200 rounded-lg px-4">
                {data.scan && (
                  <>
                    <Row label="Scan Type" value={data.scan.media_type} />
                    <Row label="Verdict" value={data.scan.verdict} />
                    <Row label="Confidence" value={`${Math.round((data.scan.confidence ?? 0) * 100)}%`} />
                    {data.scan.file_name && <Row label="File" value={data.scan.file_name} />}
                    <Row label="Scanned At" value={new Date(data.scan.scanned_at).toLocaleString()} />
                  </>
                )}
                {data.site_scan && (
                  <>
                    <Row label="Site Scanned" value={data.site_scan.origin} />
                    <Row label="Pages Scanned" value={String(data.site_scan.report_summary?.pagesScanned ?? '-')} />
                    <Row label="AI Content %" value={`${data.site_scan.report_summary?.aiContentPercent ?? '-'}%`} />
                  </>
                )}
                <Row label="Seal Issued" value={data.issued_at ? new Date(data.issued_at).toLocaleString() : '-'} />
                {data.signature && <Row label="Signature" value={data.signature.slice(0, 16) + '...'} mono />}
              </dl>
            </div>
          )}

          {/* Revoked */}
          {data.revoked === true && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="text-lg font-semibold text-red-900">Revoked</span>
                  <p className="text-sm text-red-700">
                    {data.revoke_reason || 'This seal has been revoked.'}
                  </p>
                  {data.revoked_at && (
                    <p className="text-xs text-red-500 mt-1">
                      Revoked: {new Date(data.revoked_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Expired */}
          {data.expired === true && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="text-lg font-semibold text-amber-900">Expired</span>
                  <p className="text-sm text-amber-700">This seal has expired.</p>
                  {data.expired_at && (
                    <p className="text-xs text-amber-500 mt-1">
                      Expired: {new Date(data.expired_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Not found */}
          {(data.notFound || data.error === 'NOT_FOUND') && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="text-lg font-semibold text-slate-900">Not Found</span>
                  <p className="text-sm text-slate-600">
                    No scan found with this seal number. It may have been revoked
                    or never issued.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Invalid format / checksum */}
          {(data.error === 'INVALID_FORMAT' || data.error === 'INVALID_CHECKSUM') && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="text-lg font-semibold text-red-900">Invalid Seal</span>
                  <p className="text-sm text-red-700">{data.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
            <Link href="/verify" className="hover:text-slate-600 transition-colors">
              ← Verify another seal
            </Link>
            <span>AISCERN Forensic Scanner</span>
          </div>
        </div>
      </div>
    </main>
  )
}
