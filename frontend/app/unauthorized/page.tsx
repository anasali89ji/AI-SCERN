'use client'
import Link from 'next/link'
import { Lock, ArrowLeft, Home } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#08080d] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-xl bg-rose-500-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-rose-400" />
        </div>
        <h1 className="text-3xl font-black text-slate-100 mb-3">Access Restricted</h1>
        <p className="text-slate-500 mb-2">Your current role does not have permission to view this page.</p>
        <p className="text-sm text-slate-600 mb-8">
          Contact <a href="mailto:contact@aiscern.com" className="text-blue-500 hover:underline">contact@aiscern.com</a> to request access.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/admin" className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/[0.08] text-slate-500 hover:text-slate-100 hover:border-blue-500/50 transition-all text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />Back to Dashboard
          </Link>
          <Link href="/" className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl btn-primary text-sm font-medium">
            <Home className="w-4 h-4" />Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
