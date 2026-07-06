/**
 * Backfill standardized filing names onto documents that entered SG DREAM
 * before the DocuPipe rename step ran (the seeded / Egnyte-imported demo set,
 * whose `renamedName` is still the messy original upload name).
 *
 * The standardized name is a DocuPipe-driven artifact: the variable segments
 * come from the classifier (`docType`) and extraction (`extractedFields.
 * vendorName`), combined with SG submission context (entity / verification /
 * year) and an SG-assigned `seq`. This script mints it through the *same*
 * production helper the webhook uses — `planFiling` → `nextDocSeqForVerification`
 * + `renamed()` — so the demo data matches exactly what a live extraction would
 * have produced.
 *
 * Honest by construction:
 *   - Skips documents DocuPipe hasn't classified (docType `UNK`).
 *   - Skips documents with no extracted vendor (never invents one).
 *   - Idempotent: rows that already carry a standardized name are left alone.
 *
 * Writes only `renamedName`. Run:
 *   yarn tsx --env-file=.env.local scripts/intake/backfill-renames.ts
 */
import { getDatabasePool } from '../../src/server/database'
import { planFiling } from '../../src/server/intake/filing'
import { listVerificationConfigs } from '../../src/server/portalConfig'
import { getStore } from '../../src/server/store'

/** SG DREAM filing-name shape: SG-<entity>-V<NNN>-<type>-<vendor>-<year>-<seq>.<ext> */
const SG_NAME = /^SG-[^-]+-V\d+-[^-]+-[^-]+-\d{4}-\d+\.[A-Za-z0-9]+$/

async function main() {
  const store = getStore()
  await store.init()

  let named = 0
  let skippedAlready = 0
  let skippedNoType = 0
  let skippedNoVendor = 0
  let skippedNoPlan = 0

  const verifications = await listVerificationConfigs()
  for (const v of verifications) {
    const snapshot = await store.getSnapshot(v.id)
    if (!snapshot) continue

    for (const doc of snapshot.verification.documents) {
      if (doc.renamedName && SG_NAME.test(doc.renamedName)) {
        skippedAlready++
        continue
      }
      if (doc.docType === 'UNK') {
        skippedNoType++
        console.log(`skip — not classified yet: ${doc.originalName}`)
        continue
      }
      const vendorName = doc.extractedFields?.vendorName
      if (!vendorName) {
        skippedNoVendor++
        console.log(`skip — no extracted vendor: ${doc.originalName}`)
        continue
      }

      const plan = await planFiling({
        stored: doc,
        docType: doc.docType,
        vendorName,
      })
      if (!plan.renamedName) {
        skippedNoPlan++
        console.log(
          `skip — could not plan (${plan.errorMessage ?? 'unknown'}): ${doc.originalName}`,
        )
        continue
      }

      await store.patchDocument(doc.id, { renamedName: plan.renamedName })
      named++
      console.log(`${doc.originalName}\n   → ${plan.renamedName}`)
    }
  }

  console.log('\n────────── backfill summary ──────────')
  console.log(`named:                       ${named}`)
  console.log(`already standardized:        ${skippedAlready}`)
  console.log(`skipped (not classified):    ${skippedNoType}`)
  console.log(`skipped (no extracted vendor): ${skippedNoVendor}`)
  console.log(`skipped (could not plan):    ${skippedNoPlan}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    const pool = await getDatabasePool()
    await pool.end()
  })
