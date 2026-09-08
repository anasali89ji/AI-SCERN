'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Scan, Users, DollarSign, Megaphone,
  Landmark, HeadphonesIcon, Code2, ChevronLeft, ChevronRight,
  LogOut, RefreshCw, Menu
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { useClerk } from '@clerk/nextjs'

const ADMIN_ROLES = new Set(['ADMIN', 'OWNER', 'EXECUTIVE', 'MANAGER', 'ANALYST', 'MARKETING', 'SUPPORT'])

const NAV = [
  { href: '/admin',            label: 'Overview',          icon: LayoutDashboard, role: 'MANAGER'   },
  { href: '/admin/detections', label: 'Detection Analytics',icon: Scan,           role: 'ANALYST'   },
  { href: '/admin/users',      label: 'User Growth',       icon: Users,           role: 'MANAGER'   },
  { href: '/admin/sales',      label: 'Sales & Revenue',   icon: DollarSign,      role: 'MANAGER'   },
  { href: '/admin/marketing',  label: 'Marketing',         icon: Megaphone,       role: 'MARKETING' },
  { href: '/admin/finance',    label: 'Financial',         icon: Landmark,        role: 'EXECUTIVE' },
  { href: '/admin/support',    label: 'Support',           icon: HeadphonesIcon,  role: 'SUPPORT'   },
  { href: '/admin/api-usage',  label: 'API Usage',         icon: Code2,           role: 'ANALYST'   },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname          = usePathname()
  const { user }          = useAuth()
  const { signOut }       = useClerk()
  const router            = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // BUG-14 FIX: Client-side role guard — redirect before any admin UI renders.
  // API routes also verify admin via verifyAdmin(), but this prevents the UI shell
  // from being visible to non-admins even for a frame.
  useEffect(() => {
    if (!user) return // still loading
    const role = ((user as any)?.publicMetadata?.role as string | undefined)?.toUpperCase() ?? ''
    const allowedIds = (process.env.NEXT_PUBLIC_ADMIN_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (!ADMIN_ROLES.has(role) && !allowedIds.includes((user as any)?.id ?? '')) {
      router.replace('/unauthorized')
    }
  }, [user, router])

  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-2 px-4 py-5 border-b border-white/[0.08] ${collapsed ? 'justify-center' : ''}`}>
        <img src="/logo.png" alt="Aiscern" width={32} height={32} className="rounded-lg shrink-0" />
        {!collapsed && <span className="font-black text-sm gradient-text">Aiscern Admin</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium
                ${active ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20' : 'text-slate-500 hover:text-slate-100 hover:bg-[#141420]'}`}>
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User + signout */}
      <div className={`border-t border-white/[0.08] p-4 ${collapsed ? 'flex justify-center' : ''}`}>
        {!collapsed && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-100 truncate">{user?.email ?? 'Admin'}</p>
            <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-medium border border-blue-500/20">OWNER</span>
          </div>
        )}
        <button onClick={() => signOut()} className="flex items-center gap-2 text-xs text-slate-500 hover:text-rose-400 transition-colors">
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#08080d] text-slate-100 flex">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col border-r border-white/[0.08] bg-surface/60 transition-all shrink-0 ${collapsed ? 'w-16' : 'w-56 2xl:w-64 3xl:w-72'}`}>
        <SidebarContent />
        <button onClick={() => setCollapsed(c => !c)}
          className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full border border-white/[0.08] bg-[#0f0f17] flex items-center justify-center z-10 hover:bg-[#141420] transition-colors">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-[#0f0f17] border-r border-white/[0.08] z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b border-white/[0.08] bg-[#08080d] flex items-center px-4 gap-3 sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-surface text-slate-500">
            <Menu className="w-4 h-4" />
          </button>
          <span className="font-bold text-sm text-slate-100 hidden sm:block">Aiscern Admin</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-slate-600">Last updated: {now}</span>
            <button onClick={() => window.location.reload()} className="p-2 rounded-lg hover:bg-surface text-slate-500 hover:text-slate-100 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-100 transition-colors">← Site</Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 2xl:p-8 3xl:p-10">
          {children}
        </main>
      </div>
    </div>
  )
}
