'use client'
import Link from 'next/link'
import { Lock, ArrowLeft, Home } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-3xl bg-rose/10 border border-rose/20 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-rose" />
        </div>
        <h1 className="text-3xl font-semibold font-display text-text-primary mb-3">Access Restricted</h1>
        <p className="text-text-muted mb-2">Your current role does not have permission to view this page.</p>
        <p className="text-sm text-text-disabled mb-8">
          Contact <a href="mailto:contact@aiscern.com" className="text-primary hover:underline">contact@aiscern.com</a> to request access.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/admin" className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-text-muted hover:text-text-primary hover:border-primary/50 transition-all text-sm font-medium">
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
