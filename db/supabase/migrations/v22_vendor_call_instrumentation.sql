-- MODULE 6 — Cost & Call-Volume Instrumentation.
-- Lightweight per-day, per-vendor, per-modality call counters so the
-- reduction in paid-vendor calls from Modules 1-4 (self-hosted-first) is
-- provable with a real number, not assumed.
--
-- Applied live to detectai-v2 (project ref lpgzmruxaeikxxayjmze) via the
-- Supabase MCP tool on 2026-07-12. This file mirrors what was actually
-- run — see docs/COST_INSTRUMENTATION_MODULE6.md for verification notes,
-- and the Module 4 precedent (docs/CALIBRATION_LOG.md) for why "applied
-- live" is called out explicitly rather than assumed from this file alone.

create table if not exists vendor_call_log (
  id           bigserial primary key,
  day          date not null default (now() at time zone 'utc')::date,
  vendor       text not null check (vendor in ('gemini', 'nvidia_nim', 'huggingface')),
  modality     text not null check (modality in ('text', 'image', 'audio', 'video')),
  call_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (day, vendor, modality)
);

comment on table vendor_call_log is
  'MODULE 6: daily call-volume counters per paid vendor per modality. '
  'Written via increment_vendor_call() RPC, fire-and-forget from '
  'hf-analyze.ts at each paid-vendor call site — never blocks or fails '
  'the detection request itself (see the "never break the fallback path" '
  'rule in the remediation plan).';

create index if not exists idx_vendor_call_log_day on vendor_call_log (day desc);

-- Atomic upsert-increment. SECURITY DEFINER so it can be called from a
-- server-side context with the anon/authenticated role if ever needed,
-- without granting broad table write access — mirrors the pattern used
-- by other counter RPCs in this schema (e.g. credit functions).
create or replace function increment_vendor_call(
  p_vendor   text,
  p_modality text,
  p_by       integer default 1
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into vendor_call_log (day, vendor, modality, call_count, updated_at)
  values ((now() at time zone 'utc')::date, p_vendor, p_modality, p_by, now())
  on conflict (day, vendor, modality)
  do update set call_count = vendor_call_log.call_count + p_by,
                updated_at = now();
end;
$$;

comment on function increment_vendor_call is
  'MODULE 6: atomic daily counter increment for vendor_call_log. Call with '
  'p_vendor in (gemini|nvidia_nim|huggingface), p_modality in '
  '(text|image|audio|video). Fire-and-forget from the frontend — swallow '
  'errors, never let this block a detection response.';

-- RLS: ops/admin-only table, same shape as worker_health (not user-facing
-- like scan_feedback) — service_role for the RPC/backend, no public access.
alter table vendor_call_log enable row level security;

create policy service_role_all on vendor_call_log
  for all
  to service_role
  using (true)
  with check (true);

-- Let authenticated admins read via the RPC's SECURITY DEFINER path or
-- directly if the admin app queries as authenticated + checks admin_users
-- server-side (matching how other admin tabs in this codebase gate access
-- at the application layer, not via a duplicated admin_users RLS join here).
grant execute on function increment_vendor_call(text, text, integer) to authenticated, anon, service_role;
