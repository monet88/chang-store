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
