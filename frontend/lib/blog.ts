import fs   from 'fs'
import path from 'path'
import matter from 'gray-matter'

export interface BlogPost {
  slug:        string
  title:       string
  description: string
  date:        string
  author:      string
  category:    string
  tags:        string[]
  readTime:    string
  content:     string
}

export type BlogPostMeta = Omit<BlogPost, 'content'>

const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog')

function readPostFile(file: string): BlogPost {
  const raw  = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')
  const { data, content } = matter(raw)
  return {
    slug:        file.replace(/\.mdx?$/, ''),
    title:       data.title       ?? '',
    description: data.description ?? '',
    date:        data.date        ?? '',
    author:      data.author      ?? 'Aiscern Team',
    category:    data.category    ?? 'Article',
    tags:        data.tags        ?? [],
    readTime:    data.readTime    ?? '5 min read',
    content,
  }
}

/** All posts sorted newest-first */
export function getAllPosts(): BlogPostMeta[] {
  if (!fs.existsSync(CONTENT_DIR)) return []

  return fs
    .readdirSync(CONTENT_DIR)
    .filter(f => /\.mdx?$/.test(f))
    .map(file => {
      const { content: _content, ...meta } = readPostFile(file)
      return meta
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/** Single post by slug (includes content) */
export function getPostBySlug(slug: string): BlogPost | null {
  const candidates = [`${slug}.mdx`, `${slug}.md`]
  for (const file of candidates) {
    const fullPath = path.join(CONTENT_DIR, file)
    if (fs.existsSync(fullPath)) return readPostFile(file)
  }
  return null
}

/** All slugs (for generateStaticParams) */
export function getAllSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return []
  return fs
    .readdirSync(CONTENT_DIR)
    .filter(f => /\.mdx?$/.test(f))
    .map(f => f.replace(/\.mdx?$/, ''))
}
