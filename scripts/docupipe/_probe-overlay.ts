/**
 * Read-only probe: run the extraction-overlay flattening against live
 * DocuPipe reviews to see exactly what the /document overlay query returns.
 *
 * Run: yarn tsx scripts/docupipe/_probe-overlay.ts <reviewId> [...]
 */

import { flattenReviewData, getReview } from '#/server/docupipe'

async function main() {
  const ids = process.argv.slice(2)
  if (ids.length === 0) throw new Error('pass review IDs')
  for (const id of ids) {
    console.log(`== review ${id} ==`)
    try {
      const review = await getReview(id)
      if (!review) {
        console.log('getReview returned null')
        continue
      }
      const fields = flattenReviewData(review.data)
      const localized = fields.filter((f) => f.page && f.rect)
      console.log(
        `reviewState=${review.reviewState ?? '-'} fields=${fields.length} localized=${localized.length}`,
      )
      console.log(
        'sample:',
        fields.slice(0, 3).map((f) => `${f.path}=${String(f.value)}`),
      )
    } catch (err) {
      console.log('ERROR:', err instanceof Error ? err.message : err)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
