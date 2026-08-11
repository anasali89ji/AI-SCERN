// ════════════════════════════════════════════════════════════════════════════
// AISCERN — WordPress Deep Scan
// Goes beyond the basic "is this WordPress" fingerprint (crawler.ts) to
// extract active plugins/themes from asset URLs, flag known AI-content
// plugins, and parse Gutenberg block comments for AI-paragraph insertion
// patterns. Pure regex over already-fetched HTML — no extra network calls
// except the optional free WPScan vulnerability snapshot lookup (best-effort,
// silently skipped if unavailable).
// ════════════════════════════════════════════════════════════════════════════

export interface WordPressPlugin {
  slug:              string
  source:            'plugin' | 'theme'
  isAiContentPlugin: boolean
  hasVulnerability?: boolean   // populated only if the free WPScan snapshot lookup succeeds
}

// Known AI-content-generation WordPress plugins/themes, by slug — matched
// against wp-content/plugins/{slug}/ and wp-content/themes/{slug}/ asset URLs.
const AI_CONTENT_PLUGIN_SLUGS = new Set([
  'ai-content-writer', 'bertha-ai', 'wp-ai-content-generator', 'gpt3-ai-content-generator',
  'ai-power', 'wordlift', 'ai-engine', 'chatgpt-content-writer', 'contentbot',
  'automatic-content-generator', 'wp-content-crawler', 'article-generator',
])

export function extractWordPressAssets(html: string): WordPressPlugin[] {
  const found = new Map<string, WordPressPlugin>()

  for (const m of html.matchAll(/wp-content\/plugins\/([a-z0-9-_]+)\//gi)) {
    const slug = m[1].toLowerCase()
    if (!found.has(`plugin:${slug}`)) {
      found.set(`plugin:${slug}`, { slug, source: 'plugin', isAiContentPlugin: AI_CONTENT_PLUGIN_SLUGS.has(slug) })
    }
  }
  for (const m of html.matchAll(/wp-content\/themes\/([a-z0-9-_]+)\//gi)) {
    const slug = m[1].toLowerCase()
    if (!found.has(`theme:${slug}`)) {
      found.set(`theme:${slug}`, { slug, source: 'theme', isAiContentPlugin: AI_CONTENT_PLUGIN_SLUGS.has(slug) })
    }
  }

  return [...found.values()]
}

/**
 * Best-effort free WPScan vulnerability snapshot lookup. WPScan's public API
 * requires a key for full detail, but returns basic "known vulnerable" flags
 * for unauthenticated lookups at low volume. Fails silently (returns plugins
 * unchanged) if the API is unreachable or rate-limited — this must never
 * block or slow down the core scan.
 */
export async function annotateVulnerabilities(plugins: WordPressPlugin[], timeoutMs = 4000): Promise<WordPressPlugin[]> {
  const pluginSlugs = plugins.filter(p => p.source === 'plugin')
  if (pluginSlugs.length === 0) return plugins

  const annotated = await Promise.all(plugins.map(async (p): Promise<WordPressPlugin> => {
    if (p.source !== 'plugin') return p
    try {
      const res = await fetch(`https://wpvulndb.com/api/v3/plugins/${encodeURIComponent(p.slug)}`, {
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) return p // 404/403/rate-limit → leave unannotated, non-fatal
      const data = await res.json()
      const entry = data?.[p.slug]
      const hasVulnerability = Array.isArray(entry?.vulnerabilities) && entry.vulnerabilities.length > 0
      return { ...p, hasVulnerability }
    } catch {
      return p // network unavailable in this sandbox/offline env → non-fatal
    }
  }))
  return annotated
}

// ── Gutenberg block parsing ─────────────────────────────────────────────────
// Detects classic-editor pages that have AI-generated Gutenberg paragraph
// blocks spliced in — a common pattern for "AI content injected via plugin"
// sites where most of the page is hand-authored but specific blocks are not.

export interface GutenbergBlockSignal {
  totalBlocks:        number
  paragraphBlocks:    number
  looksSpliced:       boolean  // Gutenberg comments present alongside non-block legacy markup
}

export function analyzeGutenbergBlocks(html: string): GutenbergBlockSignal {
  const blockComments = html.match(/<!--\s*wp:[a-z0-9/_-]+/gi) ?? []
  const paragraphBlocks = (html.match(/<!--\s*wp:paragraph/gi) ?? []).length
  // "Spliced" heuristic: has Gutenberg blocks but ALSO large stretches of
  // plain <p> tags with no adjacent wp: comment — mixed classic+block editor
  // output is a known signature of a plugin auto-inserting AI paragraphs.
  const legacyParagraphs = (html.match(/<p(?![^>]*wp-block)[^>]*>/gi) ?? []).length
  const looksSpliced = blockComments.length > 0 && legacyParagraphs > blockComments.length * 2

  return { totalBlocks: blockComments.length, paragraphBlocks, looksSpliced }
}
