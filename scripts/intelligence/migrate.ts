/**
 * Applies db/intelligence/*.sql migrations in filename order, exactly once
 * each: applied filenames are recorded in intelligence_schema_migrations and
 * skipped on later runs. Each migration runs inside a transaction together
 * with its tracking row, so a failed migration leaves no partial state.
 *
 * Run: yarn db:intelligence:migrate
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { getDatabasePool } from '../../src/server/database'

async function main() {
  const dir = path.resolve(process.cwd(), 'db/intelligence')
  const files = (await fs.readdir(dir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
  const pool = await getDatabasePool()
  try {
    await pool.query(`
      create table if not exists intelligence_schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `)
    const done = await pool.query<{ filename: string }>(
      `select filename from intelligence_schema_migrations`,
    )
    const applied = new Set(done.rows.map((r) => r.filename))

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skipped ${file} (already applied)`)
        continue
      }
      const sql = await fs.readFile(path.join(dir, file), 'utf8')
      const client = await pool.connect()
      try {
        await client.query('begin')
        await client.query(sql)
        await client.query(
          `insert into intelligence_schema_migrations (filename) values ($1)`,
          [file],
        )
        await client.query('commit')
      } catch (err) {
        await client.query('rollback')
        throw err
      } finally {
        client.release()
      }
      console.log(`applied ${file}`)
    }
    console.log('intelligence migrations complete')
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
