import Link from 'next/link'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

/**
 * Module 5.5: Public seal verification page (search form).
 * No auth required — this is the public-facing page where users enter
 * a seal number to verify a scan.
 */
export default function VerifySearchPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-2xl px-4 py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-2xl font-bold text-emerald-500">AISCERN</span>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            Seal Verification
          </h1>
          <p className="text-slate-600 max-w-md mx-auto">
            Enter your seal number to verify the authenticity of an AISCERN
            forensic scan. Every scan we perform is issued a signed,
            tamper-proof seal.
          </p>
        </div>

        {/* Search form */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
          <form action="/verify" method="GET" className="space-y-4">
            <div>
              <label htmlFor="seal" className="block text-sm font-medium text-slate-700 mb-2">
                Seal Number
              </label>
              <input
                type="text"
                id="seal"
                name="seal"
                placeholder="ASC-XXXXXXXX-XX"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-lg font-mono uppercase tracking-wider focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                pattern="ASC-[A-Z2-7]{8}-[A-Z0-9]{2}"
                title="Format: ASC-XXXXXXXX-XX (e.g. ASC-7K3X9P2Q-4F)"
                required
              />
              <p className="mt-2 text-xs text-slate-500">
                Format: ASC-XXXXXXXX-XX (found on your scan result page)
              </p>
            </div>
            <button
              type="submit"
              className="w-full py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors"
            >
              Verify Seal
            </button>
          </form>
        </div>

        {/* Info section */}
        <div className="mt-8 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-blue-900 mb-1">
              What is a seal number?
            </h2>
            <p className="text-sm text-blue-700">
              Every AISCERN scan (text, image, audio, or site scan) is issued
              a unique, HMAC-signed seal number. This proves the scan was
              performed by our system and hasn&apos;t been tampered with.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-amber-900 mb-1">
              Security note
            </h2>
            <p className="text-sm text-amber-700">
              Seal numbers are cryptographically signed. A forged seal number
              will fail the checksum verification before reaching the database.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
