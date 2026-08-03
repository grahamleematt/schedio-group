/**
 * Read-only Egnyte tree crawl — investigation tooling for the
 * contract-to-lien-waiver chain view. Walks the folder tree breadth-first
 * from --root (default '/Shared') and prints every folder plus files that
 * look like chain documents (contracts, task/change orders, invoices,
 * pay apps, proofs of payment, lien waivers).
 *
 * Run: npx tsx --env-file=.env.local scripts/egnyte/_crawl-tree.ts \
 *        [--root /Shared/Clients] [--depth 6] [--all-files]
 */

import { listFolder } from '#/server/egnyte'

const CHAIN_HINT =
  /lien|waiver|contract|task.?order|change.?order|invoice|pay.?app|proof.?of.?payment|payment|G70[23]|\bCO\d|\bTO\d|\bPA\b|\bINV\b|\bPOP\b|\bLW\b/i

function argValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  return index >= 0 && process.argv[index + 1]
    ? process.argv[index + 1]
    : fallback
}

const ROOT = argValue('--root', '/Shared')
const MAX_DEPTH = Number(argValue('--depth', '6'))
const ALL_FILES = process.argv.includes('--all-files')
const MAX_FOLDERS = 400

async function main() {
  const queue: Array<{ path: string; depth: number }> = [
    { path: ROOT, depth: 0 },
  ]
  let visited = 0
  while (queue.length > 0) {
    const { path, depth } = queue.shift()!
    if (visited >= MAX_FOLDERS) {
      console.log(`… stopped after ${MAX_FOLDERS} folders`)
      break
    }
    visited += 1
    let listing
    try {
      listing = await listFolder({ path })
    } catch (err) {
      console.log(
        `${'  '.repeat(depth)}✗ ${path} — ${err instanceof Error ? err.message : 'list failed'}`,
      )
      continue
    }
    console.log(`${'  '.repeat(depth)}📁 ${path}`)
    for (const file of listing.files) {
      if (ALL_FILES || CHAIN_HINT.test(file.name)) {
        const kb = Math.round(file.sizeBytes / 1024)
        console.log(`${'  '.repeat(depth + 1)}· ${file.name} (${kb} KB)`)
      }
    }
    const hidden = listing.files.length
    if (!ALL_FILES) {
      const shown = listing.files.filter((f) => CHAIN_HINT.test(f.name)).length
      if (hidden > shown) {
        console.log(
          `${'  '.repeat(depth + 1)}(${hidden - shown} other file${hidden - shown === 1 ? '' : 's'})`,
        )
      }
    }
    if (depth < MAX_DEPTH) {
      for (const folder of listing.folders) {
        queue.push({ path: folder.path, depth: depth + 1 })
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
