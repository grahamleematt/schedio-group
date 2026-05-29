import { Pool } from 'pg'
import type { PoolClient, PoolConfig, QueryResultRow } from 'pg'

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

export function getDatabasePool(): Pool {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not configured')
  }
  if (!pool) {
    const env = getDatabaseEnv()
    pool = new Pool({
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
  const result = await getDatabasePool().query<T>(text, [...values])
  return {
    rows: result.rows,
    rowCount: result.rowCount,
  }
}

export async function dbTransaction<T>(
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getDatabasePool().connect()
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
