// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Lightweight article extractor
// Strips nav/header/footer/script/style boilerplate from raw HTML so the text
// engines score the actual article body, not site chrome. No external deps
// (no jsdom/readability) so it stays fast + free to run at crawl scale.
// ════════════════════════════════════════════════════════════════════════════

const STRIP_TAGS = ['script', 'style', 'noscript', 'nav', 'footer', 'header', 'form', 'svg', 'iframe', 'aside']

export function htmlToArticleText(html: string): { text: string; title: string } {
  if (!html) return { text: '', title: '' }

  let doc = html

  // Prefer <article> or the most common WordPress content wrapper if present —
  // narrows scoring to the actual post body and skips sidebar widgets/related posts.
  const articleMatch =
    doc.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ??
    doc.match(/<div[^>]*class="[^"]*(?:entry-content|post-content|article-body|td-post-content)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>\s*){0,2}/i)
  if (articleMatch?.[1]) doc = articleMatch[1]

  for (const tag of STRIP_TAGS) {
    doc = doc.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ')
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : ''

  const text = doc
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return { text, title }
}
