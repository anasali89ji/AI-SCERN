/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL      || 'https://lpgzmruxaeikxxayjmze.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    NVIDIA_API_KEY:                process.env.NVIDIA_API_KEY                || '',
    CLOUDFLARE_D1_DATABASE_ID:     process.env.CLOUDFLARE_D1_DATABASE_ID    || '',
    // Clerk redirect configuration
    NEXT_PUBLIC_CLERK_SIGN_IN_URL:      '/login',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL:      '/signup',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:'/dashboard',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:'/dashboard',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: '*.clerk.accounts.dev' },
    ],
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options',           value: 'DENY' },
        { key: 'X-Content-Type-Options',    value: 'nosniff' },
        { key: 'X-XSS-Protection',          value: '1; mode=block' },
        { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security',  value: 'max-age=31536000; includeSubDomains' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data:",
            "img-src 'self' data: blob: https: lh3.googleusercontent.com *.supabase.co",
            "connect-src 'self' https://*.supabase.co https://api-inference.huggingface.co https://integrate.api.nvidia.com https://api.cloudflare.com https://*.clerk.com https://clerk.detect-ai-nu.vercel.app https://api.clerk.com",
            "frame-src https://accounts.google.com https://*.clerk.accounts.dev https://clerk.detect-ai-nu.vercel.app",
            "object-src 'none'",
          ].join('; '),
        },
      ],
    },
  ],
}

module.exports = nextConfig
