// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Deep WordPress Scanner
// Plugin/theme detection, AI plugin fingerprinting, Gutenberg analysis
// ════════════════════════════════════════════════════════════════════════════

import * as cheerio from 'cheerio'
import type { WordPressInfo, WPPlugin } from './types'

// Known AI-related WordPress plugins
const AI_PLUGINS: Record<string, { name: string; patterns: RegExp[] }> = {
  'ai-content-writer': {
    name: 'AI Content Writer',
    patterns: [/ai-content-writer/i, /ai-content-generator/i, /class="ai-content"/i],
  },
  'bertha-ai': {
    name: 'Bertha AI',
    patterns: [/bertha-ai/i, /bertha\.ai/i, /data-bertha/i],
  },
  'copymatic': {
    name: 'Copymatic',
    patterns: [/copymatic/i, /copymatic-ai/i],
  },
  'jasper-ai': {
    name: 'Jasper AI (for WordPress)',
    patterns: [/jasper-ai/i, /jasper-wp/i],
  },
  'chatgpt-writer': {
    name: 'ChatGPT Writer',
    patterns: [/chatgpt-writer/i, /chatgpt-content/i],
  },
  'ai-engine': {
    name: 'AI Engine',
    patterns: [/ai-engine/i, /meow-apps/i, /class="ai-engine"/i],
  },
  'contentbot': {
    name: 'ContentBot AI',
    patterns: [/contentbot/i, /contentbot-ai/i],
  },
  'writecream': {
    name: 'Writecream',
    patterns: [/writecream/i, /writecream-ai/i],
  },
  'wordai': {
    name: 'WordAi',
    patterns: [/wordai/i, /wordai-spinner/i],
  },
  'spin-rewriter': {
    name: 'Spin Rewriter',
    patterns: [/spin-rewriter/i, /spinrewriter/i],
  },
  'articleforge': {
    name: 'Article Forge',
    patterns: [/articleforge/i, /article-forge/i],
  },
  'seo-writing-assistant': {
    name: 'SEO Writing Assistant',
    patterns: [/seo-writing-assistant/i, /swa-widget/i],
  },
  'rank-math': {
    name: 'Rank Math SEO',
    patterns: [/rank-math/i, /rank-math-seo/i],
    // Note: Rank Math itself isn't AI, but often paired with AI content
  },
  'yoast-seo': {
    name: 'Yoast SEO',
    patterns: [/yoast/i, /yoast-seo/i],
  },
}

// Known vulnerable plugin patterns (simplified — in production, use WPScan API)
const VULNERABLE_PATTERNS: Record<string, { severity: 'critical' | 'high' | 'medium' | 'low' }> = {
  'revslider': { severity: 'critical' },
  'wp-symposium': { severity: 'high' },
  'wp-mobile-detector': { severity: 'critical' },
  'wp-file-manager': { severity: 'high' },
  'duplicator': { severity: 'high' },
  'wpdatatables': { severity: 'medium' },
  'social-warfare': { severity: 'critical' },
  'easy-wp-smtp': { severity: 'high' },
}

export function deepWordPressScan(html: string, baseUrl: string): WordPressInfo {
  const $ = cheerio.load(html)
  const info: WordPressInfo = {
    isWordPress: false,
    plugins: [],
    aiPluginsDetected: [],
    gutenbergBlocks: 0,
    classicEditorContent: false,
  }

  // Basic WordPress detection
  const wpSignals = [
    /wp-content/i.test(html),
    /wp-includes/i.test(html),
    /<meta[^>]*generator[^>]*WordPress/i.test(html),
    /xmlrpc\.php/i.test(html),
    /wp-block/i.test(html),
    /wp-embed/i.test(html),
    /wp-json/i.test(html),
  ]
  info.isWordPress = wpSignals.filter(Boolean).length >= 2

  if (!info.isWordPress) return info

  // Extract version from generator meta
  const genMatch = html.match(/<meta[^>]*generator[^>]*WordPress\s+([^"\s]+)/i)
  if (genMatch) info.version = genMatch[1]
  info.generatorMeta = genMatch ? `WordPress ${genMatch[1]}` : undefined

  // Extract theme from stylesheet
  const themeLink = $('link[rel="stylesheet"]').filter((_, el) => {
    const href = $(el).attr('href') || ''
    return /wp-content\/themes\/([^\/]+)/i.test(href)
  }).first()
  if (themeLink.length) {
    const themeMatch = themeLink.attr('href')!.match(/wp-content\/themes\/([^\/]+)/i)
    if (themeMatch) info.theme = themeMatch[1]
  }

  // Extract plugins from script/style URLs
  const pluginUrls: string[] = []
  $('script[src], link[rel="stylesheet"]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('href') || ''
    const match = src.match(/wp-content\/plugins\/([^\/]+)/i)
    if (match && !pluginUrls.includes(match[1])) {
      pluginUrls.push(match[1])
    }
  })

  // Also check for plugin classes/IDs in HTML
  const htmlLower = html.toLowerCase()
  for (const [slug, data] of Object.entries(AI_PLUGINS)) {
    let detected = false
    for (const pattern of data.patterns) {
      if (pattern.test(html)) {
        detected = true
        break
      }
    }
    if (detected || pluginUrls.includes(slug)) {
      const vuln = VULNERABLE_PATTERNS[slug]
      const plugin: WPPlugin = {
        slug,
        name: data.name,
        hasVulnerability: !!vuln,
        severity: vuln?.severity,
        aiRelated: true,
      }
      info.plugins.push(plugin)
      info.aiPluginsDetected.push(slug)
    }
  }

  // Add non-AI plugins too
  for (const slug of pluginUrls) {
    if (!info.plugins.some(p => p.slug === slug)) {
      const vuln = VULNERABLE_PATTERNS[slug]
      const aiData = AI_PLUGINS[slug]
      info.plugins.push({
        slug,
        name: aiData?.name || slug,
        hasVulnerability: !!vuln,
        severity: vuln?.severity,
        aiRelated: !!aiData,
      })
    }
  }

  // Gutenberg block detection
  const gutenbergMatches = html.match(/<!--\s*wp:/g)
  info.gutenbergBlocks = gutenbergMatches ? gutenbergMatches.length : 0

  // Classic editor detection (absence of Gutenberg + presence of TinyMCE classes)
  info.classicEditorContent = info.gutenbergBlocks === 0 && /class="[^"]*mce-/i.test(html)

  // Detect AI-generated Gutenberg patterns
  // AI content often uses specific block patterns
  const aiBlockPatterns = [
    /<!--\s*wp:paragraph\s*-->\s*<p>\s*(?:In (?:today|this|the)|It is important to note|Furthermore|Moreover)/i,
    /<!--\s*wp:heading[^>]*>\s*<h[2-6][^>]*>\s*(?:Introduction|Conclusion|Summary|Overview)/i,
  ]
  for (const pattern of aiBlockPatterns) {
    if (pattern.test(html)) {
      info.aiPluginsDetected.push('ai-gutenberg-pattern')
      break
    }
  }

  return info
}

/**
 * Extract WordPress REST API endpoints that might expose AI content
 */
export function extractWPEndpoints(html: string): string[] {
  const endpoints: string[] = []
  const matches = html.match(/"https?:\/\/[^"]+\/wp-json\/[^"]+"/g)
  if (matches) {
    for (const m of matches) {
      const clean = m.replace(/"/g, '')
      if (!endpoints.includes(clean)) endpoints.push(clean)
    }
  }
  return endpoints
}
