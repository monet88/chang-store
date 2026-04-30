import { randomUUID } from 'node:crypto';

// ---- Type definitions ----

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  status: 'active' | 'disabled';
  created_at: Date;
  last_login_at: Date | null;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  token_fingerprint: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
}

export interface RateLimitRecord {
  username: string;
  window_start: Date;
  attempt_count: number;
}

// ---- Database interface (Slice 2 Neon wiring) ----

export interface DB {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

// ---- SQL template tag helper ----

export function sql(strings: TemplateStringsArray, ...values: unknown[]): { text: string; values: unknown[] } {
  const text = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''), '');
  return { text, values };
}

// ---- Query functions ----

export async function getUserByUsername(db: DB, username: string): Promise<UserRecord | null> {
  const q = sql`SELECT id, username, password_hash, status, created_at, last_login_at FROM users WHERE username = ${username}`;
  const result = await db.query(q.text, q.values);
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    username: row.username as string,
    password_hash: row.password_hash as string,
    status: row.status as 'active' | 'disabled',
    created_at: new Date(row.created_at as string),
    last_login_at: row.last_login_at ? new Date(row.last_login_at as string) : null,
  };
}

export async function createUser(db: DB, username: string, passwordHash: string): Promise<UserRecord> {
  const id = randomUUID();
  const q = sql`INSERT INTO users (id, username, password_hash) VALUES (${id}, ${username}, ${passwordHash}) RETURNING id, username, password_hash, status, created_at, last_login_at`;
  const result = await db.query(q.text, q.values);
  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    username: row.username as string,
    password_hash: row.password_hash as string,
    status: row.status as 'active' | 'disabled',
    created_at: new Date(row.created_at as string),
    last_login_at: row.last_login_at ? new Date(row.last_login_at as string) : null,
  };
}

export async function updateLastLogin(db: DB, userId: string): Promise<void> {
  const q = sql`UPDATE users SET last_login_at = now() WHERE id = ${userId}`;
  await db.query(q.text, q.values);
}

export async function createSessionAudit(
  db: DB,
  userId: string,
  fingerprint: string,
  expiresAt: Date,
): Promise<SessionRecord> {
  const id = randomUUID();
  const q = sql`INSERT INTO sessions (id, user_id, token_fingerprint, expires_at) VALUES (${id}, ${userId}, ${fingerprint}, ${expiresAt.toISOString()}) RETURNING id, user_id, token_fingerprint, expires_at, created_at, revoked_at`;
  const result = await db.query(q.text, q.values);
  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    token_fingerprint: row.token_fingerprint as string,
    expires_at: new Date(row.expires_at as string),
    created_at: new Date(row.created_at as string),
    revoked_at: row.revoked_at ? new Date(row.revoked_at as string) : null,
  };
}

export async function revokeSession(db: DB, fingerprint: string): Promise<void> {
  const q = sql`UPDATE sessions SET revoked_at = now() WHERE token_fingerprint = ${fingerprint} AND revoked_at IS NULL`;
  await db.query(q.text, q.values);
}

// ---- Job types ----

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'partial';

export interface JobRecord {
  id: string;
  user_id: string;
  feature: string;
  status: JobStatus;
  idempotency_key: string;
  input_payload_json: Record<string, unknown>;
  workflow_run_id: string | null;
  progress_total: number;
  progress_done: number;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  error_code: string | null;
  error_message: string | null;
}

export interface JobAssetRecord {
  id: string;
  job_id: string;
  kind: 'input' | 'output';
  blob_path: string;
  mime_type: string;
  created_at: Date;
}

export interface JobEventRecord {
  id: string;
  job_id: string;
  event_type: string;
  event_payload_json: Record<string, unknown>;
  trace_id: string | null;
  created_at: Date;
}

export interface FinalizeJobOutputsInput {
  status: 'completed' | 'partial';
  assets: Array<{ blobPath: string; mimeType: string }>;
  eventPayload?: Record<string, unknown>;
  traceId?: string;
  errorCode?: string;
  errorMessage?: string;
}

// ---- Job query functions ----

function rowToJob(row: Record<string, unknown>): JobRecord {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    feature: row.feature as string,
    status: row.status as JobStatus,
    idempotency_key: row.idempotency_key as string,
    input_payload_json: row.input_payload_json as Record<string, unknown>,
    workflow_run_id: row.workflow_run_id as string | null,
    progress_total: row.progress_total as number,
    progress_done: row.progress_done as number,
    created_at: new Date(row.created_at as string),
    started_at: row.started_at ? new Date(row.started_at as string) : null,
    completed_at: row.completed_at ? new Date(row.completed_at as string) : null,
    error_code: row.error_code as string | null,
    error_message: row.error_message as string | null,
  };
}

function rowToJobAsset(row: Record<string, unknown>): JobAssetRecord {
  return {
    id: row.id as string,
    job_id: row.job_id as string,
    kind: row.kind as 'input' | 'output',
    blob_path: row.blob_path as string,
    mime_type: row.mime_type as string,
    created_at: new Date(row.created_at as string),
  };
}

function rowToJobEvent(row: Record<string, unknown>): JobEventRecord {
  return {
    id: row.id as string,
    job_id: row.job_id as string,
    event_type: row.event_type as string,
    event_payload_json: row.event_payload_json as Record<string, unknown>,
    trace_id: row.trace_id as string | null,
    created_at: new Date(row.created_at as string),
  };
}

export async function createJob(
  db: DB,
  userId: string,
  feature: string,
  idempotencyKey: string,
  inputPayload: Record<string, unknown>,
): Promise<JobRecord> {
  const id = randomUUID();
  const payload = JSON.stringify(inputPayload);
  const q = sql`INSERT INTO jobs (id, user_id, feature, idempotency_key, input_payload_json) VALUES (${id}, ${userId}, ${feature}, ${idempotencyKey}, ${payload}) RETURNING *`;
  const result = await db.query(q.text, q.values);
  return rowToJob(result.rows[0] as Record<string, unknown>);
}

export async function getJobById(
  db: DB,
  jobId: string,
  userId?: string,
): Promise<JobRecord | null> {
  let q;
  if (userId) {
    q = sql`SELECT * FROM jobs WHERE id = ${jobId} AND user_id = ${userId}`;
  } else {
    q = sql`SELECT * FROM jobs WHERE id = ${jobId}`;
  }
  const result = await db.query(q.text, q.values);
  if (result.rows.length === 0) return null;
  return rowToJob(result.rows[0] as Record<string, unknown>);
}

export async function listJobsByUser(
  db: DB,
  userId: string,
  status?: JobStatus,
  limit = 50,
  offset = 0,
): Promise<JobRecord[]> {
  let q;
  if (status) {
    q = sql`SELECT * FROM jobs WHERE user_id = ${userId} AND status = ${status} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  } else {
    q = sql`SELECT * FROM jobs WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  }
  const result = await db.query(q.text, q.values);
  return result.rows.map(row => rowToJob(row as Record<string, unknown>));
}

export async function updateJobStatus(
  db: DB,
  jobId: string,
  status: JobStatus,
  errorCode?: string,
  errorMessage?: string,
): Promise<void> {
  const q = sql`UPDATE jobs SET
    status = ${status},
    error_code = ${errorCode ?? null},
    error_message = ${errorMessage ?? null},
    started_at = CASE WHEN ${status} = 'running' THEN COALESCE(started_at, now()) ELSE started_at END,
    completed_at = CASE WHEN ${status} IN ('completed', 'failed', 'partial') THEN now() ELSE completed_at END
  WHERE id = ${jobId}`;
  await db.query(q.text, q.values);
}

export async function finalizeJobOutputs(
  db: DB,
  jobId: string,
  input: FinalizeJobOutputsInput,
): Promise<JobAssetRecord[]> {
  const assetValues = input.assets.flatMap((asset) => [
    randomUUID(),
    jobId,
    'output',
    asset.blobPath,
    asset.mimeType,
  ]);
  const assetPlaceholders = input.assets
    .map((_, index) => {
      const base = index * 5;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    })
    .join(', ');
  const eventId = randomUUID();
  const eventPayload = JSON.stringify(input.eventPayload ?? {});
  const params = [
    ...assetValues,
    input.status,
    input.errorCode ?? null,
    input.errorMessage ?? null,
    jobId,
    eventId,
    jobId,
    input.status,
    eventPayload,
    input.traceId ?? null,
  ];
  const assetInsertSql = input.assets.length > 0
    ? `WITH inserted_assets AS (INSERT INTO job_assets (id, job_id, kind, blob_path, mime_type) VALUES ${assetPlaceholders} RETURNING *), updated_job AS (UPDATE jobs SET status = $${assetValues.length + 1}, error_code = $${assetValues.length + 2}, error_message = $${assetValues.length + 3}, completed_at = now() WHERE id = $${assetValues.length + 4}), inserted_event AS (INSERT INTO job_events (id, job_id, event_type, event_payload_json, trace_id) VALUES ($${assetValues.length + 5}, $${assetValues.length + 6}, $${assetValues.length + 7}, $${assetValues.length + 8}, $${assetValues.length + 9})) SELECT * FROM inserted_assets`
    : `WITH updated_job AS (UPDATE jobs SET status = $1, error_code = $2, error_message = $3, completed_at = now() WHERE id = $4), inserted_event AS (INSERT INTO job_events (id, job_id, event_type, event_payload_json, trace_id) VALUES ($5, $6, $7, $8, $9)) SELECT * FROM job_assets WHERE 1 = 0`;
  const q = { text: assetInsertSql, values: params };
  const result = await db.query(q.text, q.values);
  return result.rows.map(row => rowToJobAsset(row as Record<string, unknown>));
}

export async function updateJobProgress(
  db: DB,
  jobId: string,
  progressDone: number,
): Promise<void> {
  const q = sql`UPDATE jobs SET progress_done = ${progressDone} WHERE id = ${jobId}`;
  await db.query(q.text, q.values);
}

export async function createJobAsset(
  db: DB,
  jobId: string,
  kind: 'input' | 'output',
  blobPath: string,
  mimeType: string,
): Promise<JobAssetRecord> {
  const id = randomUUID();
  const q = sql`INSERT INTO job_assets (id, job_id, kind, blob_path, mime_type) VALUES (${id}, ${jobId}, ${kind}, ${blobPath}, ${mimeType}) RETURNING *`;
  const result = await db.query(q.text, q.values);
  return rowToJobAsset(result.rows[0] as Record<string, unknown>);
}

export async function getJobAssets(db: DB, jobId: string): Promise<JobAssetRecord[]> {
  const q = sql`SELECT * FROM job_assets WHERE job_id = ${jobId} ORDER BY created_at`;
  const result = await db.query(q.text, q.values);
  return result.rows.map(row => rowToJobAsset(row as Record<string, unknown>));
}

export async function createJobEvent(
  db: DB,
  jobId: string,
  eventType: string,
  payload?: Record<string, unknown>,
  traceId?: string,
): Promise<JobEventRecord> {
  const id = randomUUID();
  const eventPayload = JSON.stringify(payload ?? {});
  const q = sql`INSERT INTO job_events (id, job_id, event_type, event_payload_json, trace_id) VALUES (${id}, ${jobId}, ${eventType}, ${eventPayload}, ${traceId ?? null}) RETURNING *`;
  const result = await db.query(q.text, q.values);
  return rowToJobEvent(result.rows[0] as Record<string, unknown>);
}

export async function getJobEvents(db: DB, jobId: string): Promise<JobEventRecord[]> {
  const q = sql`SELECT * FROM job_events WHERE job_id = ${jobId} ORDER BY created_at`;
  const result = await db.query(q.text, q.values);
  return result.rows.map(row => rowToJobEvent(row as Record<string, unknown>));
}
