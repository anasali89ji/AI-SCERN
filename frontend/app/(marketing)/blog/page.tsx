import Link from 'next/link'
import { ArrowRight, Clock, Tag } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'
import { getAllPosts, type BlogPostMeta } from '@/lib/blog'
import { SiteNav } from '@/components/SiteNav'

export const metadata = {
  title: 'Aiscern Blog — AI Attestation Insights',
  description: 'Learn how to attest AI-generated content, understand deepfakes, and stay ahead of synthetic media with Aiscern.',
  openGraph: { title: 'Aiscern Blog', description: 'AI attestation insights and guides', url: 'https://aiscern.com/blog' },
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function FeaturedCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block mb-8 rounded-xl border border-white/5 bg-surface
                 hover:border-white/10 hover:shadow-lift
                 transition-all duration-300 ease-out overflow-hidden focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <div className="h-48 sm:h-64 bg-surface-deep border-b border-white/5 flex items-end p-6">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20 mb-3 inline-block">
            {post.category}
          </span>
          <h2 className="text-headline text-silver-900 mb-2">{post.title}</h2>
          <div className="flex items-center gap-2 text-xs text-silver-600">
            <span>{formatDate(post.date)}</span>
            <span>·</span>
            <Clock className="w-3 h-3" />
            <span>{post.readTime}</span>
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
        <p className="text-lead text-silver-600">{post.description}</p>
        <ArrowRight className="w-5 h-5 text-accent flex-shrink-0 group-hover:translate-x-1 transition-transform duration-300" />
      </div>
    </Link>
  )
}

function PostCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-xl border border-white/5 bg-surface
                 hover:border-white/10 hover:shadow-lift
                 transition-all duration-300 ease-out overflow-hidden focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <div className="h-32 bg-surface-deep border-b border-white/5 flex items-end p-4">
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
          {post.category}
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="text-lg font-semibold text-silver-900 mb-2 group-hover:text-accent transition-colors duration-300 leading-snug">
          {post.title}
        </h3>
        <p className="text-silver-600 text-xs leading-relaxed mb-3 line-clamp-2">{post.description}</p>
        <div className="flex items-center gap-2 text-xs text-silver-600">
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
    <div className="min-h-screen bg-surface-deep text-silver-800">
      <SiteNav />
      <main id="main-content" className="pt-24 pb-20 max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/20 bg-accent/5 text-accent text-xs font-semibold mb-4">
            <Tag className="w-3 h-3" /> Insights &amp; Guides
          </div>
          <h1 className="text-headline text-silver-900 mb-4">
            Aiscern Blog
          </h1>
          <p className="text-lead text-silver-600 max-w-xl mx-auto">
            Stay ahead of AI-generated content. Guides, comparisons, and research from the Aiscern team.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-silver-600 text-lg mb-2">No posts yet</p>
            <p className="text-silver-600 text-sm">Check back soon — guides and research are coming.</p>
          </div>
        ) : (
          <>
            <FeaturedCard post={posts[0]} />
            {posts.length > 1 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
