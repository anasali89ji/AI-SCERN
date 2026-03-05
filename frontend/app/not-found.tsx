import Link from 'next/link'
import { Shield } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-center px-6">
      <div>
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
          <Shield className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-8xl font-black gradient-text mb-4">404</h1>
        <h2 className="text-2xl font-bold text-text-primary mb-3">Page Not Found</h2>
        <p className="text-text-muted mb-8 max-w-sm mx-auto">The page you are looking for does not exist or has been moved.</p>
        <Link href="/" className="btn-primary px-8 py-3 inline-flex">← Back to Home</Link>
      </div>
    </div>
  )
}
