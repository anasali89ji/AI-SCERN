import Link        from 'next/link'
import { notFound } from 'next/navigation'
import {
  Shield, CheckCircle2, TriangleAlert, CircleHelp,
  Clock, ArrowLeft, SquareArrowOutUpRight, BarChart3,
} from 'lucide-react'
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
  const pct  = Math.round(scan.confidence_score * 100)
  const tool = scan.media_type ?? 'text'
  const ogTitle = encodeURIComponent(`${scan.verdict === 'AI' ? 'AI Detected' : scan.verdict === 'HUMAN' ? 'Human Verified' : 'Uncertain'} — ${pct}% confidence`)
  const ogImg   = `https://aiscern.com/api/og?title=${ogTitle}&tool=${tool}`
  return {
    title:       `${scan.verdict}: ${pct}% confidence | Aiscern`,
    description: `This ${scan.media_type} was detected as ${scan.verdict} with ${pct}% confidence by Aiscern.`,
    openGraph: {
      title:   `${scan.verdict} — ${pct}% AI confidence`,
      url:     `https://aiscern.com/scan/${id}`,
      images:  [{ url: ogImg, width: 1200, height: 630, alt: `Aiscern scan — ${scan.verdict}` }],
    },
    twitter: { card: 'summary_large_image', images: [ogImg] },
  }
}

function verdictCfg(v: string) {
  if (v === 'AI')    return { label: 'AI Generated',  icon: TriangleAlert, text: 'text-error', bg: 'bg-error/5',  border: 'border-error/20', bar: 'bg-error' }
  if (v === 'HUMAN') return { label: 'Human Written', icon: CheckCircle2,  text: 'text-accent', bg: 'bg-accent/5',  border: 'border-accent/20', bar: 'bg-accent' }
  return                    { label: 'Uncertain',     icon: CircleHelp,    text: 'text-warning', bg: 'bg-warning/5',  border: 'border-warning/20', bar: 'bg-warning' }
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function ScanResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scan   = await getScan(id)
  if (!scan) notFound()

  const pct = Math.round(scan.confidence_score <= 1 ? scan.confidence_score * 100 : scan.confidence_score)
  const cfg = verdictCfg(scan.verdict)
  const Icon = cfg.icon
  const signals = scan.signals ?? []

  return (
    <div className="min-h-screen bg-surface text-silver-800">
      {/* Simple header */}
      <header className="border-b border-silver-300 bg-silver-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-white hover:text-accent transition-colors text-lg">
            Aiscern
          </Link>
          <Link href={scan.media_type ? scan.media_type === 'url' ? '/scraper' : `/detect/${scan.media_type}` : "/detect/text"} className="text-sm text-silver-700 hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Run new scan
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-5">

        {/* Verdict card */}
        <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-6 sm:p-8`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Icon className={`w-7 h-7 ${cfg.text} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className={`text-2xl font-bold ${cfg.text}`}>{cfg.label}</p>
                <p className="text-sm text-silver-700 mt-0.5 capitalize">{scan.media_type} detection</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-white tabular-nums">{pct}%</div>
              <div className="text-xs text-silver-600">confidence</div>
            </div>
          </div>
          <div className="mt-5 h-2 bg-silver-300 rounded-full overflow-hidden">
            <div className={`h-full ${cfg.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Meta */}
        <div className="rounded-xl border border-silver-300 bg-surface p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Media type', value: scan.media_type.charAt(0).toUpperCase() + scan.media_type.slice(1) },
            { label: 'Model',      value: scan.model_used ?? 'Ensemble' },
            { label: 'Scan ID',    value: scan.id.slice(0, 12) + '…' },
          ].map(m => (
            <div key={m.label}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-silver-600 mb-1">{m.label}</p>
              <p className="text-sm font-medium text-white font-mono">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-2 text-sm text-silver-600">
          <Clock className="w-4 h-4 flex-shrink-0" />
          Scanned {formatDate(scan.created_at)}
        </div>

        {/* Signal breakdown */}
        {signals.length > 0 && (
          <div className="rounded-xl border border-silver-300 bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-silver-300 bg-silver-50">
              <BarChart3 className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-white">Signal Breakdown</h2>
            </div>
            <div className="divide-y divide-[#1E1E1E]">
              {signals.map((sig, i) => {
                const sigPct = Math.round((sig.value ?? 0) * 100)
                const isAI   = sigPct >= 65
                const isHum  = sigPct <= 35
                const barCls = isAI ? 'bg-error' : isHum ? 'bg-accent' : 'bg-warning'
                return (
                  <div key={i} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-silver-800 font-medium">{sig.name}</span>
                      <span className="text-sm font-bold text-white tabular-nums">{sigPct}%</span>
                    </div>
                    <div className="h-1.5 bg-silver-300 rounded-full overflow-hidden">
                      <div className={`h-full ${barCls} rounded-full transition-all duration-500`} style={{ width: `${sigPct}%` }} />
                    </div>
                    {sig.weight && (
                      <p className="text-[10px] text-silver-600 mt-1">Weight: {(sig.weight * 100).toFixed(0)}%</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex gap-3 p-4 bg-silver-200 border border-silver-300 rounded-xl text-sm text-silver-600">
          <Shield className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <p>
            AI detection is probabilistic. Results should be considered as supporting evidence, not definitive proof.
            Never use detection results as sole evidence in high-stakes decisions.{' '}
            <Link href="/methodology" className="text-accent hover:underline">Read methodology →</Link>
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link href={scan.media_type ? scan.media_type === 'url' ? '/scraper' : `/detect/${scan.media_type}` : "/detect/text"}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg
                       bg-accent hover:bg-accent-hover text-silver-50 font-semibold text-sm transition-colors">
            Run Another Scan
          </Link>
          <Link href="/signup"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg
                       border border-silver-300 text-silver-800 hover:border-accent hover:text-accent
                       font-semibold text-sm transition-all">
            Save to History
          </Link>
        </div>

      </main>
    </div>
  )
}
