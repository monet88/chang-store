import { Pool } from '@neondatabase/serverless';
import type { DB } from './db.ts';

let singletonPool: Pool | null = null;

export function createNeonPool(databaseUrl: string): DB {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30_000,
  });

  return {
    async query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
      const result = await pool.query(sql, params);
      return { rows: result.rows };
    },
  };
}

export function getNeonPool(databaseUrl?: string): DB {
  if (!singletonPool) {
    if (!databaseUrl) {
      throw new Error('Database URL required for initial Neon pool creation');
    }
    singletonPool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30_000,
    });
  }
  return {
    async query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
      const result = await singletonPool!.query(sql, params);
      return { rows: result.rows };
    },
  };
}
