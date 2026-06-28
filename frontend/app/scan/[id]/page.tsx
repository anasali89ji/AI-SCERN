import Link        from 'next/link'
import { notFound } from 'next/navigation'
import {
  Shield, CheckCircle2, AlertTriangle, HelpCircle,
  Clock, ArrowLeft, ExternalLink, BarChart3,
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
  if (v === 'AI')    return { label: 'AI Generated',  icon: AlertTriangle, text: 'text-[#FF4444]', bg: 'bg-[#FF4444]/5',  border: 'border-[#FF4444]/20', bar: 'bg-[#FF4444]' }
  if (v === 'HUMAN') return { label: 'Human Written', icon: CheckCircle2,  text: 'text-[#2BEE34]', bg: 'bg-[#2BEE34]/5',  border: 'border-[#2BEE34]/20', bar: 'bg-[#2BEE34]' }
  return                    { label: 'Uncertain',     icon: HelpCircle,    text: 'text-[#FFB800]', bg: 'bg-[#FFB800]/5',  border: 'border-[#FFB800]/20', bar: 'bg-[#FFB800]' }
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
    <div className="min-h-screen bg-[#141414] text-[#E5E5E5]">
      {/* Simple header */}
      <header className="border-b border-[#1E1E1E] bg-[#0A0A0A]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-white hover:text-[#2BEE34] transition-colors text-lg">
            Aiscern
          </Link>
          <Link href="/detect/text" className="text-sm text-[#A3A3A3] hover:text-white transition-colors flex items-center gap-1">
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
              <div>
                <p className={`text-2xl font-black ${cfg.text}`}>{cfg.label}</p>
                <p className="text-sm text-[#A3A3A3] mt-0.5 capitalize">{scan.media_type} detection</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-white tabular-nums">{pct}%</div>
              <div className="text-xs text-[#6B6B6B]">confidence</div>
            </div>
          </div>
          <div className="mt-5 h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div className={`h-full ${cfg.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Meta */}
        <div className="rounded-xl border border-[#1E1E1E] bg-[#141414] p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Media type', value: scan.media_type.charAt(0).toUpperCase() + scan.media_type.slice(1) },
            { label: 'Model',      value: scan.model_used ?? 'Ensemble' },
            { label: 'Scan ID',    value: scan.id.slice(0, 12) + '…' },
          ].map(m => (
            <div key={m.label}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B6B6B] mb-1">{m.label}</p>
              <p className="text-sm font-medium text-white font-mono">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-2 text-sm text-[#6B6B6B]">
          <Clock className="w-4 h-4 flex-shrink-0" />
          Scanned {formatDate(scan.created_at)}
        </div>

        {/* Signal breakdown */}
        {signals.length > 0 && (
          <div className="rounded-xl border border-[#1E1E1E] bg-[#141414] overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[#1E1E1E] bg-[#0A0A0A]">
              <BarChart3 className="w-4 h-4 text-[#2BEE34]" />
              <h2 className="text-sm font-semibold text-white">Signal Breakdown</h2>
            </div>
            <div className="divide-y divide-[#1E1E1E]">
              {signals.map((sig, i) => {
                const sigPct = Math.round((sig.value ?? 0) * 100)
                const isAI   = sigPct >= 65
                const isHum  = sigPct <= 35
                const barCls = isAI ? 'bg-[#FF4444]' : isHum ? 'bg-[#2BEE34]' : 'bg-[#FFB800]'
                return (
                  <div key={i} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-[#E5E5E5] font-medium">{sig.name}</span>
                      <span className="text-sm font-bold text-white tabular-nums">{sigPct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                      <div className={`h-full ${barCls} rounded-full transition-all duration-500`} style={{ width: `${sigPct}%` }} />
                    </div>
                    {sig.weight && (
                      <p className="text-[10px] text-[#6B6B6B] mt-1">Weight: {(sig.weight * 100).toFixed(0)}%</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex gap-3 p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-[#6B6B6B]">
          <Shield className="w-4 h-4 text-[#2BEE34] flex-shrink-0 mt-0.5" />
          <p>
            AI detection is probabilistic. Results should be considered as supporting evidence, not definitive proof.
            Never use detection results as sole evidence in high-stakes decisions.{' '}
            <Link href="/methodology" className="text-[#2BEE34] hover:underline">Read methodology →</Link>
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link href="/detect/text"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg
                       bg-[#2BEE34] hover:bg-[#1A8F1F] text-[#0A0A0A] font-semibold text-sm transition-colors">
            Run Another Scan
          </Link>
          <Link href="/signup"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg
                       border border-[#2A2A2A] text-[#E5E5E5] hover:border-[#2BEE34] hover:text-[#2BEE34]
                       font-semibold text-sm transition-all">
            Save to History
          </Link>
        </div>

      </main>
    </div>
  )
}
