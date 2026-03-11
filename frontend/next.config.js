/** @type {import('next').NextConfig} */
const nextConfig = {
  // New Supabase project (lpgzmruxaeikxxayjmze) — migrated 2026-03-11
  // Old project (xtdrwspsbranhunvlbfa) was stuck in PAUSING state
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://lpgzmruxaeikxxayjmze.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZ3ptcnV4YWVpa3h4YXlqbXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjE4OTIsImV4cCI6MjA4ODczNzg5Mn0.grbICfJk6vvJjLtcHecuA6X10kDwbaSFAejNHkvv2w0',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'huggingface.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
    },
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options',        value: 'DENY' },
        { key: 'X-XSS-Protection',       value: '1; mode=block' },
        { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
}

module.exports = nextConfig
