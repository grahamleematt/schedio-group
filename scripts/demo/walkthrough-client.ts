/**
 * Scripted walkthrough of the client-role experience against a dev server
 * running with SG_DREAM_AUTH_BYPASS_ROLE=client_viewer: simplified dashboard
 * and processing views, read-only extraction detail, and the client-side
 * finalize flow (reopen denied after the cutoff).
 *
 * Run: yarn tsx scripts/demo/walkthrough-client.ts [baseUrl]
 * Screenshots land in /tmp/sgdream-walkthrough/.
 */

import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:3200'
const OUT = '/tmp/sgdream-walkthrough'
const CLIENT = 'dawson-trails-md1'

let failures = 0
function check(ok: boolean, label: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) failures += 1
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const shot = async (name: string) => {
    await page.screenshot({ path: `${OUT}/${name}.png` })
    console.log(`  · screenshot ${name}`)
  }

  // 1. Simplified client dashboard: no internal-only sections.
  await page.goto(`${BASE}/dashboard?client=${CLIENT}`)
  await page.getByText('Entity dashboard').waitFor({ timeout: 30000 })
  check(
    (await page.getByText('Authorization value').count()) === 0,
    'client dashboard hides Authorization value',
  )
  check(
    (await page.getByText('Contract tracking', { exact: true }).count()) === 0,
    'client dashboard hides Contract tracking section',
  )
  const finalizeBtn = page.getByRole('button', { name: /Finalize Verification/ })
  check(await finalizeBtn.isVisible(), 'client sees the finalize CTA')
  await shot('06-client-dashboard')

  // 1b. The contracts page is internal-only: clients get bounced back.
  await page.goto(`${BASE}/contracts?client=${CLIENT}`)
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  check(true, 'contracts route redirects clients to the dashboard')

  // 2. Simplified processing view: one progress card, no pipeline stages.
  await page.goto(`${BASE}/processing?client=${CLIENT}`)
  await page
    .getByText(/documents? checked|Checking your documents/)
    .first()
    .waitFor({ timeout: 30000 })
  check(true, 'client processing shows the simple progress card')
  check(
    (await page.getByText('Duplicate detection', { exact: true }).count()) ===
      0,
    'client processing hides pipeline stage internals',
  )
  await shot('07-client-processing')

  // 3. Read-only extraction detail in the library.
  await page.goto(
    `${BASE}/library?client=${CLIENT}&verification=dawson-trails-md1-v1`,
  )
  await page.getByText('Pay Applications').first().waitFor({ timeout: 30000 })
  await page.getByText('Pay Applications').first().click()
  await page.waitForTimeout(800)
  check(
    (await page.getByRole('button', { name: /Save applied/i }).count()) === 0,
    'client library has no Applied % save control',
  )
  await shot('08-client-library-readonly')

  // 4. Client finalizes → locked, and reopen is denied past the cutoff.
  await page.goto(`${BASE}/dashboard?client=${CLIENT}`)
  await finalizeBtn.waitFor({ timeout: 30000 })
  await finalizeBtn.click()
  await page
    .getByText(/finalized — locked for Schedio review/)
    .waitFor({ timeout: 15000 })
  check(true, 'client finalize locked the submission')
  const reopenHidden =
    (await page.getByRole('button', { name: 'Reopen submission' }).count()) ===
    0
  check(reopenHidden, 'reopen hidden for client after the cutoff')
  check(
    (await page.getByText(/cutoff has passed — contact Schedio/).count()) > 0,
    'locked banner tells the client to contact Schedio',
  )
  await shot('09-client-locked-no-reopen')

  await browser.close()
  if (failures > 0) {
    console.error(`DONE with ${failures} failure(s)`)
    process.exit(1)
  }
  console.log('DONE — all client-role checks passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
