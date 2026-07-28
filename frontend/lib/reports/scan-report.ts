/**
 * Aiscern — Enterprise Scan Report Generator
 *
 * Produces a downloadable PDF report for a single scan, built for
 * enterprise/HR-firm use: the actual scanned image embedded inline (not
 * just a score), the full layer-by-layer signal breakdown, and the
 * perceptual fingerprint ("synth ID") printed at the bottom so the report
 * itself can be used as evidence — anyone re-scanning the same image later
 * can match it back to this exact report via the fingerprint.
 *
 * Data can come from either Supabase (recent scan, still in the hot path)
 * or MotherDuck (older scan, already archived past the user's
 * data_retention_days purge — see lib/motherduck/archive.ts). The caller
 * (app/api/reports/scan/[scanId]/route.ts) resolves which source to use;
 * this module just needs a normalized ReportScanData.
 */
import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'
import type { DetectionSignal } from '@/types'

export interface ReportScanData {
  scan_id: string
  media_type: string
  verdict: string | null
  confidence_score: number | null
  model_used: string | null
  file_name: string | null
  file_size: number | null
  perceptual_hash: string | null
  file_hash: string | null
  signals: DetectionSignal[]
  scanned_at: string
  // Populated only for image scans, when the R2 object is still available
  imageBuffer?: Buffer
  imageMimeType?: string
  // Populated when this image matched a prior scan via perceptual hash
  priorMatch?: { scan_id: string; scanned_at: string; verdict: string | null; hamming_distance: number } | null
}

const COLORS = {
  primary: rgb(0.15, 0.35, 0.95),   // matches the app's blue-600 accent
  text: rgb(0.1, 0.1, 0.12),
  muted: rgb(0.45, 0.45, 0.5),
  border: rgb(0.85, 0.85, 0.88),
  aiRed: rgb(0.8, 0.2, 0.2),
  humanGreen: rgb(0.15, 0.55, 0.25),
  uncertainAmber: rgb(0.75, 0.55, 0.1),
}

function verdictColor(verdict: string | null) {
  if (verdict === 'AI') return COLORS.aiRed
  if (verdict === 'HUMAN') return COLORS.humanGreen
  return COLORS.uncertainAmber
}

export async function generateScanReportPDF(data: ReportScanData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Aiscern Verification Report — ${data.scan_id}`)
  pdf.setSubject('AI Content Detection Report')
  pdf.setProducer('Aiscern (aiscern.com)')

  const font     = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await pdf.embedFont(StandardFonts.Courier)

  let page = pdf.addPage([612, 792]) // US Letter
  let y = 792 - 56

  const margin = 56
  const pageWidth = 612

  function ensureSpace(needed: number) {
    if (y - needed < 56) {
      page = pdf.addPage([612, 792])
      y = 792 - 56
    }
  }

  function text(str: string, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; x?: number } = {}) {
    const size = opts.size ?? 10
    ensureSpace(size + 6)
    page.drawText(str, {
      x: opts.x ?? margin,
      y,
      size,
      font: opts.f ?? font,
      color: opts.color ?? COLORS.text,
    })
    y -= size + 6
  }

  function rule() {
    ensureSpace(12)
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: COLORS.border })
    y -= 12
  }

  // ── Header ──────────────────────────────────────────────────────────────
  text('AISCERN', { size: 20, f: fontBold, color: COLORS.primary })
  text('AI Content Verification Report', { size: 11, color: COLORS.muted })
  y -= 4
  rule()

  // ── Verdict summary block ──────────────────────────────────────────────
  const verdictLabel = data.verdict === 'AI' ? 'LIKELY AI-GENERATED'
    : data.verdict === 'HUMAN' ? 'LIKELY HUMAN-CREATED'
    : 'UNCERTAIN'
  text(verdictLabel, { size: 16, f: fontBold, color: verdictColor(data.verdict) })
  const confPct = data.confidence_score != null ? `${Math.round(data.confidence_score * 100)}%` : 'N/A'
  text(`Confidence: ${confPct}   ·   Media type: ${data.media_type}   ·   Model: ${data.model_used ?? 'ensemble'}`, { size: 10, color: COLORS.muted })
  text(`Scanned: ${new Date(data.scanned_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`, { size: 10, color: COLORS.muted })
  text(`File: ${data.file_name ?? 'untitled'}${data.file_size ? `  (${Math.round(data.file_size / 1024)} KB)` : ''}`, { size: 10, color: COLORS.muted })
  y -= 8
  rule()

  // ── Embedded scanned image (the whole point — HR/enterprise reviewers
  //    need to see exactly what was scanned, not just a score) ────────────
  if (data.imageBuffer) {
    try {
      const isPng = (data.imageMimeType ?? '').includes('png')
      const embedded = isPng ? await pdf.embedPng(data.imageBuffer) : await pdf.embedJpg(data.imageBuffer)
      const maxW = pageWidth - margin * 2
      const maxH = 280
      const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1)
      const w = embedded.width * scale
      const h = embedded.height * scale
      ensureSpace(h + 20)
      page.drawImage(embedded, { x: margin, y: y - h, width: w, height: h })
      y -= h + 10
      text('Scanned image (as submitted)', { size: 8, color: COLORS.muted })
      y -= 4
      rule()
    } catch {
      text('[Scanned image could not be embedded — original format unsupported by report generator]', { size: 9, color: COLORS.muted })
      rule()
    }
  }

  // ── Prior-scan match (perceptual fingerprint hit) ───────────────────────
  if (data.priorMatch) {
    text('⚠ Recognized from a previous scan', { size: 11, f: fontBold, color: COLORS.primary })
    text(
      `This image (or a recompressed/resized/cropped copy of it) was scanned before on ` +
      `${new Date(data.priorMatch.scanned_at).toLocaleDateString()} — original verdict: ${data.priorMatch.verdict ?? 'unknown'} ` +
      `(fingerprint match, ${data.priorMatch.hamming_distance} bits difference). Scan ID: ${data.priorMatch.scan_id}`,
      { size: 9, color: COLORS.muted },
    )
    y -= 4
    rule()
  }

  // ── Forensic signal breakdown ────────────────────────────────────────────
  text('Forensic Signal Breakdown', { size: 13, f: fontBold })
  y -= 2
  if (data.signals?.length) {
    for (const sig of data.signals) {
      ensureSpace(28)
      const flagColor = sig.flagged ? COLORS.aiRed : COLORS.humanGreen
      text(`${sig.flagged ? '●' : '○'} ${sig.name}  —  ${sig.category}`, { size: 10, f: fontBold, color: flagColor })
      text(`   ${sig.description}`, { size: 9, color: COLORS.muted })
      text(`   Signal value: ${sig.value.toFixed(3)}   Weight: ${(sig.weight * 100).toFixed(0)}%`, { size: 8, color: COLORS.muted })
      y -= 2
    }
  } else {
    text('No layer-level signal data available for this scan.', { size: 9, color: COLORS.muted })
  }
  y -= 6
  rule()

  // ── Fingerprint / evidence footer ───────────────────────────────────────
  text('Evidence Fingerprint ("Synth ID")', { size: 11, f: fontBold })
  text(
    'This code uniquely identifies the scanned file. Re-uploading the same image — even after ' +
    'resizing, recompressing, or minor cropping — will be recognized and linked back to this report.',
    { size: 8, color: COLORS.muted },
  )
  text(`Perceptual hash: ${data.perceptual_hash ?? 'N/A (non-image scan)'}`, { size: 9, f: fontMono, color: COLORS.text })
  text(`Exact file hash (SHA-256, partial): ${data.file_hash ?? 'N/A'}`, { size: 9, f: fontMono, color: COLORS.text })
  text(`Scan ID: ${data.scan_id}`, { size: 9, f: fontMono, color: COLORS.text })
  y -= 10
  rule()
  text('Generated by Aiscern (aiscern.com) — automated AI-content detection. This report reflects', { size: 7, color: COLORS.muted })
  text('model-based confidence scores and is not a legal certification of content origin.', { size: 7, color: COLORS.muted })

  return pdf.save()
}
