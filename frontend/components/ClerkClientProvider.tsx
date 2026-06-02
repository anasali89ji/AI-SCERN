'use client'
/**
 * ClerkClientProvider — isolates ClerkProvider inside a client boundary.
 *
 * Why this file exists:
 *   app/layout.tsx is a Server Component (no 'use client').
 *   next/dynamic with ssr:false cannot be used in Server Components.
 *   Solution: move ClerkProvider into this dedicated 'use client' wrapper.
 *   layout.tsx imports this component statically — the 'use client' boundary
 *   causes Next.js to hydrate Clerk only on the client, achieving the same
 *   TBT benefit without the build error.
 */
import { ClerkProvider } from '@clerk/nextjs'

interface Props {
  children: React.ReactNode
  publishableKey: string
}

export function ClerkClientProvider({ children, publishableKey }: Props) {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/login"
      signUpUrl="/signup"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
      // Required so Google OAuth (and all other OAuth providers) can complete.
      // Without this, Clerk redirects to /sso-callback which must exist as a page.
      // That page renders <AuthenticateWithRedirectCallback> to finish the handshake.
    >
      {children}
    </ClerkProvider>
  )
}
