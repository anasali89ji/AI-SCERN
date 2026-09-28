import { Suspense } from 'react'
import MaintenanceContent from './MaintenanceContent'

export const metadata = {
  title: 'Under Maintenance | Aiscern',
  robots: { index: false, follow: false },
}

export default function MaintenancePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="animate-pulse w-8 h-8 rounded-full bg-blue-500/30" />
      </div>
    }>
      <MaintenanceContent />
    </Suspense>
  )
}
