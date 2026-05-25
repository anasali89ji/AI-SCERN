/** @type {import('next').NextConfig} */

// Detect build target
const isCloudflare = process.env.CF_PAGES === '1' || process.env.DEPLOYMENT_PLATFORM === 'cloudflare-pages'

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },

  // ── Compiler optimisations ───────────────────────────────────────────────
  compiler: {
    // Strip all console.* calls from the production bundle
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },

  // ── Experimental ────────────────────────────────────────────────────────
  experimental: {
    // Tree-shake large icon/animation libraries — big JS savings
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@clerk/nextjs',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'recharts',
      'd3',
      'react-dropzone',
      'date-fns',
    ],
  },

  // ── Bundle splitting ─────────────────────────────────────────────────────
  // Split vendor libraries into stable long-cached chunks.
  // framer-motion, lucide-react, @clerk/nextjs are large and change rarely —
  // keeping them in a separate chunk means users cache them across navigations.
  webpack(config, { isServer }) {
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...(config.optimization.splitChunks?.cacheGroups ?? {}),
          // Framer Motion — animation library, ~70KB gzipped
          framerMotion: {
            test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
            name: 'vendor-framer-motion',
            chunks: 'all',
            priority: 30,
          },
          // Lucide icons — only what's imported (tree-shaken), but split for caching
          lucide: {
            test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            name: 'vendor-lucide',
            chunks: 'all',
            priority: 29,
          },
          // Clerk auth — large SDK, rarely changes
          clerk: {
            test: /[\\/]node_modules[\\/]@clerk[\\/]/,
            name: 'vendor-clerk',
            chunks: 'all',
            priority: 28,
          },
        },
      }
    }
    return config
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL:            process.env.NEXT_PUBLIC_SUPABASE_URL            || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY       || '',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:   process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   || '',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL:       '/login',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL:       '/signup',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: '/dashboard',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: '/dashboard',
    NEXT_PUBLIC_R2_PUBLIC_URL:           process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || '',
  },
  images: {
    
    formats:         ['image/avif', 'image/webp'],
    deviceSizes:     [360, 480, 640, 750, 828, 1080, 1200],
    imageSizes:      [16, 32, 64, 96, 128, 256],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co'              },
      { protocol: 'https', hostname: 'img.clerk.com'              },
      { protocol: 'https', hostname: '*.clerk.accounts.dev'       },
      { protocol: 'https', hostname: '*.aiscern.com'              },
      { protocol: 'https', hostname: 'clerk.aiscern.com'          },
      { protocol: 'https', hostname: 'images.unsplash.com'        },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.r2.dev'                   },
    ],
  },
  headers: async () => [
    // ── LCP preload: hero images + Inter font — cuts ~600ms off LCP on mobile ──
    {
      source: '/',
      headers: [
        {
          key: 'Link',
          value: [
            '</fonts/inter-400.woff2>; rel=preload; as=font; type="font/woff2"; crossorigin=anonymous',
            '</hero/ai/ai-01.webp>; rel=preload; as=image; type="image/webp"',
            '</hero/real/real-01.webp>; rel=preload; as=image; type="image/webp"',
          ].join(', '),
        },
      ],
    },
    // ── Cache static assets aggressively ─────────────────────────────────
    {
      source: '/trust/:file*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        { key: 'Vary',          value: 'Accept' },
      ],
    },
    {
      source: '/hero/:file*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
    {
      source: '/fonts/:file*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
    // ── Security headers on everything ───────────────────────────────────
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options',    value: 'nosniff'                         },
        { key: 'X-XSS-Protection',          value: '1; mode=block'                   },
        { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Frame-Options',           value: 'SAMEORIGIN'                      },
        { key: 'X-DNS-Prefetch-Control',    value: 'on'                              },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups'       },
        // NOTE: Content-Security-Policy is set in middleware.ts with per-request
        // nonces (nonce + strict-dynamic). Do NOT duplicate it here — having CSP
        // in both middleware and next.config causes header conflicts.
      ],
    },
  ],
}

if (isCloudflare) {
  // next-on-pages requires this wrapper for CF Pages edge runtime
  const { setupDevPlatform } = require('@cloudflare/next-on-pages/next-dev')
  if (process.env.NODE_ENV === 'development') {
    setupDevPlatform().catch(console.error)
  }
  const { withCloudflarePages } = require('@cloudflare/next-on-pages/next-config')
  module.exports = withCloudflarePages(nextConfig)
} else {
  module.exports = nextConfig
}
