'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'

const ROLE_LEVEL: Record<string, number> = {
  USER: 0, SUPPORT: 1, MARKETING: 2, ANALYST: 3, MANAGER: 4, EXECUTIVE: 5, OWNER: 6,
}

export function RoleGuard({ required, children }: { required: string; children: React.ReactNode }) {
  const { user } = useAuth()
  const router   = useRouter()
  // Role from Clerk publicMetadata — defaults to USER (not OWNER) for safety
  const role = (user as any)?.publicMetadata?.role?.toUpperCase() ?? 'USER'

  useEffect(() => {
    if ((ROLE_LEVEL[role] ?? 0) < (ROLE_LEVEL[required] ?? 0)) {
      router.replace('/unauthorized')
    }
  }, [role, required, router])

  return <>{children}</>
}
