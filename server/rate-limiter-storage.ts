import type { DB } from './db.ts';
import type { RateLimitStorage, RateLimiter } from '../api/_lib/rate-limiter.ts';
import { checkRateLimit } from '../api/_lib/rate-limiter.ts';

export class PostgresRateLimitStorage implements RateLimitStorage {
  constructor(private db: DB) {}

  async increment(key: string, windowStart: number): Promise<number> {
    const windowStartDate = new Date(windowStart).toISOString();
    const result = await this.db.query(
      `INSERT INTO rate_limit_entries (username, window_start, attempt_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (username, window_start)
       DO UPDATE SET attempt_count = rate_limit_entries.attempt_count + 1
       RETURNING attempt_count`,
      [key, windowStartDate],
    );
    const row = result.rows[0] as Record<string, unknown>;
    return row.attempt_count as number;
  }

  async reset(key: string): Promise<void> {
    await this.db.query(
      `DELETE FROM rate_limit_entries WHERE username = $1`,
      [key],
    );
  }
}

export function createPostgresRateLimiter(db: DB): RateLimiter {
  const storage = new PostgresRateLimitStorage(db);
  return {
    storage,
    check: (identifier: string) => checkRateLimit(storage, identifier),
  };
}
