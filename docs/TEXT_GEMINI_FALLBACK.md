# Text Detection — Gemini Fallback Rate (MODULE 2, task 5)

`TEXT_GEMINI_MODE` (env var, default `fallback`) controls when Gemini is
called at all — see `analyzeText()` in `frontend/lib/inference/hf-analyze.ts`:

- `fallback` (default) — Gemini only runs when the brain is uncertain
  (score in 0.42–0.58) or disagrees with the brain, OR the brain and the
  linguistic signal engine disagree by more than 0.15.
- `parallel` — Gemini always runs (for A/B measurement against `fallback`).
- `off` — Gemini never runs, self-hosted only.

No new column or table was added to track the fallback-trigger rate —
`model_predictions` (fixed/applied in the MODULE 4 session) already logs a
`gemini-2.5-flash` row on every scan where Gemini was actually called, and
nothing when it wasn't. That's sufficient to answer "what % of requests
actually needed Gemini" directly:

```sql
select
  count(distinct scan_id) filter (where model_id = 'gemini-2.5-flash')::float
  / nullif(count(distinct scan_id), 0) * 100 as gemini_call_rate_pct
from model_predictions
where modality = 'text'
  and created_at > now() - interval '7 days';
```

Once this has real volume behind it (same caveat as MODULE 4 —
`model_predictions` only started actually recording data after that
session applied the missing migration, so give it a few days), that
number is the thing to watch:

- **High rate (>40%)** — text isn't confident enough on its own yet;
  don't celebrate the "self-hosted first" wiring, revisit the brain/
  linguistic calibration instead of tolerating high Gemini dependency
  (same MODULE 6 checkpoint rule as the other modalities).
- **Low, stable rate** — the fallback logic is working as intended.

The self-hosted perplexity worker (`text-worker-perplexity-v1` in
`model_predictions`) is a separate, additive signal — it runs whenever
`PYTHON_WORKER_URL` is set and the text is long enough, independent of
whether Gemini also ran. It doesn't reduce Gemini calls by itself; it
improves the brain/linguistic side of the ensemble that the fallback
decision is based on.
