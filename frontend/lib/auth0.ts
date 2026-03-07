import { Auth0Client } from '@auth0/nextjs-auth0/server'

export const auth0 = new Auth0Client({
  // Auth0 v4 reads AUTH0_DOMAIN and APP_BASE_URL natively,
  // but we also support the ISSUER_BASE_URL / BASE_URL naming used before.
  domain: (process.env.AUTH0_DOMAIN || process.env.AUTH0_ISSUER_BASE_URL?.replace('https://', '')) ?? '',
  clientId: process.env.AUTH0_CLIENT_ID ?? '',
  clientSecret: process.env.AUTH0_CLIENT_SECRET ?? '',
  appBaseUrl: (process.env.APP_BASE_URL || process.env.AUTH0_BASE_URL) ?? 'https://detectai-platform.netlify.app',
  secret: process.env.AUTH0_SECRET ?? 'placeholder-secret-for-build',
  authorizationParameters: {
    scope: 'openid profile email',
  },
  // Tell the SDK our routes live under /api/auth/* (Next.js App Router convention)
  routes: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    callback: '/api/auth/callback',
  },
})
