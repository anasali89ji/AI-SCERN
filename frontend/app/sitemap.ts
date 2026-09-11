import { MetadataRoute } from 'next'
import { getAllPosts }    from '@/lib/blog'

const BASE = 'https://aiscern.com'

// Realistic staggered lastModified dates for static pages.
// These reflect approximate build/update milestones — not all identical.
const d = (iso: string) => new Date(iso)

export default function sitemap(): MetadataRoute.Sitemap {
  // ── Dynamic: MDX blog posts (file-based, no DB required) ──────────────
  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map(post => ({
    url:             `${BASE}/blog/${post.slug}`,
    lastModified:    new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority:        0.65,
  }))

  // ── TODO: Supabase dynamic routes ─────────────────────────────────────
  // When public forensic reports or scan permalinks are ready, add:
  //
  // import { createServerClient } from '@/lib/supabase/server'
  // const supabase = await createServerClient()
  // const { data: reports } = await supabase
  //   .from('public_reports')
  //   .select('id, updated_at')
  //   .eq('is_public', true)
  // const reportPages = (reports ?? []).map(r => ({
  //   url:          `${BASE}/scan/${r.id}`,
  //   lastModified: new Date(r.updated_at),
  //   changeFrequency: 'weekly' as const,
  //   priority: 0.5,
  // }))

  return [
    // ── Homepage ──────────────────────────────────────────────────────────
    { url: BASE, lastModified: d('2026-04-10'), changeFrequency: 'weekly',  priority: 1.0 },

    // ── Detection tools (core product) ───────────────────────────────────
    // NOTE: /detect/* routes are auth-gated (middleware 307 → /login), so they
    // are deliberately NOT listed here — advertising them only feeds crawlers
    // redirect loops. Anonymous users land on / where the live demo runs.

    // ── Pricing & conversion ──────────────────────────────────────────────
    { url: `${BASE}/pricing`,     lastModified: d('2026-04-05'), changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE}/enterprise`,  lastModified: d('2026-03-28'), changeFrequency: 'monthly', priority: 0.8  },
    { url: `${BASE}/compare`,     lastModified: d('2026-03-25'), changeFrequency: 'monthly', priority: 0.8  },

    // ── Solutions hub ─────────────────────────────────────────────────────
    { url: `${BASE}/solutions`,                  lastModified: d('2026-03-18'), changeFrequency: 'monthly', priority: 0.8  },
    { url: `${BASE}/solutions/education`,        lastModified: d('2026-03-18'), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/solutions/hr`,               lastModified: d('2026-03-18'), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/solutions/media`,            lastModified: d('2026-03-18'), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/solutions/legal`,            lastModified: d('2026-03-18'), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/solutions/security`,         lastModified: d('2026-03-18'), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/solutions/healthcare`,       lastModified: d('2026-03-18'), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/solutions/marketing`,        lastModified: d('2026-03-18'), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/solutions/research`,         lastModified: d('2026-03-18'), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE}/solutions/content-creators`, lastModified: d('2026-03-18'), changeFrequency: 'monthly', priority: 0.75 },

    // ── Docs & API ────────────────────────────────────────────────────────
    { url: `${BASE}/docs/api`,  lastModified: d('2026-04-02'), changeFrequency: 'weekly',  priority: 0.75 },
    { url: `${BASE}/guides`,    lastModified: d('2026-03-30'), changeFrequency: 'weekly',  priority: 0.7  },

    // ── Blog ──────────────────────────────────────────────────────────────
    { url: `${BASE}/blog`,      lastModified: d('2026-03-22'), changeFrequency: 'weekly',  priority: 0.7  },
    ...blogPosts,

    // ── Trust & transparency ──────────────────────────────────────────────
    { url: `${BASE}/methodology`,  lastModified: d('2026-03-10'), changeFrequency: 'monthly', priority: 0.7  },
    { url: `${BASE}/benchmarks`,   lastModified: d('2026-03-15'), changeFrequency: 'monthly', priority: 0.7  },
    { url: `${BASE}/how-it-works`, lastModified: d('2026-03-12'), changeFrequency: 'monthly', priority: 0.7  },
    { url: `${BASE}/research`,     lastModified: d('2026-03-08'), changeFrequency: 'monthly', priority: 0.65 },
    { url: `${BASE}/transparency`, lastModified: d('2026-03-08'), changeFrequency: 'monthly', priority: 0.65 },
    { url: `${BASE}/reviews`,      lastModified: d('2026-04-01'), changeFrequency: 'weekly',  priority: 0.7  },

    // ── Auth ──────────────────────────────────────────────────────────────
    { url: `${BASE}/signup`, lastModified: d('2026-03-01'), changeFrequency: 'yearly', priority: 0.7 },
    { url: `${BASE}/login`,  lastModified: d('2026-03-01'), changeFrequency: 'yearly', priority: 0.6 },

    // ── ARIA AI Assistant ─────────────────────────────────────────────────
    // (/chat is auth-gated — same redirect reason as /detect/* above)

    // ── Updates & status ──────────────────────────────────────────────────
    { url: `${BASE}/changelog`, lastModified: d('2026-04-08'), changeFrequency: 'weekly',  priority: 0.55 },
    { url: `${BASE}/roadmap`,   lastModified: d('2026-04-05'), changeFrequency: 'weekly',  priority: 0.6  },
    { url: `${BASE}/status`,    lastModified: d('2026-04-10'), changeFrequency: 'daily',   priority: 0.5  },

    // ── Company ───────────────────────────────────────────────────────────
    { url: `${BASE}/about`,    lastModified: d('2026-03-01'), changeFrequency: 'monthly', priority: 0.55 },
    { url: `${BASE}/partners`, lastModified: d('2026-03-05'), changeFrequency: 'monthly', priority: 0.5  },
    { url: `${BASE}/contact`,  lastModified: d('2026-03-01'), changeFrequency: 'monthly', priority: 0.45 },
    { url: `${BASE}/faq`,      lastModified: d('2026-03-20'), changeFrequency: 'monthly', priority: 0.6  },
    { url: `${BASE}/security`, lastModified: d('2026-03-10'), changeFrequency: 'yearly',  priority: 0.5  },

    // ── Legal ─────────────────────────────────────────────────────────────
    { url: `${BASE}/privacy`,       lastModified: d('2026-03-01'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`,         lastModified: d('2026-03-01'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/dpa`,           lastModified: d('2026-03-01'), changeFrequency: 'yearly', priority: 0.25 },
    { url: `${BASE}/accessibility`, lastModified: d('2026-03-01'), changeFrequency: 'yearly', priority: 0.25 },
  ]
}
