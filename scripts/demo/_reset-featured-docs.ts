/**
 * Pre-record reset: drop the documents the walkthrough mutates (the featured
 * Classic pay app, which gets finalized + percentages saved, and the CO3
 * uploaded live on camera) so the next take starts clean.
 *
 * Run: npx tsx --env-file=.env.local scripts/demo/_reset-featured-docs.ts
 *   --co3-only   only delete the live-upload CO3 (keep the extracted pay app,
 *                e.g. when a take failed before touching it)
 */

import { getStore } from '#/server/store'

const VERIFICATION = 'dawson-trails-md1-v1'

async function main() {
  const co3Only = process.argv.includes('--co3-only')
  const store = getStore()
  const snapshot = await store.getSnapshot(VERIFICATION)
  const docs = snapshot?.verification.documents ?? []
  const targets = docs.filter(
    (d) =>
      d.originalName.includes('VO_Rusin_CO3') ||
      (!co3Only && d.originalName.includes('VI_Classic_Pay App')),
  )
  for (const t of targets) {
    const removed = await store.deleteDocument(t.id)
    console.log(
      `deleted ${t.id} (${t.originalName}): ${removed ? 'ok' : 'miss'}`,
    )
  }
  if (targets.length === 0) console.log('nothing to delete')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
