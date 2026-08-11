'use client'

import { AlertTriangle, CheckCircle, ShieldAlert, ShieldCheck, Info } from 'lucide-react'

interface TrustScoreCardProps {
  trustOverall:      number
  riskOverall:        number
  confidenceOverall:  number
  components: {
    authenticity:       number
    consistency:        number
    source_reliability: number
    verification_sigs:  number
    metadata_quality:   number
    historical_rep:     number
  }
  evidence: Array<{
    type:       string
    finding:    string
    confidence: number
    severity:   string
  }>
  findings: Array<{
    severity: string
    category: string
    message:  string
  }>
  recommendations: string[]
  tool: string
}

function levelFor(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'High',     color: 'text-emerald bg-emerald/10 border-emerald/20' }
  if (score >= 60) return { label: 'Moderate', color: 'text-amber bg-amber/10 border-amber/20' }
  if (score >= 35) return { label: 'Low',      color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' }
  return                  { label: 'Critical', color: 'text-rose bg-rose/10 border-rose/20' }
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-text-secondary">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export function TrustScoreCard({
  trustOverall, riskOverall, confidenceOverall, components,
  evidence, findings, recommendations, tool,
}: TrustScoreCardProps) {
  const trust = levelFor(trustOverall)

  return (
    <div className="space-y-6">
      {/* Header score */}
      <div className="rounded-2xl border border-white/10 bg-surface/50 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-text-disabled mb-1">{tool}</p>
            <h3 className="text-2xl font-bold">Trust Score</h3>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${trust.color}`}>
            {trustOverall >= 60 ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            {trust.label} Trust
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">{trustOverall}</p>
            <p className="text-xs text-text-disabled mt-1">Trust Score</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-rose">{riskOverall}</p>
            <p className="text-xs text-text-disabled mt-1">Risk Score</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-cyan">{confidenceOverall}</p>
            <p className="text-xs text-text-disabled mt-1">Confidence</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <ScoreBar label="Authenticity"        value={components.authenticity} />
          <ScoreBar label="Consistency"         value={components.consistency} />
          <ScoreBar label="Source Reliability"  value={components.source_reliability} />
          <ScoreBar label="Verification Signals" value={components.verification_sigs} />
          <ScoreBar label="Metadata Quality"    value={components.metadata_quality} />
          <ScoreBar label="Historical Reputation" value={components.historical_rep} />
        </div>
      </div>

      {/* Findings */}
      {findings.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-surface/50 p-6">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" /> Key Findings
          </h4>
          <div className="space-y-2">
            {findings.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {f.severity === 'none' ? (
                  <CheckCircle className="w-4 h-4 text-emerald flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber flex-shrink-0 mt-0.5" />
                )}
                <span className="text-text-secondary">{f.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence */}
      <div className="rounded-2xl border border-white/10 bg-surface/50 p-6">
        <h4 className="text-sm font-semibold mb-3">Evidence Summary</h4>
        <div className="space-y-3">
          {evidence.map((e, i) => (
            <div key={i} className="border-l-2 border-primary/30 pl-3 py-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wide text-text-disabled">{e.type.replace(/_/g, ' ')}</span>
                <span className="text-xs font-mono text-text-disabled">{e.confidence}% confidence</span>
              </div>
              <p className="text-sm text-text-secondary">{e.finding}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-surface/50 p-6">
          <h4 className="text-sm font-semibold mb-3">Recommendations</h4>
          <ul className="space-y-2">
            {recommendations.map((r, i) => (
              <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                <span className="text-primary mt-1">→</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
