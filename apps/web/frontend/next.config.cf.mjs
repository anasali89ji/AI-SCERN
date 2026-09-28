// next.config.cf.mjs — used ONLY for Cloudflare Pages build
// API routes are disabled here. All /api/* calls route through the CF Worker LB to Vercel.

import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev'

/** @type {import('next').NextConfig} */
const config = {
  // Required for @cloudflare/next-on-pages
  experimental: {},

  // Disable server-side features that need Node.js
  output: 'export',         // Static HTML export
  trailingSlash: true,

  // Images: CF Pages can't optimize at runtime; use unoptimized
  images: {
    unoptimized: true,
  },

  // Rewrite all /api/* to Vercel (handled by CF Worker LB upstream)
  // In static export mode these are irrelevant — just kept for documentation
  async rewrites() {
    return []
  },

  env: {
    DEPLOYMENT_PLATFORM: 'cloudflare-pages',
  },
}

if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform()
}

export default config
