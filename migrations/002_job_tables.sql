-- UP: Create job queue tables for Slice 2 (durable job queue)
-- Reverse: DROP TABLE IF EXISTS job_events, job_assets, jobs CASCADE;

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  feature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'partial')),
  idempotency_key TEXT NOT NULL UNIQUE,
  input_payload_json JSONB NOT NULL DEFAULT '{}',
  workflow_run_id TEXT,
  progress_total INTEGER NOT NULL DEFAULT 0,
  progress_done INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS job_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  kind TEXT NOT NULL CHECK (kind IN ('input', 'output')),
  blob_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  event_type TEXT NOT NULL,
  event_payload_json JSONB NOT NULL DEFAULT '{}',
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for jobs
CREATE INDEX IF NOT EXISTS idx_jobs_user_id_status ON jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id_created_at_desc ON jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at);

-- Indexes for job_assets
CREATE INDEX IF NOT EXISTS idx_job_assets_job_id ON job_assets(job_id);

-- Indexes for job_events
CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON job_events(job_id);

-- -- DOWN --
-- DROP TABLE IF EXISTS job_events CASCADE;
-- DROP TABLE IF EXISTS job_assets CASCADE;
-- DROP TABLE IF EXISTS jobs CASCADE;
