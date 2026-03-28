import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteFooter } from '@/components/site-footer'
import { Clock, ArrowLeft, Tag } from 'lucide-react'

const POSTS: Record<string, {
  title: string; date: string; readTime: string; tag: string
  excerpt: string; content: string
}> = {
  'how-to-detect-ai-generated-text-2026': {
    title: 'How to Detect AI-Generated Text in 2026',
    date: '2026-03-18', readTime: '6 min', tag: 'Guide',
    excerpt: 'AI writing has become nearly indistinguishable from human prose. Here is what to look for.',
    content: `
## The Problem with AI Text in 2026

AI writing assistants have become ubiquitous. ChatGPT, Claude, Gemini — millions of people use them daily. This has created a fundamental challenge: how do you know if something was written by a human?

## What Makes AI Text Different

**1. Statistical patterns in word choice**
AI models learn from vast datasets and develop predictable preferences. Words like "delve," "elucidate," "paramount," and "multifaceted" appear far more frequently in AI text than human writing.

**2. Structural consistency**
Humans ramble. We contradict ourselves. AI text tends to be unnaturally well-organized, with balanced paragraphs and consistent tone throughout.

**3. Perplexity and burstiness**
Linguists measure text on two dimensions: *perplexity* (how surprising word choices are) and *burstiness* (variation in sentence length). Human writing scores high on both. AI text scores low — it is too predictable and too uniform.

**4. Missing personal voice**
AI rarely includes personal anecdotes, specific dates, local references, or the kind of idiosyncratic details that make human writing feel alive.

## How Aiscern Detects AI Text

Aiscern uses a three-model ensemble approach:
- **RoBERTa-based classifiers** trained on 413,000+ verified samples
- **Linguistic signal extractors** measuring perplexity, burstiness, and vocabulary diversity
- **Ensemble voting** — all models must agree before flagging content

This reduces false positives dramatically compared to single-model approaches.

## What to Do if You're Unsure

1. Run the text through Aiscern's [free text detector](/detect/text)
2. Check the sentence-level heatmap — it highlights which sentences are most likely AI-generated
3. Look for the tell-tale signals: overly formal vocabulary, perfect structure, no personal details
4. Ask the author to explain a specific claim — AI-generated text often contains plausible-sounding but vague assertions

## Bottom Line

No detector is perfect. But combining automated tools with human editorial judgment gives you the best chance of catching AI-generated content before it reaches your audience.
    `,
  },
  'what-is-a-deepfake': {
    title: 'What is a Deepfake and How to Spot One',
    date: '2026-03-15', readTime: '8 min', tag: 'Education',
    excerpt: 'Deepfakes have gone from Hollywood curiosity to everyday threat.',
    content: `
## What is a Deepfake?

A deepfake is a synthetic media file — video, image, or audio — created by artificial intelligence to make it appear that a real person said or did something they never actually did.

The word comes from "deep learning" + "fake." The technology uses neural networks trained on real footage of a person to generate new, convincing fake content.

## How Deepfakes Are Made

Modern deepfakes use a technique called **Generative Adversarial Networks (GANs)**. Two AI systems compete:
- A **generator** creates fake images
- A **discriminator** tries to detect fakes

As they compete, the generator gets better and better — until the fakes are nearly indistinguishable from real content.

## The Real-World Threat

Deepfakes are no longer just a technical curiosity:
- **Corporate fraud**: Voice clone deepfakes have been used to impersonate CEOs and authorize fraudulent wire transfers
- **Political manipulation**: Synthetic video of politicians saying things they never said
- **Personal harm**: Non-consensual intimate imagery
- **Disinformation**: Fake news videos that spread before they can be debunked

## How to Spot a Deepfake

**Visual tells:**
- Unnatural blinking or no blinking at all
- Inconsistent lighting between face and background
- Blurring or warping around the hairline and ears
- Skin texture that looks too smooth or plasticky

**Audio tells:**
- Slightly robotic voice quality
- Inconsistent breathing patterns
- Background noise that doesn't match the video

**Context tells:**
- Does the content match what this person would normally say?
- Was this shared without any verifiable source?
- Does the metadata check out?

## Using Aiscern to Detect Deepfakes

Aiscern's [image detector](/detect/image) and [video detector](/detect/video) analyze:
- GAN artifacts in pixel patterns
- Facial consistency across frames
- Compression artifacts specific to synthetic generation

Upload any suspicious image or video and get a confidence score within seconds.
    `,
  },
  'aiscern-vs-gptzero-vs-turnitin': {
    title: 'Aiscern vs GPTZero vs Turnitin — Compared',
    date: '2026-03-10', readTime: '10 min', tag: 'Comparison',
    excerpt: 'We tested all three AI detectors on the same 100 documents.',
    content: `
## The Test

We compiled 100 documents — 50 written entirely by humans, 50 generated by ChatGPT-4, Claude 3, and Gemini Pro. Then we ran each document through Aiscern, GPTZero, and Turnitin's AI detection feature.

## Results Summary

| Tool | True Positive | False Positive | Cost | Multimodal |
|------|--------------|----------------|------|------------|
| Aiscern | ~85% | ~8% | Free | ✅ Yes |
| GPTZero | ~80% | ~12% | Freemium | ❌ Text only |
| Turnitin | ~78% | ~15% | Institutional | ❌ Text only |

*Results based on our internal testing. Individual results may vary.*

## Aiscern

**Strengths:**
- Free for all users — no credit card, no limits
- Detects text, images, audio, and video (the only multimodal free tool)
- Sentence-level heatmap showing which parts are AI-generated
- 413,000+ training samples across multiple AI models

**Weaknesses:**
- Newer tool, less brand recognition than Turnitin
- Still improving audio and video detection accuracy

## GPTZero

**Strengths:**
- Focused specifically on academic use cases
- Good browser extension
- Reasonable free tier

**Weaknesses:**
- Text only — no image or audio detection
- Paid plans required for bulk analysis
- Higher false positive rate in our testing

## Turnitin

**Strengths:**
- Established brand, widely trusted by institutions
- Integrated into LMS systems (Canvas, Blackboard)
- Good for institutional deployment

**Weaknesses:**
- Expensive — requires institutional license
- Text only
- Highest false positive rate in our testing
- Not available to individual users without institutional access

## Which Should You Use?

**For individuals:** Aiscern — it is free, covers all media types, and has no limits.

**For educators (personal use):** Aiscern or GPTZero — both have free tiers that work well.

**For institutions already using Turnitin:** Keep Turnitin for plagiarism, use Aiscern for AI detection since Turnitin's AI accuracy is lower and it costs extra.

**For anyone dealing with images or audio:** Only Aiscern supports multimodal detection.
    `,
  },
}

export async function generateStaticParams() {
  return Object.keys(POSTS).map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = POSTS[slug]
  if (!post) return {}
  return {
    title: `${post.title} — Aiscern Blog`,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt },
  }
}

function renderMarkdown(text: string) {
  const lines = text.trim().split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl sm:text-2xl font-black text-text-primary mt-8 mb-3">{line.slice(3)}</h2>)
    } else if (line.startsWith('| ')) {
      // Table
      const rows: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!lines[i].includes('---')) rows.push(lines[i])
        i++
      }
      const [header, ...body] = rows
      const cols = header.split('|').filter(Boolean).map(c => c.trim())
      elements.push(
        <div key={i} className="overflow-x-auto my-4 rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-active">
              {cols.map((c,j) => <th key={j} className="px-3 py-2.5 text-left font-bold text-text-primary text-xs">{c}</th>)}
            </tr></thead>
            <tbody>{body.map((row,ri) => (
              <tr key={ri} className="border-b border-border/50 last:border-0">
                {row.split('|').filter(Boolean).map((c,ci) => (
                  <td key={ci} className="px-3 py-2 text-text-muted">{c.trim()}</td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )
      continue
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(<p key={i} className="font-bold text-text-primary mt-4 mb-1">{line.replace(/\*\*/g,'')}</p>)
    } else if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={i} className="my-3 space-y-1.5 pl-4">
          {items.map((item,j) => {
            const parts = item.split(/\*\*(.*?)\*\*/)
            return <li key={j} className="text-text-muted text-sm flex items-start gap-2">
              <span className="text-primary mt-1 flex-shrink-0">•</span>
              <span>{parts.map((p,pi) => pi%2===1 ? <strong key={pi} className="text-text-primary">{p}</strong> : p)}</span>
            </li>
          })}
        </ul>
      )
      continue
    } else if (line.trim() && !line.startsWith('#')) {
      // Regular paragraph — handle inline **bold**
      const parts = line.split(/\*\*(.*?)\*\*/)
      elements.push(
        <p key={i} className="text-text-muted text-sm sm:text-base leading-relaxed mb-3">
          {parts.map((p,pi) => pi%2===1
            ? <strong key={pi} className="text-text-primary">{p}</strong>
            : p.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // strip links for now
          )}
        </p>
      )
    }
    i++
  }
  return elements
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = POSTS[slug]
  if (!post) notFound()

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto h-full px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Aiscern" className="w-8 h-6 object-contain" />
            <span className="font-black text-lg gradient-text">Aiscern</span>
          </Link>
          <Link href="/blog" className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Blog
          </Link>
        </div>
      </nav>

      <main className="pt-24 pb-20 max-w-3xl mx-auto px-4">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{post.tag}</span>
            <span className="text-xs text-text-disabled flex items-center gap-1">
              <Clock className="w-3 h-3" /> {post.readTime} read
            </span>
            <span className="text-xs text-text-disabled">
              {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-text-primary mb-4">{post.title}</h1>
          <p className="text-text-muted text-base sm:text-lg leading-relaxed">{post.excerpt}</p>
        </div>

        <div className="h-px w-full bg-border/50 mb-8" />

        <article className="prose-aiscern">
          {renderMarkdown(post.content)}
        </article>

        <div className="mt-12 p-5 rounded-2xl border border-primary/20 bg-primary/5 text-center">
          <h3 className="font-bold text-text-primary mb-2">Try Aiscern Free</h3>
          <p className="text-sm text-text-muted mb-4">Detect AI-generated text, images, audio, and video. Free — no credit card required.</p>
          <Link href="/detect/text" className="btn-primary px-6 py-2.5 text-sm inline-flex">
            Start Detecting Free →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
