'use client'
import nextDynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar, { type TabId } from './components/Sidebar'
import Topbar from './components/Topbar'
import ErrorBoundary from './components/ErrorBoundary'
import { ShimmerCard } from './components/ShimmerBlock'

const TabLoader = () => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6">
    {Array(8).fill(0).map((_, i) => <ShimmerCard key={i} />)}
  </div>
)

const OverviewTab      = nextDynamic(() => import('./tabs/OverviewTab'),      { ssr: false, loading: TabLoader })
const AnalyticsTab     = nextDynamic(() => import('./tabs/AnalyticsTab'),     { ssr: false, loading: TabLoader })
const MarketingTab     = nextDynamic(() => import('./tabs/MarketingTab'),     { ssr: false, loading: TabLoader })
const RevenueTab       = nextDynamic(() => import('./tabs/RevenueTab'),       { ssr: false, loading: TabLoader })
const UsersTab         = nextDynamic(() => import('./tabs/UsersTab'),         { ssr: false, loading: TabLoader })
const SupportTab       = nextDynamic(() => import('./tabs/SupportTab'),       { ssr: false, loading: TabLoader })
const ApiKeysTab       = nextDynamic(() => import('./tabs/ApiKeysTab'),       { ssr: false, loading: TabLoader })
const PipelineTab      = nextDynamic(() => import('./tabs/PipelineTab'),      { ssr: false, loading: TabLoader })
const FlagsTab         = nextDynamic(() => import('./tabs/FlagsTab'),         { ssr: false, loading: TabLoader })
const AnnouncementsTab = nextDynamic(() => import('./tabs/AnnouncementsTab'), { ssr: false, loading: TabLoader })
const HealthTab        = nextDynamic(() => import('./tabs/HealthTab'),        { ssr: false, loading: TabLoader })
const ErrorsTab        = nextDynamic(() => import('./tabs/ErrorsTab'),        { ssr: false, loading: TabLoader })
const AuditTab         = nextDynamic(() => import('./tabs/AuditTab'),         { ssr: false, loading: TabLoader })
const SettingsTab      = nextDynamic(() => import('./tabs/SettingsTab'),      { ssr: false, loading: TabLoader })

const TAB_MAP: Record<TabId, React.ComponentType> = {
  overview:      OverviewTab,
  analytics:     AnalyticsTab,
  marketing:     MarketingTab,
  revenue:       RevenueTab,
  users:         UsersTab,
  support:       SupportTab,
  apikeys:       ApiKeysTab,
  pipeline:      PipelineTab,
  flags:         FlagsTab,
  announcements: AnnouncementsTab,
  health:        HealthTab,
  errors:        ErrorsTab,
  audit:         AuditTab,
  settings:      SettingsTab,
}

const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview', analytics: 'Analytics', marketing: 'Marketing', revenue: 'Revenue',
  users: 'Users', support: 'Support Tickets', apikeys: 'API Keys', pipeline: 'Pipeline',
  flags: 'Feature Flags', announcements: 'Announcements', health: 'Health Monitor',
  errors: 'Error Logs', audit: 'Audit Log', settings: 'Settings',
}

export default function DashboardPage() {
  const [tab, setTab] = useState<TabId>('overview')
  const router        = useRouter()

  const logout = useCallback(async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
  }, [router])

  const TabComponent = TAB_MAP[tab]

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar active={tab} onSelect={setTab} onLogout={logout} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar activeTab={tab} />
        <main id="main-content" className="flex-1 overflow-y-auto p-6" tabIndex={-1}>
          <a href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50
              focus:px-4 focus:py-2 focus:rounded-xl focus:bg-primary focus:text-white focus:text-sm focus:font-semibold">
            Skip to content
          </a>
          <ErrorBoundary tabName={TAB_LABELS[tab]}>
            <TabComponent />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
