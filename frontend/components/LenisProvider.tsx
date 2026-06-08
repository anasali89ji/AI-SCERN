'use client'

/**
 * LenisProvider — stub replacement
 * Lenis smooth scroll removed: caused accessibility issues (breaks keyboard
 * navigation and native scroll behaviour). Native CSS scroll-behavior: smooth
 * is set on <html> in globals.css and handles all smooth scrolling needs.
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
