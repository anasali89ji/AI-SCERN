'use client'
import { useState, Suspense, lazy } from 'react'
import Sidebar, { TabId } from './components/Sidebar'
import Topbar from './components/Topbar'
import ErrorBoundary from './components/ErrorBoundary'

const OverviewTab = lazy(() => import('./tabs/OverviewTab'))
const AnalyticsTab = lazy(() => import('./tabs/AnalyticsTab'))
const MarketingTab = lazy(() => import('./tabs/MarketingTab'))
const RevenueTab = lazy(() => import('./tabs/RevenueTab'))
const UsersTab = lazy(() => import('./tabs/UsersTab'))
const SupportTab = lazy(() => import('./tabs/SupportTab'))
const ApiKeysTab = lazy(() => import('./tabs/ApiKeysTab'))
const PipelineTab = lazy(() => import('./tabs/PipelineTab'))
const FlagsTab = lazy(() => import('./tabs/FlagsTab'))
const AnnouncementsTab = lazy(() => import('./tabs/AnnouncementsTab'))
const NotificationsTab = lazy(() => import('./tabs/NotificationsTab'))
const HealthTab = lazy(() => import('./tabs/HealthTab'))
const PipelineCostSummaryTab = lazy(() => import('./tabs/PipelineCostSummaryTab'))
const ErrorsTab = lazy(() => import('./tabs/ErrorsTab'))
const AuditTab = lazy(() => import('./tabs/AuditTab'))
const SettingsTab = lazy(() => import('./tabs/SettingsTab'))
const ScansTab = lazy(() => import('./tabs/ScansTab'))
const ContentModerationTab = lazy(() => import('./tabs/ContentModerationTab'))
const WebhooksTab = lazy(() => import('./tabs/WebhooksTab'))
const RateLimitsTab = lazy(() => import('./tabs/RateLimitsTab'))
const BackupTab = lazy(() => import('./tabs/BackupTab'))
const AdminUsersTab = lazy(() => import('./tabs/AdminUsersTab'))
const BrandingTab = lazy(() => import('./tabs/BrandingTab'))
const MaintenanceTab = lazy(() => import('./tabs/MaintenanceTab'))

const TABS: Record<TabId, React.ComponentType> = {
  overview: OverviewTab, analytics: AnalyticsTab, marketing: MarketingTab, revenue: RevenueTab,
  users: UsersTab, support: SupportTab, apikeys: ApiKeysTab, pipeline: PipelineTab,
  flags: FlagsTab, announcements: AnnouncementsTab, notifications: NotificationsTab, health: HealthTab,
  costsummary: PipelineCostSummaryTab, errors: ErrorsTab, audit: AuditTab, settings: SettingsTab,
  scans: ScansTab, 'content-moderation': ContentModerationTab, webhooks: WebhooksTab,
  'rate-limits': RateLimitsTab, backup: BackupTab, 'admin-users': AdminUsersTab,
  branding: BrandingTab, maintenance: MaintenanceTab,
}

function TabFallback() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-surface rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {Array(4).fill(0).map((_, i) => <div key={i} className="h-24 bg-surface rounded-xl border border-border" />)}
      </div>
      <div className="h-64 bg-surface rounded-xl border border-border" />
    </div>
  )
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const ActiveComponent = TABS[activeTab]

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <div className="flex h-screen bg-[#0a0a12] text-white overflow-hidden">
      <Sidebar active={activeTab} onSelect={setActiveTab} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar activeTab={activeTab} />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary tabName={activeTab}>
            <Suspense fallback={<TabFallback />}>
              <ActiveComponent />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
