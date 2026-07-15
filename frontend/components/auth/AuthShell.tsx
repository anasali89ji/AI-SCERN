'use client'

import { useAuth } from '@/components/auth-provider'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

const PUBLIC_PATHS = ['/', '/login', '/signup', '/pricing', '/about', '/contact', '/faq', '/terms', '/privacy', '/security', '/roadmap']

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith('/blog/') || pathname.startsWith('/docs/') || pathname.startsWith('/compare/') || pathname.startsWith('/guides/'))

  useEffect(() => {
    if (!isLoaded) return
    if (!user && !isPublic) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [isLoaded, user, isPublic, pathname, router])

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    )
  }

  if (!user && !isPublic) return null

  return <>{children}</>
}
