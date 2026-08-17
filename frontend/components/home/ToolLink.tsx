'use client'

import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'

export function ToolLink({ href, title, children }: {
  href: string
  title: string
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const target = (!user && (href === '/chat' || href === '/batch')) ? '/signup' : href
  return <Link href={target} title={title}>{children}</Link>
}
