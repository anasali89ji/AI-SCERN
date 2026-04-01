import Link          from 'next/link'
import { ArrowRight, Clock, Tag } from 'lucide-react'
import { SiteFooter }             from '@/components/site-footer'
import { getAllPosts, type BlogPostMeta } from '@/lib/blog'

export const metadata = {
  title: 'Aiscern Blog — AI Detection Insights',
  description: 'Learn how to detect AI-generated content, understand deepfakes, and stay ahead of synthetic media with Aiscern.',
  openGraph: { title: 'Aiscern Blog', description: 'AI detection insights and guides', url: 'https://aiscern.com/blog' },
}

const CATEGORY_GRADIENT: Record<string, string> = {
  Guides:     'from-violet-900/60 to-indigo-900/60',
  Education:  'from-blue-900/60  to-cyan-900/60',
  Comparison: 'from-emerald-900/60 to-teal-900/60',
  Technical:  'from-orange-900/60 to-red-900/60',
}
const grad = (cat: string) => CATEGORY_GRADIENT[cat] ?? 'from-violet-900/50 to-indigo-900/50'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function FeaturedCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link href={`/blog/${post.slug}`}
      className="group block mb-6 rounded-2xl border border-border bg-surface hover:border-primary/30 transition-all overflow-hidden">
      <div className={`h-48 sm:h-64 bg-gradient-to-br ${grad(post.category)} flex items-end p-6`}>
        <div>
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 mb-3 inline-block">
            {post.category}
          </span>
          <h2 className="text-xl sm:text-3xl font-black text-white mb-2">{post.title}</h2>
          <div className="flex items-center gap-3 text-xs text-white/60">
            <span>{formatDate(post.date)}</span>
            <span>·</span>
            <Clock className="w-3 h-3" />
            <span>{post.readTime}</span>
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6 flex items-center justify-between">
        <p className="text-text-muted text-sm leading-relaxed max-w-2xl">{post.description}</p>
        <ArrowRight className="w-5 h-5 text-primary flex-shrink-0 ml-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  )
}

function PostCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link href={`/blog/${post.slug}`}
      className="group block rounded-2xl border border-border bg-surface hover:border-primary/30 transition-all overflow-hidden">
      <div className={`h-36 bg-gradient-to-br ${grad(post.category)} flex items-end p-4`}>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
          {post.category}
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="font-bold text-text-primary mb-2 group-hover:text-primary transition-colors leading-snug">
          {post.title}
        </h3>
        <p className="text-text-muted text-xs leading-relaxed mb-3 line-clamp-2">{post.description}</p>
        <div className="flex items-center gap-2 text-xs text-text-disabled">
          <span>{formatDate(post.date)}</span>
          <span>·</span>
          <Clock className="w-3 h-3" />
          <span>{post.readTime}</span>
        </div>
      </div>
    </Link>
  )
}

export default function BlogPage() {
  const posts = getAllPosts()

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto h-full px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Aiscern" className="w-8 h-6 object-contain" />
            <span className="font-black text-lg gradient-text">Aiscern</span>
          </Link>
          <Link href="/" className="text-sm text-text-muted hover:text-text-primary transition-colors">← Back</Link>
        </div>
      </nav>

      <main className="pt-24 pb-20 max-w-5xl mx-auto px-4">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-4">
            <Tag className="w-3 h-3" /> Insights & Guides
          </div>
          <h1 className="text-3xl sm:text-5xl font-black mb-4">
            Aiscern <span className="gradient-text">Blog</span>
          </h1>
          <p className="text-text-muted text-base sm:text-lg max-w-xl mx-auto">
            Stay ahead of AI-generated content. Guides, comparisons, and research from the Aiscern team.
          </p>
        </div>

        {posts.length === 0 ? (
          <p className="text-center text-text-muted py-20">No posts yet — check back soon.</p>
        ) : (
          <>
            <FeaturedCard post={posts[0]} />
            {posts.length > 1 && (
              <div className="grid sm:grid-cols-2 gap-4">
                {posts.slice(1).map(post => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
