-- ============================================================
-- AI-SCERN ADMIN PANEL — COMPLETE DATABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. PROFILES (extend existing auth.users)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS plan_id text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS credits_balance integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_remaining integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS scan_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_scans integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS credit_period_start timestamptz,
ADD COLUMN IF NOT EXISTS credit_period_end timestamptz,
ADD COLUMN IF NOT EXISTS plan_granted_by text,
ADD COLUMN IF NOT EXISTS plan_updated_at timestamptz;

-- 2. SCANS
CREATE TABLE IF NOT EXISTS scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('text','image','audio','video')),
  verdict text NOT NULL CHECK (verdict IN ('AI','HUMAN','UNCERTAIN')),
  confidence_score numeric(4,3) DEFAULT 0.5,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scans_created ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_type ON scans(media_type);
CREATE INDEX IF NOT EXISTS idx_scans_verdict ON scans(verdict);

-- 3. CREDIT TRANSACTIONS
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  credits integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id);

-- 4. SUPPORT TICKETS
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at DESC);

-- 5. ERROR LOGS
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  path text,
  count integer DEFAULT 1,
  resolved boolean DEFAULT false,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  severity text DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  stack_trace text,
  resolution_note text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_errors_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_errors_seen ON error_logs(last_seen DESC);

-- 6. ADMIN AUDIT LOG
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  admin_id text,
  admin_ip text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action);

-- 7. ADMIN SESSIONS
CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text UNIQUE NOT NULL,
  admin_id text,
  ip_address text,
  user_agent text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON admin_sessions(session_token);

-- 8. API KEYS
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  name text NOT NULL,
  key_prefix text NOT NULL,
  permissions text[] DEFAULT '{}',
  rate_limit integer DEFAULT 60,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  usage_count integer DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- 9. CONTENT FLAGS
CREATE TABLE IF NOT EXISTS content_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  content_url text,
  reason text NOT NULL,
  severity text DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text DEFAULT 'pending' CHECK (status IN ('pending','reviewed','removed','dismissed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_flags_status ON content_flags(status);

-- 10. WEBHOOKS
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  events text[] DEFAULT '{}',
  active boolean DEFAULT true,
  description text,
  secret text,
  created_at timestamptz DEFAULT now()
);

-- 11. FEATURE FLAGS
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean DEFAULT false,
  rollout_percentage integer DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),
  target_audience text DEFAULT 'all',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 12. ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  type text DEFAULT 'info' CHECK (type IN ('info','warning','promotion','maintenance')),
  target_audience text DEFAULT 'all',
  active boolean DEFAULT true,
  priority integer DEFAULT 0,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  scheduled boolean DEFAULT false,
  send_notification boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 13. ADMIN USERS
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  password_hash text NOT NULL,
  role text DEFAULT 'admin' CHECK (role IN ('admin','super_admin','moderator')),
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 14. SITE SETTINGS
CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

-- 15. RATE LIMIT EVENTS
CREATE TABLE IF NOT EXISTS rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  endpoint text,
  count integer DEFAULT 1,
  last_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip ON rate_limit_events(ip_address);

-- 16. BACKUPS
CREATE TABLE IF NOT EXISTS backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  tables text[] DEFAULT '{}',
  total_rows integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by text
);

-- 17. MARKETING ANALYTICS
CREATE TABLE IF NOT EXISTS marketing_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  visits integer DEFAULT 0,
  unique_visitors integer DEFAULT 0,
  signups integer DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  referrer text,
  utm_source text,
  utm_medium text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_date ON marketing_analytics(date);

-- 18. PIPELINE STATS
CREATE TABLE IF NOT EXISTS pipeline_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_scraped integer DEFAULT 0,
  total_pushed integer DEFAULT 0,
  worker_id text,
  items integer DEFAULT 0,
  avg_q numeric(5,2) DEFAULT 0,
  commit_id text,
  status text DEFAULT 'success',
  created_at timestamptz DEFAULT now()
);

-- 19. PIPELINE COSTS
CREATE TABLE IF NOT EXISTS pipeline_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  vendor text NOT NULL,
  calls integer DEFAULT 0,
  cost numeric(10,4) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_costs_day ON pipeline_costs(day);

-- 20. FALLBACK FLAGS
CREATE TABLE IF NOT EXISTS fallback_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modality text NOT NULL,
  paid_calls integer DEFAULT 0,
  detections integer DEFAULT 0,
  paid_call_rate numeric(5,2) DEFAULT 0,
  flagged boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 21. BLOCKED DOMAINS
CREATE TABLE IF NOT EXISTS blocked_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  reason text,
  blocked_by text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blocked_domains ON blocked_domains(domain);

-- 22. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type text DEFAULT 'system',
  priority text DEFAULT 'normal',
  read boolean DEFAULT false,
  target_audience text DEFAULT 'all',
  action_url text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- ============================================================
-- DEFAULT DATA
-- ============================================================

INSERT INTO site_settings (key, value) VALUES
('maintenance_mode', 'false'),
('registration_open', 'true'),
('free_scans_limit', '10'),
('pro_scans_limit', '1000'),
('max_file_size_mb', '50'),
('support_email', 'support@aiscern.com'),
('default_plan', 'free'),
('referral_credits', '10'),
('data_retention_days', '90'),
('enable_ai_chat', 'true'),
('enable_image_detection', 'true'),
('enable_audio_detection', 'true'),
('enable_video_detection', 'true'),
('require_email_verification', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value) VALUES
('site_name', 'Aiscern'),
('site_tagline', 'AI Content Detection'),
('primary_color', '#3b82f6'),
('secondary_color', '#8b5cf6'),
('logo_url', ''),
('favicon_url', ''),
('email_from_name', 'Aiscern'),
('email_from_address', 'noreply@aiscern.com'),
('social_twitter', ''),
('social_discord', ''),
('social_github', ''),
('footer_text', '© 2025 Aiscern. All rights reserved.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value) VALUES
('maintenance_enabled', 'false'),
('maintenance_message', 'We are performing scheduled maintenance. Please check back soon.'),
('maintenance_duration', '2 hours'),
('maintenance_allowed_ips', '[]')
ON CONFLICT (key) DO NOTHING;

-- Create default admin user (password: admin123 — CHANGE IMMEDIATELY)
-- Run this AFTER the table exists and bcryptjs is available in your app
-- Or hash the password externally and insert:
-- INSERT INTO admin_users (email, name, password_hash, role, is_active)
-- VALUES ('admin@aiscern.com', 'Super Admin', '$2a$12$...', 'super_admin', true)
-- ON CONFLICT (email) DO NOTHING;

-- Enable RLS on sensitive tables (optional but recommended)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
