/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react', 'framer-motion', '@clerk/nextjs',
      '@radix-ui/react-avatar', '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip', 'recharts', 'd3',
      'react-dropzone', 'date-fns',
    ],
  },

  webpack(config, { isServer }) {
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...(config.optimization.splitChunks?.cacheGroups ?? {}),
          framerMotion: { test: /[\\/]node_modules[\\/]framer-motion[\\/]/, name: 'vendor-framer-motion', chunks: 'all', priority: 30 },
          lucide:       { test: /[\\/]node_modules[\\/]lucide-react[\\/]/,  name: 'vendor-lucide',         chunks: 'all', priority: 29 },
          clerk:        { test: /[\\/]node_modules[\\/]@clerk[\\/]/,         name: 'vendor-clerk',          chunks: 'all', priority: 28 },
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
    { source: '/', headers: [{ key: 'Link', value: [
      '</fonts/inter-400.woff2>; rel=preload; as=font; type="font/woff2"; crossorigin=anonymous',
      '</hero/ai/ai-01.webp>; rel=preload; as=image; type="image/webp"',
      '</hero/real/real-01.webp>; rel=preload; as=image; type="image/webp"',
    ].join(', ') }] },
    { source: '/trust/:file*',  headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }, { key: 'Vary', value: 'Accept' }] },
    { source: '/hero/:file*',   headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    { source: '/fonts/:file*',  headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }, { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    { source: '/:path*', headers: [
      { key: 'X-Content-Type-Options',     value: 'nosniff'                         },
      { key: 'X-XSS-Protection',           value: '1; mode=block'                   },
      { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security',  value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Frame-Options',            value: 'SAMEORIGIN'                      },
      { key: 'X-DNS-Prefetch-Control',     value: 'on'                              },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups'        },
    ]},
  ],
}

module.exports = nextConfig
