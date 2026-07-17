// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Web Scanner v2.0 Type Definitions
// ════════════════════════════════════════════════════════════════════════════

export interface ScannedPage {
  url: string
  title: string
  description: string
  textContent: string
  wordCount: number
  contentType: 'article' | 'product' | 'homepage' | 'forum' | 'documentation' | 'other'
  headings: string[]
  imageUrls: string[]
  links: DiscoveredLink[]
  fetchMethod: 'direct' | 'jina' | 'cache'
  publishDate?: string
  author?: string
  language?: string
  metaKeywords?: string
  // Analysis results
  aiScore: number
  verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'
  confidence: number
  ensembleSignals: EnsembleSignals
  topFindings: string[]
  stylometry: StylometryResult
  isSpun: boolean
  isThinContent: boolean
  contentDepthScore: number
  perplexityScore: number
  aiArtifacts: AIArtifact[]
  sentenceScores: SentenceScore[]
}

export interface DiscoveredLink {
  url: string
  text: string
  isInternal: boolean
  priority: number // 0-100, higher = scan first
}

export interface EnsembleSignals {
  hfEnsemble: number | null
  linguisticBrain: number
  perplexityBurst: number
  stylometricFlag: boolean
  isSpun: boolean
  isThinContent: boolean
  voiceDiversity: number
  informationDensity: number
}

export interface StylometryResult {
  meanSentenceLength: number
  typeTokenRatio: number
  hapaxLegomenaRate: number
  functionWordFreq: Record<string, number>
  punctuationPattern: string
  sentenceLengthCV: number
  lexicalDiversity: number
}

export interface AIArtifact {
  type: 'phrase' | 'watermark' | 'prompt_residue' | 'unicode_evasion' | 'transition_overuse'
  evidence: string
  severity: 'high' | 'medium' | 'low'
}

export interface SentenceScore {
  text: string
  aiScore: number
  perplexity: number
}

export interface ScannedImage {
  url: string
  aiScore: number
  verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'
  modelUsed: string
  exifFlags: string[]
  elaUniformity: number
  dctAnomaly: number
  colorFingerprint: string
  thumbnail?: string // base64 thumbnail for display
  width?: number
  height?: number
}

export interface WordPressInfo {
  isWordPress: boolean
  version?: string
  theme?: string
  plugins: WPPlugin[]
  aiPluginsDetected: string[]
  generatorMeta?: string
  gutenbergBlocks: number
  classicEditorContent: boolean
}

export interface WPPlugin {
  slug: string
  name?: string
  hasVulnerability: boolean
  severity?: 'critical' | 'high' | 'medium' | 'low'
  aiRelated: boolean
}

export interface SectionHeatmap {
  pathPrefix: string
  pageCount: number
  avgAiScore: number
  aiContentPercent: number
  totalWords: number
}

export interface SiteTrustScore {
  transparencyScore: number
  linkTrustScore: number
  sslScore: number
  domainAgeScore: number
  hasContactPage: boolean
  hasPrivacyPolicy: boolean
  hasTermsOfService: boolean
  hasPhysicalAddress: boolean
  authorityOutlinks: number
  spamOutlinks: number
  internalPageRank: Record<string, number>
}

export interface ContentIntegritySeal {
  hash: string
  timestamp: string
  verificationUrl: string
}

export interface RemediationItem {
  type: 'page' | 'image' | 'plugin' | 'section'
  url?: string
  imageUrl?: string
  pluginSlug?: string
  sectionPrefix?: string
  action: string
  reason: string
  priority: 'critical' | 'high' | 'medium' | 'low'
}

export interface TimelineComparison {
  isRescan: boolean
  previousScanDate?: string
  newAiPages: string[]
  scoreJumps: { url: string; oldScore: number; newScore: number }[]
  contentVelocity: number // % growth per month
  pagesRemoved: string[]
  pagesAdded: string[]
}

export interface SiteScanResult {
  success: boolean
  origin: string
  domain: string
  isWordPress: boolean
  wordPressInfo?: WordPressInfo
  discoveryMethod: 'sitemap' | 'crawl' | 'hybrid'
  pagesScanned: number
  maxPages: number
  aiContentPercent: number
  aiImagePercent: number
  humanContentPercent: number
  uncertainContentPercent: number
  totalImagesAnalyzed: number
  aiImagesCount: number
  realImagesCount: number
  // New intelligence fields
  contentOriginalityScore: number
  voiceDiversityIndex: number
  transparencyScore: number
  linkTrustScore: number
  siteTrustScore: SiteTrustScore
  sectionsHeatmap: SectionHeatmap[]
  timeline: TimelineComparison
  wordPressPlugins: WPPlugin[]
  pages: ScannedPage[]
  images: ScannedImage[]
  remediation: RemediationItem[]
  integritySeal: ContentIntegritySeal
  processingTimeMs: number
  modelUsed: string
  fetchStats: {
    direct: number
    jina: number
    cache: number
    failed: number
  }
}

export interface CrawlOptions {
  maxPages?: number
  maxImagesTotal?: number
  maxDepth?: number
  priorityBFS?: boolean
  includeImageAnalysis?: boolean
  includeSubPageText?: boolean
  scanImages?: boolean
  respectRobots?: boolean
}

export const DEFAULT_CRAWL_OPTS: CrawlOptions = {
  maxPages: 30,
  maxImagesTotal: 20,
  maxDepth: 2,
  priorityBFS: true,
  includeImageAnalysis: true,
  includeSubPageText: true,
  scanImages: true,
  respectRobots: true,
}
