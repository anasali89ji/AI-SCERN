'use client'

/**
 * /app/forensic/[scanId]/page.tsx
 *
 * Forensic scan evidence UI — displays layer-by-layer findings,
 * semantic agent results, provenance signals, and final verdict.
 * Polls /api/v2/forensic-scan/{scanId} every 2s while processing.
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams }  from 'next/navigation'
import {
  Shield, AlertTriangle, CheckCircle, HelpCircle,
  Eye, Zap, Activity, Globe, Cpu, Layers, Clock,
  ChevronDown, ChevronUp, RefreshCw, Copy, ExternalLink,
} from 'lucide-react'
import type {
  ForensicScanRecord, LayerReport, SemanticAgentReport,
  EvidenceNode, ProvenanceReport, FinalVerdict,
} from '@/types/forensic'

// ── Helpers ───────────────────────────────────────────────────────────────────

const pct = (n: number) => `${(n * 100).toFixed(0)}%`

const LAYER_ICONS: Record<number, React.ReactNode> = {
  1: <Eye size={16} />,
  2: <Layers size={16} />,
  3: <Activity size={16} />,
  4: <Zap size={16} />,
  6: <Cpu size={16} />,
  7: <Globe size={16} />,
}

const LAYER_DESCRIPTIONS: Record<number, string> = {
  1: 'Error level analysis, local binary patterns, chromatic aberration',
  2: 'EXIF metadata, JPEG Q-tables, color space, software tags',
  3: 'Camera noise fingerprint, noise level function analysis',
  4: 'FFT spectral peaks, wavelet energy in high-frequency bands',
  6: '4 parallel vision agents: facial, physics, background, anatomical',
  7: 'Reverse image search, C2PA credentials, SynthID watermark',
}

function ScoreBar({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const color = score > 0.65 ? '#FF4444' : score < 0.35 ? '#2BEE34' : '#FFB800'
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5'
  return (
    <div className={`w-full bg-[#1A1A1A] rounded-full ${h} overflow-hidden`}>
      <div
        className={`${h} rounded-full transition-all duration-700`}
        style={{ width: `${score * 100}%`, backgroundColor: color }}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: 'anomalous' | 'normal' | 'inconclusive' | 'not_present' }) {
  const map = {
    anomalous:    { cls: 'bg-[#FF4444]/10 text-[#FF4444] border-[#FF4444]/20',   label: 'Anomalous' },
    normal:       { cls: 'bg-[#2BEE34]/10 text-[#2BEE34] border-[#2BEE34]/20', label: 'Normal' },
    inconclusive: { cls: 'bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/20', label: 'Inconclusive' },
    not_present:  { cls: 'bg-[#1A1A1A] text-[#A3A3A3] border-[#2A2A2A]',        label: 'N/A' },
  }
  const { cls, label } = map[status] || map.inconclusive
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${cls} font-mono`}>{label}</span>
  )
}

// ── Evidence Node row ─────────────────────────────────────────────────────────

function EvidenceRow({ ev }: { ev: EvidenceNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#1E1E1E] last:border-0">
      <div className="mt-0.5 flex-shrink-0">
        <StatusBadge status={ev.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-[#6B6B6B]">{ev.artifactType}</span>
          <span className="text-xs text-[#6B6B6B]">conf: {pct(ev.confidence)}</span>
        </div>
        <p className="text-sm text-[#A3A3A3] mt-0.5 leading-relaxed">{ev.detail}</p>
      </div>
    </div>
  )
}

// ── Layer Card ────────────────────────────────────────────────────────────────

function LayerCard({ report }: { report: LayerReport }) {
  const [expanded, setExpanded] = useState(false)

  const score   = report.layerSuspicionScore
  const verdict = score > 0.65 ? 'AI' : score < 0.35 ? 'Human' : 'Mixed'
  const color   = score > 0.65 ? 'text-[#FF4444]' : score < 0.35 ? 'text-[#2BEE34]' : 'text-[#FFB800]'
  const border  = score > 0.65 ? 'border-[#FF4444]/20' : score < 0.35 ? 'border-[#2BEE34]/20' : 'border-[#FFB800]/20'
  const anomalies = report.evidence.filter(e => e.status === 'anomalous')

  return (
    <div className={`bg-[#1A1A1A] border ${border} rounded-xl p-4 transition-all`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="text-[#A3A3A3]">{LAYER_ICONS[report.layer]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">
              L{report.layer}: {report.layerName}
            </span>
            {report.status !== 'success' ? (
              <span className="text-xs text-[#6B6B6B] font-mono">{report.status.toUpperCase()}</span>
            ) : (
              <span className={`text-sm font-bold ${color}`}>{pct(score)}</span>
            )}
          </div>
          <p className="text-xs text-[#6B6B6B] mt-0.5 truncate">
            {LAYER_DESCRIPTIONS[report.layer]}
          </p>
        </div>
      </div>

      {report.status === 'success' && (
        <>
          <ScoreBar score={score} />
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-2 text-xs text-[#6B6B6B]">
              <span>{verdict}</span>
              <span>·</span>
              <span>{anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'}</span>
              <span>·</span>
              <span>{report.processingTimeMs}ms</span>
            </div>
            {report.evidence.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-[#6B6B6B] hover:text-[#A3A3A3] flex items-center gap-1 transition-colors"
              >
                Evidence {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>

          {expanded && report.evidence.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#1E1E1E]">
              {report.evidence.map((ev, i) => <EvidenceRow key={i} ev={ev} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Semantic Agent Card ───────────────────────────────────────────────────────

const AGENT_LABELS: Record<string, string> = {
  FacialForensicsAgent:     '👁 Facial',
  PhysicsLightingAgent:     '💡 Physics',
  BackgroundEdgeAgent:      '🌄 Background',
  AnatomicalIntegrityAgent: '🦴 Anatomy',
  FACIAL:                   '👁 Facial',
  PHYSICS:                  '💡 Physics',
  BACKGROUND:               '🌄 Background',
  ANATOMICAL:               '🦴 Anatomy',
}

function AgentCard({ agent }: { agent: SemanticAgentReport }) {
  const [expanded, setExpanded] = useState(false)
  const score    = agent.agentSuspicionScore
  const failed   = agent.modelUsed === 'failed'
  const anomalies = agent.evidence.filter(e => e.status === 'anomalous')
  const color    = score > 0.65 ? 'text-[#FF4444]' : score < 0.35 ? 'text-[#2BEE34]' : 'text-[#FFB800]'
  const border   = failed ? 'border-[#2A2A2A]' : score > 0.65 ? 'border-[#FF4444]/20' : score < 0.35 ? 'border-[#2BEE34]/20' : 'border-[#FFB800]/20'

  return (
    <div className={`bg-[#1A1A1A] border ${border} rounded-xl p-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[#E5E5E5]">
          {AGENT_LABELS[agent.agentName] || agent.agentName}
        </span>
        {failed ? (
          <span className="text-xs text-[#6B6B6B]">Failed</span>
        ) : (
          <span className={`text-sm font-bold ${color}`}>{pct(score)}</span>
        )}
      </div>

      {!failed && (
        <>
          <ScoreBar score={score} size="sm" />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-[#6B6B6B] truncate">{agent.modelUsed}</span>
            {anomalies.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-[#6B6B6B] hover:text-[#A3A3A3] transition-colors"
              >
                {anomalies.length} flag{anomalies.length > 1 ? 's' : ''} {expanded ? '↑' : '↓'}
              </button>
            )}
          </div>

          {expanded && anomalies.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[#1E1E1E] space-y-1">
              {anomalies.slice(0, 4).map((ev, i) => (
                <p key={i} className="text-xs text-[#A3A3A3] leading-relaxed">
                  <span className="text-[#FF4444] font-mono">{ev.artifactType}:</span> {ev.detail}
                </p>
              ))}
            </div>
          )}

          {!expanded && agent.rawResponse && (
            <p className="text-xs text-[#6B6B6B] mt-1.5 line-clamp-2">{agent.rawResponse}</p>
          )}
        </>
      )}
    </div>
  )
}

// ── Provenance Badge ──────────────────────────────────────────────────────────

function ProvenanceBadge({ provenance }: { provenance: ProvenanceReport }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Reverse search */}
      <div className={`rounded-xl p-3 border ${provenance.reverseSearchHits > 0 ? 'bg-[#2BEE34]/10 border-[#2BEE34]/20' : 'bg-[#1A1A1A] border-[#2A2A2A]'}`}>
        <div className="text-xs text-[#6B6B6B] mb-1">Reverse Search</div>
        <div className={`text-lg font-bold ${provenance.reverseSearchHits > 0 ? 'text-[#2BEE34]' : 'text-[#A3A3A3]'}`}>
          {provenance.reverseSearchHits > 0 ? `${provenance.reverseSearchHits} hit${provenance.reverseSearchHits > 1 ? 's' : ''}` : 'No hits'}
        </div>
        {provenance.earliestSourceDate && (
          <div className="text-xs text-[#6B6B6B] mt-0.5">Since {provenance.earliestSourceDate}</div>
        )}
      </div>

      {/* C2PA */}
      <div className={`rounded-xl p-3 border ${provenance.c2paValid ? 'bg-[#2BEE34]/10 border-[#2BEE34]/20' : 'bg-[#1A1A1A] border-[#2A2A2A]'}`}>
        <div className="text-xs text-[#6B6B6B] mb-1">C2PA</div>
        <div className={`text-sm font-bold ${provenance.c2paValid ? 'text-[#2BEE34]' : 'text-[#6B6B6B]'}`}>
          {provenance.c2paValid ? `✓ ${provenance.c2paSigner || 'Valid'}` : 'Not found'}
        </div>
      </div>

      {/* SynthID */}
      <div className={`rounded-xl p-3 border ${provenance.synthidDetected ? 'bg-[#FF4444]/10 border-[#FF4444]/20' : 'bg-[#1A1A1A] border-[#2A2A2A]'}`}>
        <div className="text-xs text-[#6B6B6B] mb-1">SynthID</div>
        <div className={`text-sm font-bold ${provenance.synthidDetected ? 'text-[#FF4444]' : 'text-[#6B6B6B]'}`}>
          {provenance.synthidDetected
            ? `Detected (${pct(provenance.synthidConfidence ?? 0)})`
            : 'Not detected'}
        </div>
      </div>

      {/* Camera */}
      <div className="rounded-xl p-3 border bg-[#1A1A1A] border-[#2A2A2A]">
        <div className="text-xs text-[#6B6B6B] mb-1">EXIF</div>
        <div className="text-sm font-bold text-[#A3A3A3] truncate">
          {provenance.exifCameraModel || provenance.exifSoftware || 'No EXIF'}
        </div>
      </div>
    </div>
  )
}

// ── Final Verdict Banner ──────────────────────────────────────────────────────

function VerdictBanner({ verdict }: { verdict: FinalVerdict }) {
  const isAI    = verdict.label === 'ai-generated'
  const isHuman = verdict.label === 'human-created'

  const bg      = isAI ? 'from-red-900/40 to-red-950/60 border-red-500/30'
                : isHuman ? 'from-green-900/40 to-green-950/60 border-green-500/30'
                : 'from-yellow-900/30 to-yellow-950/50 border-yellow-500/30'

  const label   = isAI ? 'AI Generated' : isHuman ? 'Human Created' : 'Uncertain'
  const color   = isAI ? 'text-red-300' : isHuman ? 'text-green-300' : 'text-yellow-300'
  const Icon    = isAI ? AlertTriangle : isHuman ? CheckCircle : HelpCircle

  return (
    <div className={`bg-[#141414] border border-[#1E1E1E] rounded-xl p-6`}>
      <div className="flex items-center gap-4 mb-4">
        <div className={`${color} flex-shrink-0`}>
          <Icon size={40} strokeWidth={1.5} />
        </div>
        <div>
          <div className="text-xs text-[#6B6B6B] uppercase tracking-widest mb-1">Final Verdict</div>
          <div className={`text-3xl font-bold ${color}`}>{label}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-[#6B6B6B] mb-1">Confidence</div>
          <div className={`text-3xl font-bold ${color}`}>{pct(verdict.confidence)}</div>
        </div>
      </div>

      <p className="text-sm text-[#A3A3A3] leading-relaxed mb-4">{verdict.explanation}</p>

      {verdict.crossValidations.keyAgreements.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-[#6B6B6B] mb-1">Key Agreements</div>
          {verdict.crossValidations.keyAgreements.map((k, i) => (
            <div key={i} className="text-xs text-[#A3A3A3] flex items-start gap-1.5 mb-1">
              <span className="text-[#2BEE34] flex-shrink-0">✓</span> {k}
            </div>
          ))}
        </div>
      )}

      {verdict.crossValidations.keyDisagreements.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-[#6B6B6B] mb-1">Disagreements</div>
          {verdict.crossValidations.keyDisagreements.map((k, i) => (
            <div key={i} className="text-xs text-[#A3A3A3] flex items-start gap-1.5 mb-1">
              <span className="text-yellow-400 flex-shrink-0">⚠</span> {k}
            </div>
          ))}
        </div>
      )}

      {verdict.uncertaintyFlags.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <div className="text-xs text-yellow-400 font-semibold mb-1">⚠ Confidence Limitations</div>
          {verdict.uncertaintyFlags.map((f, i) => (
            <div key={i} className="text-xs text-yellow-300/70">{f}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Cross-validation Map ──────────────────────────────────────────────────────

function CrossValidationMap({ verdict }: { verdict: FinalVerdict }) {
  const { agreeingLayers, disagreeingLayers } = verdict.crossValidations
  const allLayers = [1, 2, 3, 4, 6, 7]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {allLayers.map(n => {
        const agrees    = agreeingLayers.includes(n)
        const disagrees = disagreeingLayers.includes(n)
        const cls = agrees ? 'bg-green-500/20 border-green-500/40 text-green-300'
                  : disagrees ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#6B6B6B]'
        return (
          <div key={n} className={`px-2.5 py-1 rounded-lg border text-xs font-mono ${cls}`}>
            L{n}
          </div>
        )
      })}
      <div className="flex gap-3 ml-2 text-xs text-[#6B6B6B]">
        <span><span className="text-[#2BEE34]">■</span> Agrees</span>
        <span><span className="text-[#FF4444]">■</span> Disagrees</span>
        <span><span className="text-white/20">■</span> N/A</span>
      </div>
    </div>
  )
}

// ── Processing Skeleton ───────────────────────────────────────────────────────

function ProcessingView({ scanId }: { scanId: string }) {
  return (
    <div className="max-w-2xl 2xl:max-w-3xl mx-auto py-20 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
        <RefreshCw size={28} className="text-blue-400 animate-spin" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Running Forensic Analysis</h2>
      <p className="text-[#A3A3A3] text-sm mb-4">
        6 layers × 4 agents scanning in parallel. Usually completes in 8–15 seconds.
      </p>
      <div className="font-mono text-xs text-white/20">{scanId}</div>

      <div className="mt-8 space-y-3 text-left max-w-md mx-auto">
        {[
          { l: 'L1–4 Signal Worker', d: 'Pixel integrity · noise · frequency' },
          { l: 'L2 Compression',     d: 'EXIF audit · Q-tables · metadata' },
          { l: 'L6 Semantic RAG',    d: 'Facial · Physics · Background · Anatomy' },
          { l: 'L7 Provenance',      d: 'Reverse search · C2PA · SynthID' },
          { l: 'L8 Final Fusion',    d: 'Bayesian + LLM judge' },
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 rounded-full bg-blue-400/40 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
            <span className="text-[#A3A3A3] font-medium w-36">{row.l}</span>
            <span className="text-[#6B6B6B]">{row.d}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ForensicScanPage() {
  const params = useParams()
  const scanId = params?.scanId as string

  const [scan, setScan]       = useState<ForensicScanRecord | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)
  const [polling, setPolling] = useState(true)

  const fetchScan = useCallback(async () => {
    try {
      const res  = await fetch(`/api/v2/forensic-scan/${scanId}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Failed to load scan')
        setPolling(false)
        return
      }
      setScan(data.scan)
      if (data.scan.status === 'completed' || data.scan.status === 'failed') {
        setPolling(false)
      }
    } catch (e) {
      setError('Network error')
      setPolling(false)
    }
  }, [scanId])

  useEffect(() => {
    fetchScan()
  }, [fetchScan])

  useEffect(() => {
    if (!polling) return
    const interval = setInterval(fetchScan, 2000)
    return () => clearInterval(interval)
  }, [polling, fetchScan])

  const copyId = () => {
    navigator.clipboard.writeText(scanId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 text-[#FF4444]" size={40} />
          <p className="text-red-300 text-lg font-semibold">{error}</p>
          <p className="text-[#6B6B6B] text-sm mt-2">Scan ID: {scanId}</p>
        </div>
      </div>
    )
  }

  const isProcessing = !scan || scan.status === 'pending' || scan.status === 'processing'

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-[#1E1E1E] bg-white/[0.02]">
        <div className="max-w-5xl 2xl:max-w-[1300px] mx-auto px-4 sm:px-6 2xl:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-400" size={20} />
            <span className="font-semibold text-[#E5E5E5]">Forensic Analysis</span>
            {scan?.status && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${
                scan.status === 'completed' ? 'bg-green-500/10 border-green-500/30 text-[#2BEE34]' :
                scan.status === 'failed'    ? 'bg-red-500/10 border-red-500/30 text-[#FF4444]' :
                'bg-blue-500/10 border-blue-500/30 text-blue-400'
              }`}>
                {scan.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyId}
              className="text-xs text-[#6B6B6B] hover:text-[#A3A3A3] flex items-center gap-1.5 transition-colors font-mono"
            >
              {copied ? '✓ Copied' : <><Copy size={11} /> {scanId.slice(0, 8)}…</>}
            </button>
            {!polling && (
              <button
                onClick={() => { setPolling(true); fetchScan() }}
                className="text-xs text-[#6B6B6B] hover:text-[#A3A3A3] flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl 2xl:max-w-[1300px] mx-auto px-4 sm:px-6 2xl:px-8 py-8 2xl:py-10">
        {isProcessing ? (
          <ProcessingView scanId={scanId} />
        ) : (
          <div className="space-y-8">
            {/* Final Verdict Banner */}
            {scan?.finalVerdict && (
              <section>
                <VerdictBanner verdict={scan.finalVerdict} />
              </section>
            )}

            {/* Cross-validation Map */}
            {scan?.finalVerdict && (
              <section>
                <h2 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-widest mb-3">
                  Layer Consensus Map
                </h2>
                <CrossValidationMap verdict={scan.finalVerdict} />
              </section>
            )}

            {/* Layer Reports */}
            {scan?.layers && scan.layers.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-widest mb-3">
                  Forensic Layers
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {scan.layers
                    .sort((a, b) => a.layer - b.layer)
                    .map(report => <LayerCard key={report.layer} report={report} />)
                  }
                </div>
              </section>
            )}

            {/* Semantic Agents */}
            {scan?.semanticAgents && scan.semanticAgents.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-widest mb-3">
                  Semantic Vision Agents (L6)
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {scan.semanticAgents.map((agent, i) => (
                    <AgentCard key={i} agent={agent} />
                  ))}
                </div>
              </section>
            )}

            {/* Provenance */}
            {scan?.provenance && (
              <section>
                <h2 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-widest mb-3">
                  Provenance & Traceability (L7)
                </h2>
                <ProvenanceBadge provenance={scan.provenance} />
              </section>
            )}

            {/* Existing Ensemble */}
            {scan?.existingEnsembleResult && (
              <section>
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4">
                  <div className="text-xs text-[#6B6B6B] uppercase tracking-widest mb-2">
                    Existing Ensemble (HuggingFace + NVIDIA NIM)
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[#A3A3A3] capitalize font-medium">
                      {scan.existingEnsembleResult.label}
                    </span>
                    <div className="flex-1">
                      <ScoreBar
                        score={scan.existingEnsembleResult.label === 'ai'
                          ? scan.existingEnsembleResult.confidence
                          : 1 - scan.existingEnsembleResult.confidence}
                      />
                    </div>
                    <span className="text-[#6B6B6B] font-mono text-sm">
                      {pct(scan.existingEnsembleResult.confidence)}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Metadata footer */}
            <section>
              <div className="flex flex-wrap gap-4 text-xs text-white/25 font-mono border-t border-[#1E1E1E] pt-4">
                <span>ID: {scan?.id}</span>
                {scan?.processingTimeMs && <span>Time: {scan.processingTimeMs}ms</span>}
                {scan?.createdAt && <span>Created: {new Date(scan.createdAt).toLocaleString()}</span>}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
