import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-center px-6">
      <div>
        <Image
          src="/logo.png"
          alt="Aiscern"
          width={80}
          height={55}
          className="mx-auto mb-6 object-contain drop-shadow-[0_0_20px_rgba(245,100,0,0.4)]"
        />
        <h1 className="text-8xl font-black gradient-text mb-4">404</h1>
        <h2 className="text-2xl font-bold text-text-primary mb-3">Page Not Found</h2>
        <p className="text-text-muted mb-8 max-w-sm mx-auto">
          This page doesn&apos;t exist. Let&apos;s get you back to detecting AI content.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-primary px-6 py-3">← Back to Home</Link>
          <Link href="/detect/text" className="btn-secondary px-6 py-3">Try Text Detector</Link>
        </div>
      </div>
    </div>
  )
}
