ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_use_case TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_step_reached INTEGER DEFAULT 0;
