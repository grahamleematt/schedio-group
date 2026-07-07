/**
 * Read-only sanity check for the extraction overlay data path: finds stored
 * documents that have a DocuPipe review ID, fetches one review, and prints the
 * flattened overlay fields (page + bounding box per value). Run with:
 *
 *   yarn tsx --env-file=.env.local scripts/docupipe/inspect-review.ts [reviewId]
 */

import { flattenReviewData, getReview } from '#/server/docupipe'
import { getStore } from '#/server/store'
import { listVerificationConfigs } from '#/server/portalConfig'

async function findReviewIds(): Promise<
  Array<{ reviewId: string; name: string; verificationId: string }>
> {
  const out: Array<{
    reviewId: string
    name: string
    verificationId: string
  }> = []
  const verifications = await listVerificationConfigs()
  for (const v of verifications) {
    const snapshot = await getStore().getSnapshot(v.id)
    for (const doc of snapshot?.verification.documents ?? []) {
      if (doc.docupipeReviewId) {
        out.push({
          reviewId: doc.docupipeReviewId,
          name: doc.renamedName ?? doc.originalName,
          verificationId: v.id,
        })
      }
    }
  }
  return out
}

async function main() {
  let reviewId = process.argv[2]
  if (!reviewId) {
    const candidates = await findReviewIds()
    console.log(`found ${candidates.length} documents with reviews`)
    for (const c of candidates.slice(0, 10)) {
      console.log(`  ${c.reviewId}  ${c.name}  (${c.verificationId})`)
    }
    if (candidates.length === 0) return
    reviewId = candidates[0].reviewId
  }

  console.log(`\nfetching review ${reviewId} …`)
  const review = await getReview(reviewId)
  if (!review) {
    console.log('review not found / not ready')
    return
  }
  console.log(
    `reviewState=${review.reviewState} documentId=${review.documentId}`,
  )
  console.log('\nraw data (first 2000 chars):')
  console.log(JSON.stringify(review.data).slice(0, 2000))

  const fields = flattenReviewData(review.data)
  console.log(`\nflattened ${fields.length} fields:`)
  for (const f of fields) {
    const rect = f.rect
      ? `[${f.rect.x.toFixed(3)},${f.rect.y.toFixed(3)} ${f.rect.width.toFixed(3)}x${f.rect.height.toFixed(3)}]`
      : 'no-box'
    console.log(
      `  p${f.page ?? '-'} ${rect} conf=${String(f.confidence ?? '-')} ${f.path} = ${String(f.value).slice(0, 40)}`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
