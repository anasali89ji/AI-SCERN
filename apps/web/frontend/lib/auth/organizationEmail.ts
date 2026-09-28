/**
 * Organization-account email validation.
 *
 * Used to gate the "Organization" account type at signup: an organization
 * account must be created with a work/institution email, not a free
 * consumer webmail address. This file is imported both client-side (for
 * inline UX feedback) and server-side (for the real enforcement) — the
 * client check exists purely to give the person immediate feedback, and
 * must never be trusted as the source of truth. See
 * `frontend/app/api/profiles/update/route.ts` for the server-side check
 * that re-derives the domain from the authenticated Clerk session.
 */

// Common consumer webmail / disposable-email domains. Not exhaustive —
// the goal is to catch the overwhelming majority of personal-email signups,
// not to build a perfect blocklist. New domains can be appended as needed.
export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'ymail.com',
  'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'mail.com', 'gmx.com', 'gmx.us',
  'zoho.com',
  'yandex.com', 'yandex.ru',
  'rediffmail.com',
  'inbox.com',
  'tutanota.com',
  // Disposable / temporary-email providers
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'trashmail.com',
])

export function getEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.lastIndexOf('@')
  if (at === -1) return null
  return email.slice(at + 1).trim().toLowerCase()
}

/**
 * Returns true if the given email's domain looks like a legitimate
 * organization/work domain (i.e. is NOT a known free/consumer/disposable
 * provider). This is a heuristic, not a guarantee — it does not verify
 * the domain resolves, has MX records, or is actually owned by a company.
 */
export function isOrganizationEmail(email: string | null | undefined): boolean {
  const domain = getEmailDomain(email)
  if (!domain) return false
  return !FREE_EMAIL_DOMAINS.has(domain)
}

export const ORG_TYPES = ['corporate', 'hr', 'education'] as const
export type OrgType = typeof ORG_TYPES[number]

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  corporate: 'Corporate / Business',
  hr:        'HR & Recruiting Team',
  education: 'Educational Institution',
}
