/**
 * Scripted walkthrough of the submission finalize / lock / reopen flow
 * against a dev server running in degraded seeded mode (no WorkOS, no
 * database — the JSON store carries the lock via document custody).
 *
 * Run: yarn tsx scripts/demo/walkthrough-finalize.ts [baseUrl]
 * Screenshots land in /tmp/sgdream-walkthrough/.
 */

import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:3100'
const OUT = '/tmp/sgdream-walkthrough'
const CLIENT = 'dawson-trails-md1'

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })

  const shot = async (name: string) => {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
    console.log(`  · screenshot ${name}`)
  }

  // 1. Dashboard shows the finalize CTA for a draft submission.
  await page.goto(`${BASE}/dashboard?client=${CLIENT}`)
  await page.getByText('Entity dashboard').waitFor({ timeout: 30000 })
  const finalizeBtn = page.getByRole('button', { name: /Finalize Verification/ })
  await finalizeBtn.waitFor({ timeout: 15000 }).catch(() => fail('finalize CTA not visible on dashboard'))
  console.log('✓ dashboard shows finalize CTA')
  await shot('01-dashboard-finalize-cta')

  // 2. Finalize → locked banner + reopen control.
  await finalizeBtn.click()
  await page
    .getByText(/finalized — locked for Schedio review/)
    .waitFor({ timeout: 15000 })
  console.log('✓ finalize locked the submission')
  await shot('02-dashboard-locked')

  // Scoped to the header CTA (`.v2-btn`) — the sidebar nav item with the
  // same label stays visible by design.
  const submitDocsHidden =
    (await page.locator('a.v2-btn', { hasText: 'Submit documents' }).count()) ===
    0
  console.log(
    submitDocsHidden
      ? '✓ Submit documents CTA hidden while locked'
      : '✗ Submit documents CTA still visible while locked',
  )
  if (!submitDocsHidden) process.exitCode = 1

  // 3. Upload API rejects new documents with 409.
  const uploadStatus = await page.evaluate(async (base: string) => {
    const form = new FormData()
    form.set('verificationId', 'dawson-trails-md1-v1')
    form.set('clientId', 'dawson-trails-md1')
    form.append('files', new Blob([new Uint8Array([37, 80, 68, 70])]), 'x.pdf')
    const res = await fetch(`${base}/api/uploads`, {
      method: 'POST',
      body: form,
    })
    return { status: res.status, body: await res.text() }
  }, BASE)
  if (uploadStatus.status !== 409) {
    fail(
      `upload while locked returned ${uploadStatus.status} (${uploadStatus.body.slice(0, 200)}) — expected 409`,
    )
  }
  console.log('✓ upload API returns 409 while locked')

  // 4. Locked banners on submissions + library; delete controls hidden.
  await page.goto(`${BASE}/verifications?client=${CLIENT}`)
  await page
    .getByText(/finalized — locked for Schedio review/)
    .waitFor({ timeout: 15000 })
  console.log('✓ submissions page shows locked banner')
  await shot('03-verifications-locked')

  await page.goto(
    `${BASE}/library?client=${CLIENT}&verification=dawson-trails-md1-v1`,
  )
  await page
    .getByText(/finalized — locked for Schedio review/)
    .waitFor({ timeout: 15000 })
  const dangerZoneHidden = !(await page
    .getByText('Danger zone')
    .isVisible()
    .catch(() => false))
  const rowDeleteHidden =
    (await page.getByRole('button', { name: /^Remove / }).count()) === 0
  console.log(
    dangerZoneHidden
      ? '✓ library danger zone hidden while locked'
      : '✗ library danger zone still visible while locked',
  )
  console.log(
    rowDeleteHidden
      ? '✓ library row delete controls hidden while locked'
      : '✗ library row delete controls still visible while locked',
  )
  if (!dangerZoneHidden || !rowDeleteHidden) process.exitCode = 1
  await shot('04-library-locked')

  // 5. Reopen → back to a draft submission.
  await page.goto(`${BASE}/dashboard?client=${CLIENT}`)
  const reopenBtn = page.getByRole('button', { name: 'Reopen submission' })
  await reopenBtn.waitFor({ timeout: 15000 }).catch(() => fail('reopen control not visible'))
  await reopenBtn.click()
  await page
    .getByRole('button', { name: /Finalize Verification/ })
    .waitFor({ timeout: 15000 })
  console.log('✓ reopen restored the draft submission')
  await shot('05-dashboard-reopened')

  await browser.close()
  console.log(
    process.exitCode === 1 ? 'DONE with failures' : 'DONE — all checks passed',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
