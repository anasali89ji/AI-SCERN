'use client'
import Link from 'next/link'
import { Lock, ArrowLeft, Home } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-xl bg-[#FF4444]/10 border border-[#FF4444]/20 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-rose-400" />
        </div>
        <h1 className="text-3xl font-black text-white mb-3">Access Restricted</h1>
        <p className="text-[#6B6B6B] mb-2">Your current role does not have permission to view this page.</p>
        <p className="text-sm text-[#6B6B6B] mb-8">
          Contact <a href="mailto:contact@aiscern.com" className="text-[#2BEE34] hover:underline">contact@aiscern.com</a> to request access.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/admin" className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#1E1E1E] text-[#6B6B6B] hover:text-white hover:border-[#2BEE34]/50 transition-all text-sm font-medium">
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
