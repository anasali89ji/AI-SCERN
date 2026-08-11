-- ============================================================================
-- v23_organization_accounts.sql
-- Adds individual/organization account typing to profiles, so signups can
-- identify as an individual or as part of a corporate, HR/recruiting, or
-- educational organization. Organization accounts carry a verified work
-- domain (derived server-side from the Clerk session email, never trusted
-- from client input) so free-webmail addresses can't masquerade as a company.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_type        TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS organization_name    TEXT,
  ADD COLUMN IF NOT EXISTS organization_type    TEXT,
  ADD COLUMN IF NOT EXISTS organization_domain  TEXT,
  ADD COLUMN IF NOT EXISTS job_title            TEXT;

-- Constrain to known values. Using DO blocks so re-running this migration
-- doesn't error if the constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_account_type_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_account_type_check
      CHECK (account_type IN ('individual', 'organization'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_organization_type_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_organization_type_check
      CHECK (organization_type IS NULL OR organization_type IN ('corporate', 'hr', 'education'));
  END IF;

  -- An organization account must carry an organization_name and organization_type.
  -- Individual accounts must not (keeps analytics/reporting on org accounts clean).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_org_fields_consistency_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_org_fields_consistency_check
      CHECK (
        (account_type = 'individual' AND organization_type IS NULL)
        OR
        (account_type = 'organization' AND organization_type IS NOT NULL AND organization_name IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_account_type       ON profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_domain ON profiles(organization_domain);

COMMENT ON COLUMN profiles.account_type       IS 'individual | organization — set once during onboarding, editable later in settings';
COMMENT ON COLUMN profiles.organization_type  IS 'corporate | hr | education — only set when account_type = organization';
COMMENT ON COLUMN profiles.organization_domain IS 'Email domain the org account was verified against, derived server-side from the Clerk session — never trust a client-submitted value for this column';
