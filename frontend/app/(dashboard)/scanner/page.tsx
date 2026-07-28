// ════════════════════════════════════════════════════════════════════════════
// AISCERN — /scanner route consolidation (Module 8)
//
// This route and /scraper were two separate, near-duplicate implementations
// of the same Web Scanner UI (both called /api/scanner, both rendered
// SiteScanResult). /scraper is the one linked from primary navigation
// (components/MobileNav.tsx), so it's kept as the canonical page and this
// route now simply redirects old links/bookmarks there instead of
// maintaining two copies of ~700 lines of UI that will inevitably drift.
// ════════════════════════════════════════════════════════════════════════════
import { redirect } from 'next/navigation'

export default function ScannerRedirect() {
  redirect('/scraper')
}
