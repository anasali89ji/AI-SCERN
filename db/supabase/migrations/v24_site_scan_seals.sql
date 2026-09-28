-- v24: Content Integrity Seal storage for the Full Site Scanner
-- Stores a SHA-256-keyed summary of each site scan so /api/verify/site/[hash]
-- can confirm a "Verified Content" badge without re-running the scan.
-- Best-effort feature: lib/site-crawler/integrity-seal.ts already degrades
-- gracefully (try/catch) if this table is absent, so this migration is safe
-- to apply at any time, independently of app deploys.

create table if not exists site_scan_seals (
  hash            text primary key,
  origin          text not null,
  issued_at       timestamptz not null default now(),
  report_summary  jsonb not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_site_scan_seals_origin on site_scan_seals (origin);
create index if not exists idx_site_scan_seals_issued_at on site_scan_seals (issued_at desc);

alter table site_scan_seals enable row level security;

-- Public read (verification pages are meant to be publicly checkable, like a
-- transparency badge) — writes only via service-role (server-side upsert).
drop policy if exists "site_scan_seals_public_read" on site_scan_seals;
create policy "site_scan_seals_public_read"
  on site_scan_seals for select
  using (true);
