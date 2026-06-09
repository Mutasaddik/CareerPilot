-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── Users ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(255) NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    VARCHAR(255),
  phone            VARCHAR(50),
  current_title    VARCHAR(255),
  experience_years SMALLINT,
  location         VARCHAR(255),
  avatar_url       TEXT,
  plan             VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  oauth_provider   VARCHAR(50),
  oauth_id         VARCHAR(255),
  is_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  theme_preference VARCHAR(20) NOT NULL DEFAULT 'dark' CHECK (theme_preference IN ('dark','light','system')),
  timezone         VARCHAR(100) NOT NULL DEFAULT 'Asia/Dhaka',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

-- ── Sessions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash  VARCHAR(255) NOT NULL UNIQUE,
  device_info         TEXT,
  ip_address          INET,
  location            VARCHAR(255),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL,
  is_revoked          BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token_hash);

-- ── OTP Codes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_codes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  otp_hash        VARCHAR(255) NOT NULL,
  purpose         VARCHAR(50) NOT NULL CHECK (purpose IN ('registration','login','forgot_password','new_device')),
  expires_at      TIMESTAMPTZ NOT NULL,
  is_used         BOOLEAN NOT NULL DEFAULT FALSE,
  resend_count    SMALLINT NOT NULL DEFAULT 0,
  last_resend_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);

-- ── User Profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id                  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  target_roles             TEXT[],
  target_locations         TEXT[],
  skills                   TEXT[],
  experience_years         SMALLINT,
  job_type                 VARCHAR(50),
  salary_min_bdt           INTEGER,
  salary_max_bdt           INTEGER,
  remote_preference        VARCHAR(50),
  scrape_frequency_hours   SMALLINT NOT NULL DEFAULT 12,
  cv_template_preference   VARCHAR(50) DEFAULT 'modern',
  push_subscription_json   JSONB,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CVs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cvs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url             TEXT NOT NULL,
  file_hash            VARCHAR(64) NOT NULL,
  extracted_text       TEXT,
  ats_score            SMALLINT,
  version_number       SMALLINT NOT NULL DEFAULT 1,
  analysis_json        JSONB,
  template_preference  VARCHAR(50) DEFAULT 'modern',
  usage_scope          VARCHAR(30) NOT NULL DEFAULT 'primary' CHECK (usage_scope IN ('primary','company_only','job_only')),
  company_name         VARCHAR(255),
  job_id               UUID,
  is_primary           BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cvs_user ON cvs(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cvs_hash_user ON cvs(file_hash, user_id);

-- ── Jobs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            VARCHAR(500) NOT NULL,
  company          VARCHAR(255) NOT NULL,
  company_logo_url TEXT,
  company_domain   VARCHAR(255),
  location         VARCHAR(255),
  job_url          TEXT NOT NULL,
  description      TEXT,
  posted_date      TIMESTAMPTZ,
  scraped_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sources          TEXT[] NOT NULL DEFAULT '{}',
  is_remote        BOOLEAN NOT NULL DEFAULT FALSE,
  experience_level VARCHAR(50),
  salary_min_bdt   INTEGER,
  salary_max_bdt   INTEGER,
  is_expired       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_title ON jobs USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_jobs_scraped ON jobs(scraped_at);
CREATE INDEX IF NOT EXISTS idx_jobs_expired ON jobs(is_expired);

-- ── Job Matches ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_matches (
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id               UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  relevance_score      SMALLINT NOT NULL DEFAULT 0,
  match_breakdown_json JSONB,
  alerted              BOOLEAN NOT NULL DEFAULT FALSE,
  seen                 BOOLEAN NOT NULL DEFAULT FALSE,
  user_feedback        VARCHAR(20) CHECK (user_feedback IN ('up','down',NULL)),
  PRIMARY KEY (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_user ON job_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON job_matches(relevance_score DESC);

-- ── Applications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id           UUID REFERENCES jobs(id) ON DELETE SET NULL,
  status           VARCHAR(50) NOT NULL DEFAULT 'saved' CHECK (status IN ('saved','applied','screening','assessment','interview','offer','rejected','withdrawn')),
  notes            TEXT,
  contact_id       UUID,
  follow_up_date   DATE,
  applied_date     DATE,
  cv_version_used  UUID REFERENCES cvs(id) ON DELETE SET NULL,
  offer_salary_bdt INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- ── Cover Letters ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cover_letters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      UUID REFERENCES jobs(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  tone        VARCHAR(50) NOT NULL DEFAULT 'professional' CHECK (tone IN ('professional','confident','conversational')),
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cover_letters_user ON cover_letters(user_id);

-- ── Contacts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  title             VARCHAR(255),
  company           VARCHAR(255),
  email             VARCHAR(255),
  linkedin_url      TEXT,
  phone             VARCHAR(50),
  avatar_url        TEXT,
  notes             TEXT,
  status            VARCHAR(30) NOT NULL DEFAULT 'cold' CHECK (status IN ('cold','reached_out','replied','in_progress','closed')),
  last_contacted_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);

-- ── Interview Experiences ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_experiences (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company          VARCHAR(255) NOT NULL,
  role             VARCHAR(255) NOT NULL,
  rounds_json      JSONB,
  questions_json   JSONB,
  difficulty       VARCHAR(20) CHECK (difficulty IN ('easy','medium','hard','very_hard')),
  outcome          VARCHAR(20) CHECK (outcome IN ('offer','rejected','withdrew','pending')),
  source_url       TEXT,
  scraped_at       TIMESTAMPTZ,
  user_submitted   BOOLEAN NOT NULL DEFAULT FALSE,
  user_rating      SMALLINT CHECK (user_rating BETWEEN 1 AND 5),
  is_approved      BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_notes TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_exp_company ON interview_experiences(company);

-- ── Scheduled Interviews ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interviews_scheduled (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company                  VARCHAR(255) NOT NULL,
  role                     VARCHAR(255) NOT NULL,
  scheduled_at             TIMESTAMPTZ NOT NULL,
  round_type               VARCHAR(50),
  contact_id               UUID REFERENCES contacts(id) ON DELETE SET NULL,
  prep_notes               TEXT,
  google_calendar_event_id VARCHAR(255),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interviews_user ON interviews_scheduled(user_id);

-- ── Learning Roadmaps ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learning_roadmaps (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  roadmap_json  JSONB NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  progress_json JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_roadmaps_user ON learning_roadmaps(user_id);

-- ── Learning Resources ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learning_resources (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill             VARCHAR(255) NOT NULL,
  resource_type     VARCHAR(50) CHECK (resource_type IN ('video','article','course','book','practice')),
  url               TEXT NOT NULL,
  title             VARCHAR(500) NOT NULL,
  last_validated_at TIMESTAMPTZ,
  is_broken         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_skill ON learning_resources(skill);

-- ── Salary Insights ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_insights (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role             VARCHAR(255) NOT NULL,
  location         VARCHAR(255),
  experience_level VARCHAR(50),
  salary_min_bdt   INTEGER,
  salary_max_bdt   INTEGER,
  source           VARCHAR(50) CHECK (source IN ('scraped','betonkemon','user_contribution','ai_estimated')),
  data_json        JSONB,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_salary_role ON salary_insights(role);

-- ── Salary Contributions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_contributions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             VARCHAR(255) NOT NULL,
  location         VARCHAR(255),
  experience_years SMALLINT,
  salary_bdt       INTEGER NOT NULL,
  is_validated     BOOLEAN NOT NULL DEFAULT FALSE,
  is_outlier       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Market Intelligence ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_intel (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role         VARCHAR(255) NOT NULL,
  location     VARCHAR(255),
  data_json    JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_market_role ON market_intel(role);

-- ── Notifications ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);

-- ── Daily Goals ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goals_json      JSONB NOT NULL,
  date            DATE NOT NULL,
  completed_count SMALLINT NOT NULL DEFAULT 0,
  total_count     SMALLINT NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_goals_user_date ON daily_goals(user_id, date);

-- ── Pro Tips ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pro_tips (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content      TEXT NOT NULL,
  batch_week   VARCHAR(20) NOT NULL,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  role_tags    TEXT[],
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Plans ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(50) NOT NULL,
  price_bdt     INTEGER NOT NULL DEFAULT 0,
  features_json JSONB,
  is_active     BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Subscriptions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan             VARCHAR(50) NOT NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','cancelled','expired')),
  started_at       TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  payment_provider VARCHAR(50) CHECK (payment_provider IN ('bkash','nagad','stripe')),
  payment_id       VARCHAR(255)
);

-- ── Payments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_bdt     INTEGER NOT NULL,
  provider       VARCHAR(50) CHECK (provider IN ('bkash','nagad','stripe')),
  transaction_id VARCHAR(255),
  status         VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','refunded')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Feature Flags ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_name VARCHAR(100) UNIQUE NOT NULL,
  is_pro_only  BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO feature_flags (feature_name, is_pro_only, is_enabled) VALUES
  ('cv_analysis', FALSE, TRUE),
  ('job_matching', FALSE, TRUE),
  ('cover_letters', FALSE, TRUE),
  ('skill_radar', FALSE, TRUE),
  ('salary_insights', FALSE, TRUE),
  ('market_intelligence', FALSE, TRUE),
  ('interview_prep', FALSE, TRUE),
  ('learning_hub', FALSE, TRUE),
  ('application_tracker', FALSE, TRUE),
  ('alert_system', FALSE, TRUE),
  ('contacts', FALSE, TRUE),
  ('daily_action_plan', FALSE, TRUE),
  ('global_search', FALSE, TRUE)
ON CONFLICT (feature_name) DO NOTHING;

-- ── Scraper Logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scraper_logs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source               VARCHAR(50) NOT NULL CHECK (source IN ('jsearch','bdjobs','rozee','betonkemon','tahanima')),
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at          TIMESTAMPTZ,
  jobs_found           INTEGER DEFAULT 0,
  status               VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  error_message        TEXT,
  consecutive_failures SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_scraper_logs_source ON scraper_logs(source);

-- ── Search History ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS search_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  query         TEXT NOT NULL,
  results_count INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_user ON search_history(user_id);

-- ── Job Feedback ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_feedback (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  feedback_type VARCHAR(10) NOT NULL CHECK (feedback_type IN ('up','down')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- ── Admin Users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL CHECK (role IN ('superadmin','admin','moderator')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_user ON admin_users(user_id);

-- ── Audit Logs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  performed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_by_role    VARCHAR(20),
  action               VARCHAR(100) NOT NULL,
  target_type          VARCHAR(50),
  target_id            UUID,
  old_value_json       JSONB,
  new_value_json       JSONB,
  ip_address           INET,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_performer ON audit_logs(performed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ── Maintenance Mode ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_mode (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  message    TEXT DEFAULT 'CareerPilot is temporarily down for maintenance. We will be back shortly.',
  enabled_at TIMESTAMPTZ
);

INSERT INTO maintenance_mode (is_enabled) VALUES (FALSE) ON CONFLICT DO NOTHING;

-- ── Auto-update updated_at trigger ───────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();