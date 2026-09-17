// The Cloudflare Worker (cf-workers-marketing-split) only intercepts a
// fixed allowlist of PAGE paths (/pricing, /about, etc) — it does not, and
// safely cannot, blanket-route /_next/* to this origin, because the real
// app on Vercel serves its own JS/CSS under that exact same path prefix.
// If exported pages referenced assets with plain relative paths
// (/_next/static/...), the browser would request them through the worker,
// fall through to Vercel (wrong build, 404), and silently render
// unstyled — which is exactly what happened before this was set.
//
// assetPrefix makes every asset URL in the exported HTML fully-qualified
// against the Pages origin, so the browser fetches CSS/JS directly from
// Cloudflare Pages and never touches the worker/Vercel for them at all.
// Must match the actual production Pages URL exactly (no trailing slash).
const MARKETING_ORIGIN = 'https://aiscern-marketing.pages.dev'

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',        // plain static HTML export
  assetPrefix: MARKETING_ORIGIN,
  trailingSlash: true,

  images: {
    unoptimized: true,
  },
}

export default config
