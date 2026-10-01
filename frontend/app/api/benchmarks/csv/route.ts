/**
 * GET /api/benchmarks/csv
 *
 * Originally this route was a static hardcoded CSV — fabricated numbers
 * with no measurement behind them, kept in sync by hand with the
 * `(marketing)/benchmarks` page. The comment above the original
 * `ROWS` constant admitted it: "no results.csv was ever generated
 * or committed."
 *
 * Replaced in Module 7.4: this route now attempts to read live,
 * user-feedback-validated accuracy from the `model_accuracy_30d`
 * Supabase view (defined in `supabase/migrations/accuracy_monitoring.sql`).
 *
 *   - If the view returns ≥1 row, the route returns
 *     `{ measured: true, measuredAt, models: [...] }` with real numbers
 *     computed from model_predictions × scan_feedback over the trailing
 *     30 days.
 *   - If the view is empty (no labeled samples yet) OR Supabase is
 *     unreachable / not configured, the route falls back to
 *     FALLBACK_TARGETS with `measured: false` and a clear note, so the
 *     benchmarks page can show a "these are target values" banner
 *     instead of silently presenting fabricated data as measured.
 *
 * Output is JSON by default. The old CSV shape is preserved via the
 * `?format=csv` query param, kept for any external link that still
 * hits `/api/benchmarks/csv` expecting a CSV download (the original
 * route existed to fix a SEMrush-flagged 4xx on `/benchmarks/results.csv`).
 *
 * Schema note — the master prompt's pseudocode used fields that don't
 * exist in the actual `model_accuracy_30d` view. The mapping is documented
 * in `frontend/lib/benchmarks.ts` (single source of truth). Summary:
 *
 *   prompt pseudocode  →  actual view column
 *   ─────────────────────────────────────────
 *   model_name         →  model_id
 *   auc_30d            →  accuracy_pct / 100      (proxy — view has no AUC)
 *   f1_30d             →  f1_score_pct / 100
 *   fpr_30d            →  false_pos / total_labeled
 *   sample_count       →  total_labeled
 *
 * `auc` is reported as accuracy here because the view stores verdicts
 * (AI/HUMAN/UNCERTAIN), not raw scores — a real AUC would require
 * recomputing it from raw scores in `model_predictions.raw_score`,
 * which is a larger migration. For now we expose accuracy as a clearly
 * labeled proxy and document the gap.
 */
import { NextResponse } from 'next/server'
import { fetchBenchmarks, benchmarksToCsv } from '@/lib/benchmarks'

// Was `force-static` — must be `force-dynamic` now because we query
// Supabase on every request and want fresh numbers.
export const dynamic = 'force-dynamic'
// 5-minute CDN cache — measured numbers change slowly. Next.js will
// re-run the route at most once per minute under sustained load.
export const revalidate = 60

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const wantCsv = url.searchParams.get('format') === 'csv'

  const payload = await fetchBenchmarks()

  if (wantCsv) {
    return new NextResponse(benchmarksToCsv(payload), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="aiscern-benchmark-results.csv"',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    })
  }

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    },
  })
}
