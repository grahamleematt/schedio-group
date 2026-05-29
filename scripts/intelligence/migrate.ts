import { promises as fs } from 'node:fs'
import path from 'node:path'

import { getDatabasePool } from '../../src/server/database'

async function main() {
  const dir = path.resolve(process.cwd(), 'db/intelligence')
  const files = (await fs.readdir(dir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
  const pool = getDatabasePool()
  try {
    for (const file of files) {
      const sql = await fs.readFile(path.join(dir, file), 'utf8')
      await pool.query(sql)
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
