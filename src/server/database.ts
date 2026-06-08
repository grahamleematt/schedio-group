import type { Pool, PoolClient, PoolConfig, QueryResultRow } from 'pg'

import { getDatabaseEnv, isDatabaseConfigured } from './env'

type QueryResult<T extends QueryResultRow> = {
  rows: Array<T>
  rowCount: number | null
}

let pool: Pool | null = null

function sslConfig(): PoolConfig['ssl'] {
  const env = getDatabaseEnv()
  return env.DATABASE_SSL ? { rejectUnauthorized: false } : false
}

// `pg` is a Node-only package with import-time side effects (its protocol
// driver touches `Buffer`). Import it lazily so this module carries no
// top-level node import: when a server function's handler is stripped for the
// client build, the whole database → pg chain becomes side-effect-free and is
// tree-shaken out of the browser bundle. A static import would ride into the
// client and crash hydration with `Buffer is not defined`.
export async function getDatabasePool(): Promise<Pool> {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not configured')
  }
  if (!pool) {
    const { Pool: PgPool } = await import('pg')
    const env = getDatabaseEnv()
    pool = new PgPool({
      connectionString: env.DATABASE_URL,
      ssl: sslConfig(),
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return pool
}

export async function dbQuery<T extends QueryResultRow>(
  text: string,
  values: ReadonlyArray<unknown> = [],
): Promise<QueryResult<T>> {
  const db = await getDatabasePool()
  const result = await db.query<T>(text, [...values])
  return {
    rows: result.rows,
    rowCount: result.rowCount,
  }
}

export async function dbTransaction<T>(
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await getDatabasePool()
  const client = await db.connect()
  try {
    await client.query('begin')
    const result = await run(client)
    await client.query('commit')
    return result
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}
