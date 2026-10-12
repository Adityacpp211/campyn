import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
}

let pgPool: pg.Pool | null = null;
let pgliteInstance: PGlite | null = null;
let isInitialized = false;

export async function getDb(): Promise<DbClient> {
  if (isInitialized) {
    return dbClient;
  }

  if (config.databaseUrl) {
    pgPool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    console.log('[Database] Connected to external PostgreSQL via Pool');
  } else {
    if (config.isProduction) {
      throw new Error('[FATAL DATABASE] Production mode requires external PostgreSQL via DATABASE_URL. Embedded PGlite is disabled in production.');
    }
    const dataDir = path.resolve(process.cwd(), 'data', 'campus_pg');
    if (!fs.existsSync(path.dirname(dataDir))) {
      fs.mkdirSync(path.dirname(dataDir), { recursive: true });
    }
    pgliteInstance = new PGlite(dataDir);
    await pgliteInstance.waitReady;
    console.log(`[Database] Initialized embedded PostgreSQL engine at ${dataDir} (DEVELOPMENT/LOCAL MODE ONLY)`);
  }

  isInitialized = true;
  return dbClient;
}

export const dbClient: DbClient = {
  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    if (!isInitialized) {
      await getDb();
    }

    if (pgPool) {
      const res = await pgPool.query(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount ?? res.rows.length,
      };
    } else if (pgliteInstance) {
      const res = await pgliteInstance.query(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rows.length,
      };
    }
    throw new Error('Database not initialized');
  },

  async exec(sql: string): Promise<void> {
    if (!isInitialized) {
      await getDb();
    }

    if (pgPool) {
      await pgPool.query(sql);
    } else if (pgliteInstance) {
      await pgliteInstance.exec(sql);
    }
  },
};

export async function withTransaction<T>(
  callback: (tx: DbClient) => Promise<T>
): Promise<T> {
  if (!isInitialized) {
    await getDb();
  }

  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const txClient: DbClient = {
        async query<R = any>(sql: string, params?: any[]): Promise<QueryResult<R>> {
          const res = await client.query(sql, params);
          return {
            rows: res.rows as R[],
            rowCount: res.rowCount ?? res.rows.length,
          };
        },
        async exec(sql: string): Promise<void> {
          await client.query(sql);
        },
      };
      const result = await callback(txClient);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else if (pgliteInstance) {
    return await pgliteInstance.transaction(async (tx) => {
      const txClient: DbClient = {
        async query<R = any>(sql: string, params?: any[]): Promise<QueryResult<R>> {
          const res = await tx.query(sql, params);
          return {
            rows: res.rows as R[],
            rowCount: res.rows.length,
          };
        },
        async exec(sql: string): Promise<void> {
          await tx.exec(sql);
        },
      };
      return await callback(txClient);
    });
  }

  throw new Error('Database not initialized');
}

export async function closeDb(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
  isInitialized = false;
}
