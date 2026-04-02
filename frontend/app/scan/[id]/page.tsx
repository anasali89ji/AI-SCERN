import Link       from 'next/link'
import { notFound } from 'next/navigation'
import { Shield, CheckCircle, AlertTriangle, HelpCircle, Clock, Share2 } from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface Scan {
  id:               string
  verdict:          string
  confidence_score: number
  media_type:       string
  model_used:       string | null
  created_at:       string
  signals:          Array<{ name: string; value: number; weight: number }> | null
}

async function getScan(id: string): Promise<Scan | null> {
  const { data } = await getSupabaseAdmin()
    .from('scans')
    .select('id, verdict, confidence_score, media_type, model_used, created_at, signals')
    .eq('id', id)
    .eq('is_public', true)
    .single()
  return data ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scan = await getScan(id)
  if (!scan) return { title: 'Scan Not Found | Aiscern' }

  const pct = Math.round(scan.confidence_score * 100)
  return {
    title:       `${scan.verdict}: ${pct}% confidence | Aiscern`,
    description: `This ${scan.media_type} was detected as ${scan.verdict} with ${pct}% confidence by Aiscern AI detector.`,
    openGraph: {
      title:       `${scan.verdict} — ${pct}% AI confidence`,
      description: `Aiscern detected this ${scan.media_type} as ${scan.verdict}`,
      url:         `https://aiscern.com/scan/${id}`,
    },
  }
}

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === 'AI')      return <AlertTriangle className="w-10 h-10 text-red-400" />
  if (verdict === 'HUMAN')   return <CheckCircle   className="w-10 h-10 text-emerald-400" />
  return                            <HelpCircle    className="w-10 h-10 text-yellow-400" />
}

function verdictColor(verdict: string) {
  if (verdict === 'AI')    return 'text-red-400    border-red-400/30    bg-red-400/5'
  if (verdict === 'HUMAN') return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5'
  return                          'text-yellow-400  border-yellow-400/30  bg-yellow-400/5'
}

function verdictLabel(verdict: string) {
  if (verdict === 'AI')    return 'AI-Generated'
  if (verdict === 'HUMAN') return 'Human-Created'
  return 'Uncertain'
}

function ConfidenceBar({ score, verdict }: { score: number; verdict: string }) {
  const pct = Math.round(score * 100)
  const barColor = verdict === 'AI' ? 'bg-red-500' : verdict === 'HUMAN' ? 'bg-emerald-500' : 'bg-yellow-500'
  return (
    <div>
      <div className="flex justify-between text-xs text-text-muted mb-1.5">
        <span>Confidence</span>
        <span className="font-bold text-text-primary">{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default async function ScanResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scan = await getScan(id)
  if (!scan) notFound()

  const pct      = Math.round(scan.confidence_score * 100)
  const signals  = (scan.signals ?? []).slice(0, 6)
  const dateStr  = new Date(scan.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto h-full px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Aiscern" className="w-8 h-6 object-contain" />
            <span className="font-black text-lg gradient-text">Aiscern</span>
          </Link>
          <span className="text-xs text-text-muted">Shared scan result</span>
        </div>
      </nav>

      <main className="pt-24 pb-20 max-w-2xl mx-auto px-4">
        {/* Header card */}
        <div className={`rounded-2xl border p-8 text-center mb-6 ${verdictColor(scan.verdict)}`}>
          <div className="flex justify-center mb-4">
            <VerdictIcon verdict={scan.verdict} />
          </div>
          <h1 className="text-3xl font-black mb-1">{verdictLabel(scan.verdict)}</h1>
          <p className="text-text-muted text-sm mb-6 capitalize">{scan.media_type} analysis · {dateStr}</p>
          <ConfidenceBar score={scan.confidence_score} verdict={scan.verdict} />
        </div>

        {/* Metadata */}
        <div className="rounded-2xl border border-border bg-surface p-5 mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Content type</span>
            <span className="capitalize font-medium">{scan.media_type}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Detection model</span>
            <span className="font-medium text-xs font-mono">{scan.model_used ?? 'ensemble'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Scan ID</span>
            <span className="font-mono text-xs text-text-disabled">{scan.id.slice(0, 8)}…</span>
          </div>
        </div>

        {/* Signals */}
        {signals.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-5 mb-6">
            <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Detection signals
            </h2>
            <div className="space-y-3">
              {signals.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-muted">{s.name}</span>
                    <span className="font-bold">{Math.round((s.value ?? 0) * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${Math.round((s.value ?? 0) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 mb-8 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-text-muted leading-relaxed">
            AI detection is probabilistic, not absolute. This result should be one input in a broader assessment.
            Accuracy is approximately 82–85% depending on content type. See our{' '}
            <Link href="/methodology" className="text-primary underline">methodology</Link> for details.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center space-y-3">
          <Link href={`/detect/${scan.media_type}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors">
            Verify this yourself →
          </Link>
          <p className="text-xs text-text-disabled flex items-center justify-center gap-1.5">
            <Clock className="w-3 h-3" /> Free · No account required
          </p>
        </div>
      </main>
    </div>
  )
}
