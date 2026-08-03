/**
 * One-off status poll for the demo verification — prints each document's
 * status, type, and line-item count until everything is completed.
 *
 * Run: npx tsx --env-file=.env.local scripts/demo/_poll-status.ts
 */

import { getStore } from '#/server/store'

const VERIFICATION = 'dawson-trails-md1-v1'

async function main() {
  const store = getStore()
  const snapshot = await store.getSnapshot(VERIFICATION)
  const docs = snapshot?.verification.documents ?? []
  let done = 0
  for (const d of docs) {
    const items = d.extractedFields?.lineItems?.length ?? 0
    if (d.status === 'completed' || d.status === 'error') done += 1
    console.log(
      `${d.status.padEnd(14)} ${d.docType.padEnd(4)} items=${String(items).padEnd(4)} review=${d.docupipeReviewId ? 'y' : 'n'} ${d.renamedName ?? d.originalName}`,
    )
  }
  console.log(`SETTLED ${done}/${docs.length}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
