import Link          from 'next/link'
import { ArrowRight, Clock, Tag } from 'lucide-react'
import { SiteFooter }             from '@/components/site-footer'
import { getAllPosts, type BlogPostMeta } from '@/lib/blog'
import { SiteNav } from '@/components/SiteNav'

export const metadata = {
  title: 'Aiscern Blog — AI Detection Insights',
  description: 'Learn how to detect AI-generated content, understand deepfakes, and stay ahead of synthetic media with Aiscern.',
  openGraph: { title: 'Aiscern Blog', description: 'AI detection insights and guides', url: 'https://aiscern.com/blog' },
}

const CATEGORY_GRADIENT: Record<string, string> = {
  Guides:     'from-primary/30 to-secondary/30',
  Education:  'from-blue-900/60  to-cyan-900/60',
  Comparison: 'from-emerald-500-900/60 to-teal-900/60',
  Technical:  'from-orange-900/60 to-red-900/60',
}
const grad = (cat: string) => CATEGORY_GRADIENT[cat] ?? 'from-primary/25 to-secondary/25'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function FeaturedCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link href={`/blog/${post.slug}`}
      className="group block mb-6 rounded-xl border border-white/[0.08] bg-[#0f0f17] hover:border-white/[0.12] transition-all overflow-hidden">
      <div className={`h-48 sm:h-64 bg-[#0f0f17] border-b border-white/[0.06] flex items-end p-6`}>
        <div>
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/20 mb-3 inline-block">
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
        <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">{post.description}</p>
        <ArrowRight className="w-5 h-5 text-blue-400 flex-shrink-0 ml-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  )
}

function PostCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link href={`/blog/${post.slug}`}
      className="group block rounded-xl border border-white/[0.08] bg-[#0f0f17] hover:border-white/[0.12] transition-all overflow-hidden">
      <div className={`h-36 bg-[#0f0f17] border-b border-white/[0.06] flex items-end p-4`}>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/20">
          {post.category}
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="font-bold text-slate-100 mb-2 group-hover:text-white transition-colors leading-snug">
          {post.title}
        </h3>
        <p className="text-slate-500 text-xs leading-relaxed mb-3 line-clamp-2">{post.description}</p>
        <div className="flex items-center gap-2 text-xs text-slate-600">
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
    <div className="min-h-screen bg-[#08080d] text-slate-100">
      <SiteNav />

      <main className="pt-24 pb-20 max-w-5xl 2xl:max-w-[1300px] 3xl:max-w-[1600px] mx-auto px-4 sm:px-6 2xl:px-10">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-semibold mb-4">
            <Tag className="w-3 h-3" /> Insights & Guides
          </div>
          <h1 className="text-3xl sm:text-5xl font-black mb-4">
            Aiscern <span className="gradient-text">Blog</span>
          </h1>
          <p className="text-slate-500 text-base sm:text-lg max-w-xl mx-auto">
            Stay ahead of AI-generated content. Guides, comparisons, and research from the Aiscern team.
          </p>
        </div>

        {posts.length === 0 ? (
          <p className="text-center text-slate-500 py-20">No posts yet — check back soon.</p>
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
