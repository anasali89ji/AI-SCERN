"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Globe,
  Search,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  FileText,
  Layers,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lock,
  Zap,
  BarChart3,
  Fingerprint,
  Cpu,
  Sparkles,
  Loader2,
  ScanLine,
  BrainCircuit,
  Eye,
  ArrowRight,
  Activity
} from "lucide-react"
import type { SiteScanResult, ScannedPage, ScannedImage, RemediationItem } from "@/lib/scanner/types"

export default function ScannerPage() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SiteScanResult | null>(null)
  const [error, setError] = useState("")
  const [expandedPage, setExpandedPage] = useState<string | null>(null)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [scanProgress, setScanProgress] = useState(0)
  const progressRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [])

  async function handleScan() {
    if (!url.trim()) return
    setLoading(true)
    setError("")
    setResult(null)
    setScanProgress(0)

    // Simulate progress while scanning
    progressRef.current = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 8
      })
    }, 800)

    try {
      const res = await fetch("/api/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          maxPages: 25,
          maxImagesTotal: 20,
          maxDepth: 2,
        }),
      })

      if (progressRef.current) clearInterval(progressRef.current)
      setScanProgress(100)

      const data = await res.json()
      if (!data.success) {
        setError(data.error || "Scan failed")
      } else {
        setResult(data)
      }
    } catch (err) {
      if (progressRef.current) clearInterval(progressRef.current)
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
      setTimeout(() => setScanProgress(0), 500)
    }
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "pages", label: `Pages (${result?.pages.length ?? 0})` },
    { id: "images", label: `Images (${result?.images.length ?? 0})` },
    { id: "heatmap", label: "Heatmap" },
    { id: "remediation", label: "Remediation" },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ScanLine className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Forensic Scanner</h1>
          <p className="text-sm text-slate-500">
            Deep-content authenticity analysis. Maps site architecture, detects synthetic media, and surfaces forensic signals across every page.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0f0f17] p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder="https://example.com"
              className="w-full bg-[#141420] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <button
            onClick={handleScan}
            disabled={loading || !url.trim()}
            className="px-4 py-2.5 rounded-xl bg-primary text-bg font-semibold text-sm flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Scanning..." : "Deep Scan"}
          </button>
        </div>

        {/* Progress Bar */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-pulse" />
                  Crawling site structure...
                </span>
                <span>{Math.round(scanProgress)}%</span>
              </div>
              <div className="h-1.5 bg-[#141420] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-cyan-400 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${scanProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </motion.div>
        )}
      </div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Top Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<FileText className="w-5 h-5" />}
                label="AI Content"
                value={`${result.aiContentPercent}%`}
                sub={`${result.pagesScanned} pages scanned`}
                color={result.aiContentPercent > 50 ? "rose" : result.aiContentPercent > 20 ? "amber" : "emerald"}
              />
              <StatCard
                icon={<ImageIcon className="w-5 h-5" />}
                label="AI Images"
                value={`${result.aiImagePercent}%`}
                sub={`${result.totalImagesAnalyzed} images analyzed`}
                color={result.aiImagePercent > 30 ? "rose" : result.aiImagePercent > 10 ? "amber" : "emerald"}
              />
              <StatCard
                icon={<Shield className="w-5 h-5" />}
                label="Trust Score"
                value={`${Math.round((result.siteTrustScore.transparencyScore + result.siteTrustScore.linkTrustScore) / 2 * 100)}%`}
                sub={`${result.siteTrustScore.authorityOutlinks} authority links`}
                color={result.siteTrustScore.transparencyScore > 0.6 ? "emerald" : "amber"}
              />
              <StatCard
                icon={<Fingerprint className="w-5 h-5" />}
                label="Originality"
                value={`${Math.round(result.contentOriginalityScore * 100)}%`}
                sub={`Voice diversity: ${(result.voiceDiversityIndex * 100).toFixed(0)}%`}
                color={result.contentOriginalityScore > 0.6 ? "emerald" : "amber"}
              />
            </div>

            {/* WordPress Badge */}
            {result.isWordPress && (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0f0f17] p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    WordPress {result.wordPressInfo?.version || ""}
                  </span>
                  {result.wordPressInfo?.theme && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-[#141420] text-slate-400 border border-white/5">
                      Theme: {result.wordPressInfo.theme}
                    </span>
                  )}
                  {result.wordPressInfo?.aiPluginsDetected.map((slug) => (
                    <span key={slug} className="text-xs px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {slug}
                    </span>
                  ))}
                  {result.wordPressInfo?.plugins.filter(p => p.hasVulnerability).map((p) => (
                    <span key={p.slug} className="text-xs px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {p.slug} ({p.severity})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#0f0f17] overflow-hidden">
              <div className="flex border-b border-white/[0.07] overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? "text-primary border-b-2 border-primary"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-4 sm:p-5">
                {activeTab === "overview" && <OverviewTab result={result} />}
                {activeTab === "pages" && (
                  <div className="space-y-3">
                    {result.pages.map((page) => (
                      <PageCard
                        key={page.url}
                        page={page}
                        expanded={expandedPage === page.url}
                        onToggle={() => setExpandedPage(expandedPage === page.url ? null : page.url)}
                      />
                    ))}
                  </div>
                )}
                {activeTab === "images" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {result.images.map((img) => (
                      <ImageCard
                        key={img.url}
                        image={img}
                        expanded={expandedImage === img.url}
                        onToggle={() => setExpandedImage(expandedImage === img.url ? null : img.url)}
                      />
                    ))}
                  </div>
                )}
                {activeTab === "heatmap" && <HeatmapTab result={result} />}
                {activeTab === "remediation" && <RemediationTab result={result} />}
              </div>
            </div>

            {/* Integrity Seal */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#0f0f17] p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-slate-500">Integrity Seal:</span>
                  <code className="text-xs bg-[#141420] px-2 py-1 rounded text-primary font-mono">
                    {result.integritySeal.hash}
                  </code>
                </div>
                <a
                  href={result.integritySeal.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  Verify <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Sub-Components ── */

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    rose: "border-rose-500/30 bg-rose-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
  }
  const textMap: Record<string, string> = {
    rose: "text-rose-400",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
  }
  return (
    <div className={`rounded-2xl border ${colorMap[color]} p-4`}>
      <div className="flex items-center gap-2 text-slate-500 mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className={`text-3xl font-black ${textMap[color]}`}>{value}</div>
      <div className="text-xs text-slate-600 mt-1">{sub}</div>
    </div>
  )
}

function OverviewTab({ result }: { result: SiteScanResult }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/[0.07] bg-[#141420] p-4">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-primary" />
            Site Trust Analysis
          </h3>
          <div className="space-y-3">
            <MetricRow label="Transparency" value={result.siteTrustScore.transparencyScore} />
            <MetricRow label="Link Trust" value={result.siteTrustScore.linkTrustScore} />
            <MetricRow label="SSL Security" value={result.siteTrustScore.sslScore / 100} />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <TrustIndicator label="Contact Page" present={result.siteTrustScore.hasContactPage} />
              <TrustIndicator label="Privacy Policy" present={result.siteTrustScore.hasPrivacyPolicy} />
              <TrustIndicator label="Terms of Service" present={result.siteTrustScore.hasTermsOfService} />
              <TrustIndicator label="Physical Address" present={result.siteTrustScore.hasPhysicalAddress} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#141420] p-4">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            Content Intelligence
          </h3>
          <div className="space-y-3">
            <MetricRow label="Content Originality" value={result.contentOriginalityScore} />
            <MetricRow label="Voice Diversity" value={result.voiceDiversityIndex} />
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">AI Pages</span>
              <span className="text-rose-400 font-medium">
                {result.pages.filter(p => p.verdict === "AI").length} / {result.pagesScanned}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Human Pages</span>
              <span className="text-emerald-400 font-medium">
                {result.pages.filter(p => p.verdict === "HUMAN").length} / {result.pagesScanned}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">AI Images</span>
              <span className="text-rose-400 font-medium">
                {result.aiImagesCount} / {result.totalImagesAnalyzed}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Real Images</span>
              <span className="text-emerald-400 font-medium">
                {result.realImagesCount} / {result.totalImagesAnalyzed}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-white/[0.07] bg-[#141420] p-4">
        <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-yellow-400" />
          Crawl Statistics
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-[#0f0f17] rounded-xl">
            <div className="text-2xl font-bold text-emerald-400">{result.fetchStats.direct}</div>
            <div className="text-xs text-slate-600">Direct Fetch</div>
          </div>
          <div className="text-center p-3 bg-[#0f0f17] rounded-xl">
            <div className="text-2xl font-bold text-primary">{result.fetchStats.jina}</div>
            <div className="text-xs text-slate-600">Jina AI Fallback</div>
          </div>
          <div className="text-center p-3 bg-[#0f0f17] rounded-xl">
            <div className="text-2xl font-bold text-amber-400">{result.fetchStats.cache}</div>
            <div className="text-xs text-slate-600">Google Cache</div>
          </div>
          <div className="text-center p-3 bg-[#0f0f17] rounded-xl">
            <div className="text-2xl font-bold text-rose-400">{result.fetchStats.failed}</div>
            <div className="text-xs text-slate-600">Failed</div>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-600 text-center">
          Processed in {(result.processingTimeMs / 1000).toFixed(1)}s using {result.modelUsed}
        </div>
      </div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-500">{label}</span>
        <span className={pct > 60 ? "text-emerald-400" : pct > 30 ? "text-amber-400" : "text-rose-400"}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 bg-[#0f0f17] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct > 60 ? "bg-emerald-500" : pct > 30 ? "bg-amber-500" : "bg-rose-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function TrustIndicator({ label, present }: { label: string; present: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${present ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
      {present ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </div>
  )
}

function HeatmapTab({ result }: { result: SiteScanResult }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#141420] p-4">
      <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-primary" />
        Content Section Heatmap
      </h3>
      <div className="space-y-3">
        {result.sectionsHeatmap.map((section) => (
          <div key={section.pathPrefix} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300 font-mono">{section.pathPrefix}</span>
              <span className="text-slate-500">{section.pageCount} pages · {section.totalWords.toLocaleString()} words</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-[#0f0f17] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${section.aiContentPercent > 60 ? "bg-rose-500" : section.aiContentPercent > 30 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${section.aiContentPercent}%` }}
                />
              </div>
              <span className={`text-sm font-medium w-12 text-right ${section.aiContentPercent > 60 ? "text-rose-400" : section.aiContentPercent > 30 ? "text-amber-400" : "text-emerald-400"}`}>
                {section.aiContentPercent.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RemediationTab({ result }: { result: SiteScanResult }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#141420] p-4">
      <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        Actionable Remediation Report
      </h3>
      {result.remediation.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
          <p>No critical issues found. Your content looks authentic!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {result.remediation.map((item, i) => (
            <RemediationCard key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function PageCard({ page, expanded, onToggle }: { page: ScannedPage; expanded: boolean; onToggle: () => void }) {
  const borderClass = page.verdict === "AI" ? "border-rose-500/30 bg-rose-500/5" :
    page.verdict === "HUMAN" ? "border-emerald-500/30 bg-emerald-500/5" :
    "border-amber-500/30 bg-amber-500/5"

  return (
    <div className={`rounded-xl border ${borderClass} p-4 transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${page.verdict === "AI" ? "bg-rose-500/20 text-rose-400" : page.verdict === "HUMAN" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
              {page.verdict}
            </span>
            <span className="text-xs text-slate-600">{page.contentType}</span>
            <span className="text-xs text-slate-600">{page.wordCount} words</span>
            <span className="text-xs text-slate-600">{page.fetchMethod}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-200 truncate">{page.title}</h3>
          <p className="text-xs text-slate-600 truncate">{page.url}</p>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-xl font-bold ${page.aiScore > 0.6 ? "text-rose-400" : page.aiScore < 0.4 ? "text-emerald-400" : "text-amber-400"}`}>
            {(page.aiScore * 100).toFixed(0)}%
          </div>
          <button onClick={onToggle} className="text-slate-600 hover:text-slate-300">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-white/[0.07] pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <SignalBadge label="Linguistic Brain" value={page.ensembleSignals.linguisticBrain} />
            <SignalBadge label="Perplexity Burst" value={page.ensembleSignals.perplexityBurst} />
            <SignalBadge label="Info Density" value={page.ensembleSignals.informationDensity} />
            <SignalBadge label="Voice Diversity" value={page.ensembleSignals.voiceDiversity} />
            <div className={`p-2 rounded-lg text-xs ${page.ensembleSignals.stylometricFlag ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
              Stylometric: {page.ensembleSignals.stylometricFlag ? "Flagged" : "Normal"}
            </div>
            <div className={`p-2 rounded-lg text-xs ${page.isSpun ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
              Spun: {page.isSpun ? "Yes" : "No"}
            </div>
          </div>
          {page.topFindings.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-500 mb-1">Top Findings</h4>
              <div className="flex flex-wrap gap-1">
                {page.topFindings.map((f, i) => (
                  <span key={i} className="text-xs bg-[#0f0f17] text-slate-300 px-2 py-1 rounded-lg border border-white/5">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          {page.aiArtifacts.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-500 mb-1">AI Artifacts</h4>
              <div className="space-y-1">
                {page.aiArtifacts.map((a, i) => (
                  <div key={i} className={`text-xs p-2 rounded-lg ${a.severity === "high" ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"}`}>
                    <span className="font-bold uppercase">{a.type}</span>: {a.evidence}
                  </div>
                ))}
              </div>
            </div>
          )}
          {page.sentenceScores.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-500 mb-1">Sentence-Level Analysis</h4>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {page.sentenceScores.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <div className={`w-8 text-right font-mono shrink-0 ${s.aiScore > 0.6 ? "text-rose-400" : s.aiScore < 0.4 ? "text-emerald-400" : "text-amber-400"}`}>
                      {(s.aiScore * 100).toFixed(0)}%
                    </div>
                    <div className="text-slate-500 truncate">{s.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600">
            <div>Mean Sentence: {page.stylometry.meanSentenceLength}</div>
            <div>Type-Token Ratio: {page.stylometry.typeTokenRatio}</div>
            <div>Hapax Rate: {page.stylometry.hapaxLegomenaRate}</div>
            <div>Sentence CV: {page.stylometry.sentenceLengthCV}</div>
            <div>Lexical Div: {page.stylometry.lexicalDiversity}</div>
            <div>Depth Score: {page.contentDepthScore}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function SignalBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className={`p-2 rounded-lg text-xs ${value > 0.6 ? "bg-rose-500/10 text-rose-400" : value < 0.4 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
      <div className="opacity-70 text-[10px]">{label}</div>
      <div className="font-bold">{(value * 100).toFixed(0)}%</div>
    </div>
  )
}

function ImageCard({ image, expanded, onToggle }: { image: ScannedImage; expanded: boolean; onToggle: () => void }) {
  const borderClass = image.verdict === "AI" ? "border-rose-500/30 bg-rose-500/5" :
    image.verdict === "HUMAN" ? "border-emerald-500/30 bg-emerald-500/5" :
    "border-amber-500/30 bg-amber-500/5"
  return (
    <div className={`rounded-xl border ${borderClass} p-4`}>
      <div className="flex items-start gap-3">
        <div className="w-16 h-16 bg-[#0f0f17] rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
          <img src={image.url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} loading="lazy" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${image.verdict === "AI" ? "bg-rose-500/20 text-rose-400" : image.verdict === "HUMAN" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>{image.verdict}</span>
            <span className="text-xs text-slate-600">{image.modelUsed}</span>
          </div>
          <p className="text-xs text-slate-600 truncate">{image.url.split("/").pop()}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-lg font-bold ${image.aiScore > 0.6 ? "text-rose-400" : image.aiScore < 0.4 ? "text-emerald-400" : "text-amber-400"}`}>{(image.aiScore * 100).toFixed(0)}%</span>
            <button onClick={onToggle} className="text-slate-600 hover:text-slate-300">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/[0.07] pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-[#0f0f17] rounded-lg"><span className="text-slate-600">ELA Uniformity</span><div className="font-mono text-slate-300">{image.elaUniformity}</div></div>
            <div className="p-2 bg-[#0f0f17] rounded-lg"><span className="text-slate-600">DCT Anomaly</span><div className="font-mono text-slate-300">{image.dctAnomaly}</div></div>
          </div>
          {image.exifFlags.length > 0 && (
            <div>
              <span className="text-xs text-slate-600">EXIF Flags</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {image.exifFlags.map((flag, i) => <span key={i} className="text-xs bg-[#0f0f17] text-rose-400 px-2 py-1 rounded-lg border border-white/5">{flag}</span>)}
              </div>
            </div>
          )}
          <div className="text-xs text-slate-700 font-mono">{image.colorFingerprint}</div>
        </div>
      )}
    </div>
  )
}

function RemediationCard({ item }: { item: RemediationItem }) {
  const borderClass = item.priority === "critical" ? "border-rose-500/30 bg-rose-500/5" : item.priority === "high" ? "border-orange-500/30 bg-orange-500/5" : item.priority === "medium" ? "border-amber-500/30 bg-amber-500/5" : "border-white/5 bg-[#141420]"
  const textClass = item.priority === "critical" ? "text-rose-400" : item.priority === "high" ? "text-orange-400" : item.priority === "medium" ? "text-amber-400" : "text-slate-400"
  return (
    <div className={`border ${borderClass} rounded-xl p-3`}>
      <div className="flex items-start gap-3">
        <div className={`text-xs font-bold uppercase ${textClass} shrink-0 mt-0.5`}>{item.priority}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-200">{item.action}</div>
          <div className="text-xs text-slate-600 mt-1">{item.reason}</div>
          {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 mt-1">{item.url.slice(0, 60)}... <ExternalLink className="w-3 h-3" /></a>}
          {item.imageUrl && <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 mt-1">{item.imageUrl.slice(0, 60)}... <ExternalLink className="w-3 h-3" /></a>}
        </div>
      </div>
    </div>
  )
}
