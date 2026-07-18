// ════════════════════════════════════════════════════════════════════════════
// ARIA — Vector-Less RAG Engine
// No embeddings, no vector DB, no paid APIs
// Uses keyword-based retrieval + structured knowledge + web search fallback
// ════════════════════════════════════════════════════════════════════════════

export interface KnowledgeEntry {
  id: string
  keywords: string[]
  category: string
  content: string
  source?: string
}

export interface RetrievedContext {
  entries: KnowledgeEntry[]
  confidence: number
  source: 'knowledge_base' | 'web_search' | 'hybrid'
}

// ════════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE KNOWLEDGE BASE — AI Detection Industry
// ════════════════════════════════════════════════════════════════════════════

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ── AISCERN Platform ──
  {
    id: "aiscern-overview",
    keywords: ["aiscern", "platform", "overview", "what is", "features", "capabilities"],
    category: "platform",
    content: `AISCERN is a forensic content authenticity platform that detects AI-generated text, images, audio, and video across websites and individual files. Unlike simple classifiers, AISCERN uses multi-layer ensemble detection: linguistic brain analysis, stylometric fingerprinting, perplexity burst detection, EXIF forensics, ELA (Error Level Analysis), DCT anomaly detection, and site-level trust scoring. The platform supports deep website crawling with WordPress plugin fingerprinting, content originality scoring, and actionable remediation reports.`,
    source: "AISCERN Documentation",
  },
  {
    id: "aiscern-text",
    keywords: ["aiscern", "text", "detection", "how it works", "linguistic", "brain"],
    category: "text_detection",
    content: `AISCERN's text detection engine combines multiple zero-API signals: (1) Linguistic Brain — analyzes sentence length variance, type-token ratio, hapax legomena rate, and function word distribution; (2) Perplexity Burst — uses n-gram language models to detect unnaturally even perplexity, a hallmark of LLM output; (3) AI Artifact Detection — flags LLM stop phrases ("In conclusion", "It's important to note"), transition overuse, zero-width character watermarks, and prompt residue; (4) Stylometric Consistency — computes Voice Diversity Index across pages to detect single-source generation; (5) Duplicity Analysis — SimHash fingerprinting clusters near-duplicate content. No Gemini or OpenAI API required.`,
    source: "AISCERN Technical Docs",
  },
  {
    id: "aiscern-image",
    keywords: ["aiscern", "image", "detection", "forensics", "ela", "dct", "exif"],
    category: "image_detection",
    content: `AISCERN's image forensics engine runs entirely without external APIs. It performs: (1) EXIF metadata parsing — detects Stable Diffusion, Midjourney, DALL-E, ComfyUI, and Firefly signatures in Software/UserComment fields, flags contradictory metadata (Apple device + Photoshop); (2) ELA Simulation — analyzes re-compression uniformity, AI images show unnaturally uniform error levels; (3) DCT Coefficient Analysis — detects distinctive GAN/diffusion signatures in JPEG quantization tables; (4) Color Fingerprinting — entropy analysis reveals narrower color distributions typical of AI generation.`,
    source: "AISCERN Technical Docs",
  },
  {
    id: "aiscern-audio",
    keywords: ["aiscern", "audio", "voice", "detection", "tts", "deepfake"],
    category: "audio_detection",
    content: `AISCERN's audio detection analyzes spectral features to distinguish synthetic speech from human voice: spectral centroid, flatness, zero-crossing rate, harmonic-to-noise ratio (HNR), jitter, shimmer, fundamental frequency (F0) mean and standard deviation, MFCC variance, and subband energy variance. The ensemble combines these signals with a weighted vote. TTS artifacts often show unnaturally consistent pitch (low F0 std), perfect harmonic structure (high HNR), and reduced micro-tremors (low jitter/shimmer).`,
    source: "AISCERN Technical Docs",
  },
  {
    id: "aiscern-web",
    keywords: ["aiscern", "web", "scanner", "website", "crawl", "forensic"],
    category: "web_scanning",
    content: `The AISCERN Forensic Scanner crawls websites using priority-based BFS with stealth headers, falling back to Jina AI and Google Cache for protected sites. It performs: site architecture mapping, WordPress deep scanning (plugin/theme extraction, AI plugin fingerprinting like "AI Content Writer" or "Bertha AI"), Gutenberg block analysis, content originality scoring via SimHash clustering, section heatmaps showing AI content distribution by URL path, internal PageRank computation, transparency scoring (contact page, privacy policy, terms detection), and link trust analysis (authority vs spam outlinks).`,
    source: "AISCERN Technical Docs",
  },

  // ── Competitors: GPTZero ──
  {
    id: "gptzero",
    keywords: ["gptzero", "compare", "vs", "versus", "alternative", "competitor"],
    category: "competitors",
    content: `GPTZero is a popular AI text detection tool founded by Edward Tian. It uses perplexity and burstiness metrics to flag AI-generated text. Strengths: fast, simple UI, widely recognized. Weaknesses: struggles with hybrid human-AI text, false positives on technical writing, no image/audio support, limited forensic depth, no site-level analysis. AISCERN differs by offering multi-signal ensemble detection (not just perplexity), image/audio forensics, website crawling, WordPress plugin detection, and remediation reports — all without requiring paid API keys for core functionality.`,
    source: "Industry Analysis",
  },

  // ── Competitors: Originality.AI ──
  {
    id: "originality-ai",
    keywords: ["originality", "originality.ai", "compare", "vs", "alternative"],
    category: "competitors",
    content: `Originality.AI is a paid detection service focusing on AI content detection for publishers and SEO professionals. It offers Chrome extension, API, and team features. Strengths: high accuracy on long-form content, plagiarism checking integration, team collaboration. Weaknesses: requires paid subscription ($14.95/month), no image/audio detection, no website crawling, no forensic signal breakdown. AISCERN provides comparable text accuracy with additional image forensics, audio detection, and site-wide scanning at zero API cost.`,
    source: "Industry Analysis",
  },

  // ── Competitors: Copyleaks ──
  {
    id: "copyleaks",
    keywords: ["copyleaks", "compare", "vs", "alternative", "plagiarism"],
    category: "competitors",
    content: `Copyleaks offers AI content detection alongside plagiarism checking and code analysis. It supports multiple languages and provides LMS integrations. Strengths: enterprise features, LMS integration, multi-language, API access. Weaknesses: expensive for individuals ($13.99/month), no image/audio forensics, no website scanning, limited transparency in detection methodology. AISCERN focuses on deep forensic analysis with explainable signals rather than black-box scoring.`,
    source: "Industry Analysis",
  },

  // ── Competitors: ZeroGPT ──
  {
    id: "zerogpt",
    keywords: ["zerogpt", "compare", "vs", "alternative", "free"],
    category: "competitors",
    content: `ZeroGPT is a free AI text detector with premium tiers. It uses a modified perplexity approach. Strengths: free tier available, simple interface, fast results. Weaknesses: lower accuracy than competitors, frequent false positives, no multimedia support, no API for developers, ads on free tier. AISCERN offers more robust detection with zero-cost local computation and no advertisements.`,
    source: "Industry Analysis",
  },

  // ── Competitors: Hive Moderation ──
  {
    id: "hive",
    keywords: ["hive", "hive moderation", "compare", "vs", "image", "api"],
    category: "competitors",
    content: `Hive Moderation provides AI-generated content detection via API, specializing in images and text. Used by platforms for content moderation. Strengths: strong image detection, API-first, enterprise scale. Weaknesses: expensive API pricing, no free tier for meaningful volume, no website crawling, no forensic explainability. AISCERN's image forensics runs entirely client-side or serverless without per-request costs.`,
    source: "Industry Analysis",
  },

  // ── Competitors: Illuminarty ──
  {
    id: "illuminarty",
    keywords: ["illuminarty", "compare", "vs", "image", "ai art"],
    category: "competitors",
    content: `Illuminarty focuses specifically on AI-generated image detection (Midjourney, DALL-E, Stable Diffusion). It offers browser extension and API. Strengths: specialized for art/images, good accuracy on known generators. Weaknesses: no text/audio support, limited to image analysis, paid API. AISCERN covers images plus text, audio, and web scanning with free local forensics.`,
    source: "Industry Analysis",
  },

  // ── Competitors: Undetectable.AI ──
  {
    id: "undetectable",
    keywords: ["undetectable", "undetectable.ai", "compare", "vs", "humanize"],
    category: "competitors",
    content: `Undetectable.AI is a dual-purpose tool: it detects AI text AND rewrites it to bypass detection ("humanizer"). Strengths: two-in-one functionality, paraphrasing features. Weaknesses: ethically controversial, detection accuracy is secondary to bypassing, no image/audio, expensive ($14.99/month). AISCERN focuses purely on detection and forensics without offering bypass tools.`,
    source: "Industry Analysis",
  },

  // ── Technical Concepts ──
  {
    id: "perplexity",
    keywords: ["perplexity", "burstiness", "n-gram", "language model", "how it works"],
    category: "technical",
    content: `Perplexity measures how "surprised" a language model is by text. Human writing has high perplexity variance (some sentences are predictable, others surprising). AI text has low, unnaturally even perplexity because LLMs optimize for the most probable next token. Burstiness quantifies this variance. AISCERN uses a lightweight 4-gram model built from the text itself to compute per-sentence perplexity and detect the "flatline" pattern characteristic of AI generation.`,
    source: "NLP Research",
  },
  {
    id: "ela",
    keywords: ["ela", "error level analysis", "image forensics", "compression"],
    category: "technical",
    content: `Error Level Analysis (ELA) works by re-compressing an image and comparing it to the original. Areas with high error (bright in ELA) indicate natural variation from editing. AI-generated images often show unnaturally uniform ELA because they lack the compression artifacts introduced by real cameras and editing workflows. AISCERN simulates ELA by analyzing JPEG quantization table consistency and block periodicity without requiring external tools.`,
    source: "Digital Forensics",
  },
  {
    id: "exif",
    keywords: ["exif", "metadata", "image", "stable diffusion", "midjourney"],
    category: "technical",
    content: `EXIF (Exchangeable Image File Format) metadata embedded in JPEGs reveals camera information, software used, and generation parameters. AI image generators often leave signatures: Stable Diffusion writes "Software: Stable Diffusion" or includes generation parameters (prompt, seed, CFG scale) in UserComment. Midjourney and DALL-E also embed software tags. AISCERN parses EXIF directly from binary JPEG data without external libraries, detecting these signatures and flagging contradictory metadata (e.g., Apple iPhone make + Stable Diffusion software).`,
    source: "Digital Forensics",
  },
  {
    id: "stylometry",
    keywords: ["stylometry", "voice diversity", "writing style", "fingerprint"],
    category: "technical",
    content: `Stylometry analyzes writing style through statistical features: mean sentence length, type-token ratio (unique words / total words), hapax legomena rate (words appearing exactly once), function word frequency distribution, punctuation patterns, and sentence length coefficient of variation. Human authors show natural variance across pieces. AI-generated content clusters tightly because it comes from a single model with fixed parameters. AISCERN computes a Voice Diversity Index across all pages of a website — low diversity strongly suggests single-source AI generation.`,
    source: "Computational Linguistics",
  },
  {
    id: "wordpress-ai",
    keywords: ["wordpress", "ai plugin", "ai content writer", "bertha", "automation"],
    category: "technical",
    content: `WordPress sites using AI content plugins leave detectable fingerprints: (1) Plugin URLs in source code (wp-content/plugins/ai-content-writer/); (2) AI-specific CSS classes and markup patterns; (3) Gutenberg block comments with AI-typical paragraph structures; (4) Generator meta tags; (5) Bulk-posted content with identical timestamps. Common AI WordPress plugins: AI Content Writer, Bertha AI, Copymatic, AI Engine (Meow Apps), ContentBot, Writecream. AISCERN detects these by scanning HTML source, script/style URLs, and block patterns.`,
    source: "Web Forensics",
  },

  // ── Best Practices ──
  {
    id: "best-practices",
    keywords: ["best practice", "workflow", "how to", "authenticate", "verify"],
    category: "guidance",
    content: `Best practices for content authenticity: (1) Multi-modal verification — don't rely on text alone; check images with EXIF + ELA, audio with spectral analysis; (2) Site-level analysis — individual pages can be human while the site pattern reveals AI; (3) Look for forensic signals, not just scores — understand WHY content is flagged; (4) Check publication velocity — AI sites often publish dozens of articles simultaneously; (5) Verify source transparency — real publishers have contact info, author bios, and editorial policies; (6) Use multiple tools — no single detector is perfect, ensemble approaches reduce false positives.`,
    source: "AISCERN Guidance",
  },
  {
    id: "false-positives",
    keywords: ["false positive", "accuracy", "reliability", "trust", "human flagged"],
    category: "guidance",
    content: `False positives occur when human content is flagged as AI. Common causes: highly formal writing (legal, academic), non-native English with simple sentence structures, heavily edited content that lost natural variance, technical writing with consistent terminology. To reduce false positives: (1) Check multiple signals — if only perplexity is high but stylometry is normal, it's likely human; (2) Consider context — a PhD thesis should have different expectations than a blog post; (3) Look for human artifacts — typos, informal transitions, cultural references, personal anecdotes; (4) Use site-level analysis — one suspicious page doesn't indict an entire site.`,
    source: "AISCERN Guidance",
  },

  // ── Industry Trends ──
  {
    id: "industry-trends",
    keywords: ["trend", "future", "industry", "ai detection", "deepfake", "regulation"],
    category: "industry",
    content: `AI detection industry trends (2025-2026): (1) Regulatory pressure — EU AI Act requires labeling of AI-generated content; US states introducing deepfake disclosure laws; (2) Generator-evasion arms race — tools like Undetectable.AI and humanizers make detection harder; (3) Multi-modal focus — text-only detection is insufficient as AI video/audio improves; (4) Watermarking standards — C2PA (Content Authenticity Initiative) gaining traction for image provenance; (5) On-device detection — privacy concerns pushing computation to edge devices; (6) Forensic explainability — users demand to know WHY content was flagged, not just scores. AISCERN is positioned at the intersection of these trends with free, explainable, multi-modal detection.`,
    source: "Industry Analysis 2026",
  },
]

// ════════════════════════════════════════════════════════════════════════════
// RETRIEVAL ENGINE
// ════════════════════════════════════════════════════════════════════════════

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

function computeRelevance(query: string, entry: KnowledgeEntry): number {
  const queryTokens = new Set(tokenize(query))
  let score = 0
  let matchedKeywords = 0

  for (const keyword of entry.keywords) {
    const kwTokens = tokenize(keyword)
    for (const qt of queryTokens) {
      for (const kt of kwTokens) {
        // Exact match
        if (qt === kt) {
          score += 3
          matchedKeywords++
        }
        // Partial match
        else if (qt.includes(kt) || kt.includes(qt)) {
          score += 1.5
          matchedKeywords++
        }
        // Levenshtein-like proximity for typos
        else if (editDistance(qt, kt) <= 2) {
          score += 0.5
        }
      }
    }
  }

  // Boost for content matches
  const contentTokens = tokenize(entry.content)
  for (const qt of queryTokens) {
    if (contentTokens.some((ct) => ct === qt)) {
      score += 0.3
    }
  }

  // Normalize by keyword count
  return score / Math.max(entry.keywords.length, 1)
}

function editDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
    }
  }
  return matrix[b.length][a.length]
}

export function retrieveContext(query: string, topK = 5): RetrievedContext {
  const scored = KNOWLEDGE_BASE.map((entry) => ({
    entry,
    score: computeRelevance(query, entry),
  }))

  scored.sort((a, b) => b.score - a.score)

  const threshold = 0.5
  const relevant = scored.filter((s) => s.score >= threshold).slice(0, topK)

  if (relevant.length === 0) {
    // Fallback: return top 3 anyway with lower confidence
    return {
      entries: scored.slice(0, 3).map((s) => s.entry),
      confidence: 0.3,
      source: "knowledge_base",
    }
  }

  const avgScore = relevant.reduce((a, b) => a + b.score, 0) / relevant.length
  const confidence = Math.min(0.95, avgScore / 3)

  return {
    entries: relevant.map((s) => s.entry),
    confidence,
    source: "knowledge_base",
  }
}

export function buildSystemPrompt(context: RetrievedContext): string {
  const contextText = context.entries
    .map((e, i) => `[${i + 1}] ${e.category.toUpperCase()}: ${e.content}`)
    .join("\n\n")

  return `You are Aria, the forensic AI assistant for AISCERN — a content authenticity platform. You help users understand AI detection, compare tools, and interpret forensic signals.

Use the following knowledge to answer. If the knowledge doesn't cover the question, say so honestly and provide general guidance based on your understanding of AI detection.

RETRIEVED KNOWLEDGE:
${contextText}

GUIDELINES:
- Be concise but thorough. Use bullet points for lists.
- When comparing tools, be fair — acknowledge strengths and weaknesses of each.
- Cite sources when possible.
- If asked about pricing or features you don't know, say "I don't have current pricing data" rather than guessing.
- For technical questions, explain concepts in accessible language first, then provide detail.
- Never claim AISCERN is "the best" — let the features speak for themselves.
- Response confidence: ${(context.confidence * 100).toFixed(0)}% based on knowledge match.`
}

// ════════════════════════════════════════════════════════════════════════════
// WEB SEARCH FALLBACK (Free — uses DuckDuckGo or SearX)
// ════════════════════════════════════════════════════════════════════════════

export async function webSearchFallback(query: string): Promise<string> {
  try {
    // Try DuckDuckGo Lite (no API key, no CORS issues in serverless)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " AI detection")}`
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return ""

    const html = await res.text()
    // Extract first few result snippets
    const snippets: string[] = []
    const matches = html.matchAll(/class="result__snippet">([^<]+)/g)
    for (const match of matches) {
      if (snippets.length >= 3) break
      snippets.push(match[1].trim())
    }

    return snippets.length > 0
      ? `Recent web results:\n${snippets.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : ""
  } catch {
    return ""
  }
}
