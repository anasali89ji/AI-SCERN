/** @type {import('next').NextConfig} */
const nextConfig = {
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
    
    formats:         ['image/webp', 'image/avif'],
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
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options',    value: 'nosniff'                         },
        { key: 'X-XSS-Protection',          value: '1; mode=block'                   },
        { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'X-Frame-Options',           value: 'SAMEORIGIN'                      },
        { key: 'X-DNS-Prefetch-Control',    value: 'on'                              },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups'       },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://*.clerk.accounts.dev https://*.clerk.com https://js.clerk.dev https://cdn.jsdelivr.net https://clerk.aiscern.com https://challenges.cloudflare.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.aiscern.com https://accounts.aiscern.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            "img-src 'self' data: blob: https: img.clerk.com *.supabase.co images.unsplash.com *.clerk.accounts.dev *.aiscern.com *.r2.cloudflarestorage.com *.r2.dev",
            "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com https://api-inference.huggingface.co https://integrate.api.nvidia.com https://api.cloudflare.com https://*.r2.cloudflarestorage.com https://*.r2.dev https://*.clerk.com https://*.clerk.accounts.dev https://api.clerk.com https://clerk.aiscern.com https://aiscern.com https://inn.gs https://*.inngest.com wss://*.clerk.accounts.dev wss://*.clerk.com wss://clerk.aiscern.com https://challenges.cloudflare.com",
            "frame-src https://accounts.google.com https://*.google.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.aiscern.com https://accounts.aiscern.com https://challenges.cloudflare.com",
            "worker-src 'self' blob:",
            "frame-ancestors 'self'",
            "object-src 'none'",
          ].join('; '),
        },
      ],
    },
  ],
}

module.exports = nextConfig
