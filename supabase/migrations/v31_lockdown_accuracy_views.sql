-- v31_lockdown_accuracy_views.sql
-- Aiscern — Lock down benchmark/accuracy views from the public anon key
--
-- model_accuracy_7d, model_accuracy_30d, and ensemble_accuracy (defined in
-- accuracy_monitoring.sql) were created with no REVOKE statement. Their
-- base tables (model_predictions, scan_feedback) have RLS enabled, but
-- Postgres views do NOT inherit RLS from base tables by default — and
-- Supabase's standard `public` schema default privileges grant SELECT on
-- new relations to `anon` and `authenticated`. Since NEXT_PUBLIC_SUPABASE_ANON_KEY
-- is shipped in the client bundle (frontend/next.config.js `env` block),
-- these three views were reachable by anyone via:
--   GET {SUPABASE_URL}/rest/v1/model_accuracy_7d
--   apikey: <the public anon key>
-- returning live per-model TP/FP/FN/accuracy_pct/f1_score_pct — the exact
-- internal benchmark numbers, unrounded and always current, that
-- benchmarks/page.tsx only ever shows as curated marketing snapshots.
--
-- Fix: explicitly revoke anon/authenticated access to these views. Only
-- service_role (server-side, e.g. an internal /admin route) can read them.
-- If a public-facing benchmark page ever needs to query live data instead
-- of hardcoded marketing copy, do it via getSupabaseAdmin() (service role)
-- in a Next.js Server Component / API route — never client-side.

REVOKE ALL ON model_accuracy_7d  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON model_accuracy_30d FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ensemble_accuracy  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON model_accuracy_7d  TO service_role;
GRANT SELECT ON model_accuracy_30d TO service_role;
GRANT SELECT ON ensemble_accuracy  TO service_role;

-- Belt-and-suspenders: also make sure any FUTURE view/table created in
-- public doesn't silently inherit anon/authenticated SELECT again. Run
-- this once per schema; safe to re-run.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT ON TABLES FROM anon, authenticated;

-- Sanity check for whoever runs this migration — lists any remaining
-- relation in public that anon/authenticated can still SELECT from views
-- (as opposed to tables, which are covered by RLS already). Expected to
-- return zero rows for model_accuracy_7d / model_accuracy_30d / ensemble_accuracy
-- after this migration applies.
-- SELECT table_name, grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND grantee IN ('anon', 'authenticated')
--   AND table_name IN ('model_accuracy_7d', 'model_accuracy_30d', 'ensemble_accuracy');
