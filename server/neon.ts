import { Pool } from '@neondatabase/serverless';
import type { DB } from './db.js';

let singletonPool: Pool | null = null;

function buildDB(pool: Pool): DB {
  return {
    async query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }> {
      const result = await pool.query(sql, params);
      return { rows: result.rows, rowCount: result.rowCount };
    },
    async withTransaction<T>(fn: (tx: DB) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const txDB: DB = {
        async query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }> {
          const result = await client.query(sql, params);
          return { rows: result.rows, rowCount: result.rowCount };
        },
        async withTransaction<T2>(_fn: (tx2: DB) => Promise<T2>): Promise<T2> {
          throw new Error('Nested transactions are not supported');
        },
      };
      try {
        await txDB.query('BEGIN');
        const result = await fn(txDB);
        await txDB.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await txDB.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('[DB] Transaction rollback failed:', rollbackError);
        }
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

export function createNeonPool(databaseUrl: string): DB {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30_000,
  });

  return buildDB(pool);
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
  return buildDB(singletonPool);
}
