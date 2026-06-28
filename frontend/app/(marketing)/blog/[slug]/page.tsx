import Link       from 'next/link'
import { notFound } from 'next/navigation'
import { Clock, Calendar, User, Tag } from 'lucide-react'
import { SiteFooter }                from '@/components/site-footer'
import { getPostBySlug, getAllSlugs } from '@/lib/blog'
import { SiteNav } from '@/components/SiteNav'

// ── Static params for build-time generation ───────────────────────────────────
export async function generateStaticParams() {
  return getAllSlugs().map(slug => ({ slug }))
}

// ── Per-page metadata (OG + SEO) ──────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}
  return {
    title:       `${post.title} | Aiscern Blog`,
    description: post.description,
    openGraph: {
      title:       post.title,
      description: post.description,
      url:         `https://aiscern.com/blog/${slug}`,
      type:        'article',
      publishedTime: post.date,
      authors:     [post.author],
      tags:        post.tags,
    },
  }
}

// ── HTML sanitizer ────────────────────────────────────────────────────────────
// Strips all tags except a safe allowlist and removes dangerous attributes.
// Defends against XSS if blog content were ever compromised or injected.
const SAFE_TAGS = new Set([
  'h1','h2','h3','h4','h5','h6',
  'p','br','hr',
  'strong','em','code','pre',
  'ul','ol','li',
  'blockquote',
  'a',
])

function sanitizeHtml(html: string): string {
  // Remove dangerous elements and their content wholesale
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '')
  html = html.replace(
    /<(iframe|object|embed|form|input|textarea|button|select|meta|link|base)(\s[^>]*)?\/?>(<\/\1>)?/gi,
    ''
  )

  // Strip or sanitize all remaining tags
  html = html.replace(/<(\/?[a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?\/?>/ , (match) => match) // placeholder
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>?/g, (match, tagName) => {
    const tag = (tagName ?? '').toLowerCase()
    if (!SAFE_TAGS.has(tag)) return ''

    // Reconstruct only safe attributes
    const allowedForTag = new Set(['class', ...(tag === 'a' ? ['href', 'title'] : [])])
    const attrRegex = /([a-zA-Z\-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/g
    let safeAttrs = ''
    let m: RegExpExecArray | null
    while ((m = attrRegex.exec(match)) !== null) {
      const name  = m[1].toLowerCase()
      const value = (m[2] ?? m[3] ?? m[4] ?? '').trim()
      if (!allowedForTag.has(name)) continue
      // Block javascript:, data:, vbscript: URIs
      if (name === 'href' && /^\s*(javascript|data|vbscript):/i.test(value)) continue
      const escaped = value.replace(/"/g, '&quot;')
      if (name === 'href' && /^https?:\/\//i.test(value)) {
        safeAttrs += ` href="${escaped}" target="_blank" rel="noopener noreferrer"`
      } else {
        safeAttrs += ` ${name}="${escaped}"`
      }
    }

    const isClosing = match.startsWith('</')
    return isClosing ? `</${tag}>` : `<${tag}${safeAttrs}>`
  })

  return html
}

// ── Minimal markdown → HTML renderer (no heavy runtime dep) ──────────────────
function renderMarkdown(md: string): string {
  const result = md
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-white mt-8 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-[#1E1E1E]">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="text-2xl font-black text-white mt-10 mb-4">$1</h1>')
    // Bold / italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em class="italic">$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-[#141414] border border-[#1E1E1E] text-xs font-mono text-[#2BEE34]">$1</code>')
    // Unordered list items
    .replace(/^[-*] (.+)$/gm, '<li class="ml-5 list-disc text-[#6B6B6B] leading-relaxed mb-1">$1</li>')
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-5 list-decimal text-[#6B6B6B] leading-relaxed mb-1">$1</li>')
    // Wrap consecutive <li> in <ul>/<ol>
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-4 space-y-1">$1</ul>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-[#2BEE34]/30 pl-4 my-4 text-[#6B6B6B] italic">$1</blockquote>')
    // Paragraphs — blank-line separated
    .split(/\n\n+/)
    .map(block => {
      const t = block.trim()
      if (!t) return ''
      if (/^<(h[1-6]|ul|ol|blockquote|li)/.test(t)) return t
      return `<p class="text-[#6B6B6B] leading-relaxed mb-4">${t.replace(/\n/g, ' ')}</p>`
    })
    .join('\n')

  // Sanitize the rendered HTML before returning to prevent XSS
  return sanitizeHtml(result)
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const html = renderMarkdown(post.content) // sanitizeHtml applied inside

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* Nav */}
      <SiteNav backHref="/blog" backLabel="Blog" />

      <main className="pt-24 pb-20 max-w-3xl mx-auto px-4">
        {/* Category badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-[#2BEE34]/10 text-[#2BEE34] border border-[#2BEE34]/20">
            <Tag className="w-3 h-3" /> {post.category}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight mb-5">
          {post.title}
        </h1>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B6B6B] mb-8 pb-6 border-b border-[#1E1E1E]">
          <span className="flex items-center gap-1.5">
            <User className="w-3 h-3" /> {post.author}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> {post.readTime}
          </span>
        </div>

        {/* Description lead */}
        <p className="text-base text-[#A3A3A3] leading-relaxed mb-8 font-medium">
          {post.description}
        </p>

        {/* Article body */}
        <article
          className="prose-aiscern"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-12 pt-6 border-t border-[#1E1E1E]">
            {post.tags.map(tag => (
              <span key={tag}
                className="text-xs px-2.5 py-1 rounded-full bg-[#141414] border border-[#1E1E1E] text-[#6B6B6B]">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 p-6 rounded-xl border border-[#2BEE34]/20 bg-[#2BEE34]/5 text-center">
          <h3 className="font-black text-lg mb-2">Try Aiscern Free</h3>
          <p className="text-[#6B6B6B] text-sm mb-4">
            Detect AI-generated text, images, audio, and video — no account required.
          </p>
          <Link href="/detect/text"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2BEE34] text-white font-bold text-sm hover:bg-[#1A8F1F] transition-colors">
            Start Detecting Free →
          </Link>
        </div>

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link href="/blog" className="text-sm text-[#6B6B6B] hover:text-white transition-colors">
            ← Back to all posts
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
