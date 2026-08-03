/**
 * Records a ~100s narrated client demo of the flattened Upload → Review
 * story:
 *
 *   1. Upload with continuity — staged rows transform in place after
 *      Analyze; the three-step progress arc carries the user forward.
 *   2. Processing — glanceable progress strip + compact document rows.
 *   3. Document detail route — PDF with extraction boxes, inline value
 *      corrections with Corrected chips, Finalize, then line-item
 *      approval percentages saved on the same page.
 *
 * Anti-jump measures: exactly one hard page load (hidden under the intro
 * title card); every other navigation is an in-app link click so the
 * router transitions client-side. All scrolling is `behavior: smooth`.
 *
 * Run: npx tsx scripts/demo/record-flattened-walkthrough.ts
 */

import { mkdir, rename, stat } from 'node:fs/promises'
import { chromium } from 'playwright'
import type { Page } from 'playwright'

const BASE = 'http://localhost:3000'
const CLIENT = 'dawson-trails-md1'
const VERIFICATION = 'dawson-trails-md1-v1'
const UPLOAD = `${BASE}/upload?client=${CLIENT}&verification=${VERIFICATION}`
const PA_MARKER = 'PA-CLAS'
const UPLOAD_FILE = '/tmp/demo-docs/upload-scene/VO_Rusin_CO3_$20,290.26.pdf'
const SIZE = { width: 1440, height: 900 }
const OUT = 'demo-output/flattened-walkthrough.webm'

const CURSOR_INIT = `
  (() => {
    const ensure = () => {
      let el = document.getElementById('__demo_cursor')
      if (!el) {
        el = document.createElement('div')
        el.id = '__demo_cursor'
        el.style.cssText = [
          'position:fixed', 'z-index:2147483646', 'pointer-events:none',
          'width:22px', 'height:22px', 'border-radius:50%',
          'border:2.5px solid rgba(255,255,255,0.95)',
          'background:rgba(37,99,235,0.55)',
          'box-shadow:0 0 0 2px rgba(37,99,235,0.45), 0 2px 10px rgba(0,0,0,0.35)',
          'transform:translate(-50%,-50%)', 'top:-40px', 'left:-40px',
          'transition:width 80ms, height 80ms, background 80ms',
        ].join(';')
        document.body.appendChild(el)
      }
      return el
    }
    window.addEventListener('mousemove', (e) => {
      const el = ensure()
      el.style.left = e.clientX + 'px'
      el.style.top = e.clientY + 'px'
    }, true)
    window.addEventListener('mousedown', () => {
      const el = ensure()
      el.style.background = 'rgba(220,38,38,0.75)'
      el.style.width = '17px'
      el.style.height = '17px'
    }, true)
    window.addEventListener('mouseup', () => {
      const el = ensure()
      el.style.background = 'rgba(37,99,235,0.55)'
      el.style.width = '22px'
      el.style.height = '22px'
    }, true)
  })()
`

const DEVTOOLS_HIDE = `
  const style = document.createElement('style')
  style.textContent =
    '[id*="tanstack" i], [class*="tsqd" i], [id*="tsqd" i], [class*="TanStackRouterDevtools" i], [aria-label*="devtools" i] { display: none !important; }'
  document.addEventListener('DOMContentLoaded', () =>
    document.head.appendChild(style),
  )
`

async function caption(
  page: Page,
  text: string | null,
  opts?: { kicker?: string },
) {
  await page.evaluate(
    ({ text: body, kicker: kick }) => {
      let el = document.getElementById('__demo_caption')
      if (!body) {
        if (el) {
          el.style.opacity = '0'
          setTimeout(() => el?.remove(), 260)
        }
        return
      }
      if (!el) {
        el = document.createElement('div')
        el.id = '__demo_caption'
        el.style.cssText = [
          'position:fixed', 'z-index:2147483647', 'pointer-events:none',
          'left:50%', 'bottom:28px', 'transform:translateX(-50%)',
          'max-width:980px', 'width:calc(100% - 96px)',
          'background:rgba(15,23,42,0.94)', 'color:#f8fafc',
          'border:1px solid rgba(148,163,184,0.35)',
          'border-radius:14px', 'padding:16px 22px',
          'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
          'font-size:17px', 'line-height:1.45', 'letter-spacing:0.01em',
          'box-shadow:0 12px 40px rgba(0,0,0,0.45)',
          'transition:opacity 240ms ease', 'opacity:0',
        ].join(';')
        document.body.appendChild(el)
      }
      const kickerHtml = kick
        ? `<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#7dd3fc;margin-bottom:6px">${kick}</div>`
        : ''
      el.innerHTML = kickerHtml + `<div>${body}</div>`
      const mounted = el
      requestAnimationFrame(() => {
        mounted.style.opacity = '1'
      })
    },
    { text, kicker: opts?.kicker ?? null },
  )
}

async function titleCard(
  page: Page,
  content: { title: string; sub: string } | null,
) {
  await page.evaluate((card) => {
    let el = document.getElementById('__demo_title')
    if (!card) {
      if (el) {
        el.style.opacity = '0'
        setTimeout(() => el?.remove(), 470)
      }
      return
    }
    if (!el) {
      el = document.createElement('div')
      el.id = '__demo_title'
      el.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483647',
        'display:flex', 'flex-direction:column', 'align-items:center',
        'justify-content:center', 'gap:14px', 'text-align:center',
        'background:rgba(10,15,28,0.97)', 'color:#f8fafc',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'transition:opacity 450ms ease', 'opacity:0', 'padding:0 120px',
      ].join(';')
      document.body.appendChild(el)
    }
    el.innerHTML =
      `<div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.22em;color:#7dd3fc">SG DREAM · Schedio Group</div>` +
      `<div style="font-size:40px;font-weight:700;letter-spacing:-0.02em;max-width:900px">${card.title}</div>` +
      `<div style="font-size:18px;color:#cbd5e1;max-width:760px;line-height:1.5">${card.sub}</div>`
    const mounted = el
    requestAnimationFrame(() => {
      mounted.style.opacity = '1'
    })
  }, content)
}

async function pause(page: Page, ms: number) {
  await page.waitForTimeout(ms)
}

async function moveCursorTo(
  page: Page,
  locator: ReturnType<Page['locator']>,
  steps = 30,
) {
  const box = await locator.boundingBox()
  if (!box) return
  await page.mouse.move(
    box.x + box.width / 2,
    box.y + box.height / 2,
    { steps },
  )
}

/** Smooth-scroll an element to the vertical center of the viewport. */
async function smoothScrollTo(
  page: Page,
  locator: ReturnType<Page['locator']>,
  settle = 1100,
) {
  await locator.evaluate((el) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
  await pause(page, settle)
}

/**
 * DocuPipe needs a few minutes after extraction before a fresh review's
 * overlay fields are queryable ("still being generated"). Poll the featured
 * PA's detail page off-camera until the rail renders, so the recorded take
 * never stalls on it.
 */
async function warmupOverlay(browser: Awaited<ReturnType<typeof chromium.launch>>) {
  const context = await browser.newContext({ viewport: SIZE })
  const page = await context.newPage()
  await page.goto(
    `${BASE}/processing?client=${CLIENT}&verification=${VERIFICATION}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  )
  const row = page.locator('.queue-row-link', { hasText: PA_MARKER }).first()
  await row.waitFor({ timeout: 30000 })
  await row.click()
  await page.waitForURL(/\/document\?/, { timeout: 15000 })
  const deadline = Date.now() + 6 * 60 * 1000
  for (;;) {
    try {
      await page.locator('.ovl-field').first().waitFor({ timeout: 20000 })
      console.log('WARMUP: overlay ready')
      break
    } catch {
      if (Date.now() > deadline) {
        throw new Error('overlay never became ready during warmup')
      }
      console.log('WARMUP: overlay not ready, reloading…')
      await page.reload({ waitUntil: 'domcontentloaded' })
    }
  }
  await context.close()
}

async function main() {
  await mkdir('demo-output', { recursive: true })
  const browser = await chromium.launch({ headless: true })
  await warmupOverlay(browser)
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: 'demo-output', size: SIZE },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await page.addInitScript(CURSOR_INIT)
  await page.addInitScript(DEVTOOLS_HIDE)
  page.on('crash', () => console.error('PAGE CRASHED'))
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message))

  // ------------------------------------------------------------- intro (0:00)
  // The only hard page load in the recording, hidden under the title card.
  await page.goto(UPLOAD, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await titleCard(page, {
    title: 'One flow, upload to approval',
    sub: 'The intake pipeline is now a single story — drop a file, watch it process in place, and review everything about a document on one page.',
  })
  await page.getByText('Browse files').waitFor({ timeout: 45000 })
  await pause(page, 4600)
  await titleCard(page, null)
  await pause(page, 700)

  // ----------------------------------------- scene 1: upload continuity (0:05)
  await caption(
    page,
    'Every step of the submission lives on this arc — Upload, Review, File. No hunting for the next page.',
    { kicker: 'Step 1 · Upload' },
  )
  const arc = page.locator('.intake-arc').first()
  await moveCursorTo(page, arc, 34)
  await pause(page, 2800)

  await caption(
    page,
    'Drop a document into the draft — nothing is sent until you click Analyze.',
    { kicker: 'Step 1 · Upload' },
  )
  await page.setInputFiles('input[type="file"]', UPLOAD_FILE)
  const stagedRow = page.getByText('Staged — analysis pending').first()
  await stagedRow.waitFor({ timeout: 15000 })
  await smoothScrollTo(page, stagedRow)
  await pause(page, 1600)

  const analyze = page.getByRole('button', { name: /Analyze submission/ })
  await smoothScrollTo(page, analyze, 800)
  await moveCursorTo(page, analyze)
  await pause(page, 500)
  await caption(
    page,
    'One click starts extraction. The staged row transforms in place into a live processing row — you never leave the page.',
    { kicker: 'Step 1 · Upload' },
  )
  await analyze.click()

  const liveRow = page
    .locator('.queue-row-link', { hasText: 'VO_Rusin_CO3' })
    .first()
  await liveRow.waitFor({ timeout: 45000 })
  await smoothScrollTo(page, liveRow)
  await moveCursorTo(page, liveRow, 26)
  await caption(
    page,
    'Classification, data capture, and filing-name assignment run automatically — the row updates live as DocuPipe works.',
    { kicker: 'Step 1 · Live processing' },
  )
  await pause(page, 5200)
  await caption(page, null)
  await pause(page, 400)

  // -------------------------------------- scene 2: review via the arc (0:35)
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
  await pause(page, 1100)
  const reviewStep = page
    .locator('.intake-arc a.intake-arc-step', { hasText: 'Review' })
    .first()
  await moveCursorTo(page, reviewStep)
  await caption(
    page,
    'The arc is navigation too — step two takes you to the review queue.',
    { kicker: 'Step 2 · Review' },
  )
  await pause(page, 1400)
  await reviewStep.click()
  try {
    await page.waitForURL(/\/processing\?/, { timeout: 6000 })
  } catch {
    await reviewStep.click()
    await page.waitForURL(/\/processing\?/, { timeout: 15000 })
  }

  const strip = page.locator('.pstrip').first()
  await strip.waitFor({ timeout: 30000 })
  await caption(
    page,
    'Six pipeline checks condensed into one glanceable strip — expand it any time for the full log.',
    { kicker: 'Step 2 · Review' },
  )
  await moveCursorTo(page, strip, 26)
  await pause(page, 2400)
  await strip.click()
  await pause(page, 2600)
  await strip.click()
  await pause(page, 800)

  // --------------------------------- scene 3: document detail route (0:50)
  const paRow = page.locator('.queue-row-link', { hasText: PA_MARKER })
  await smoothScrollTo(page, paRow)
  await caption(
    page,
    'Each document is now one row — and one click opens everything about it.',
    { kicker: 'Step 3 · Document review' },
  )
  await moveCursorTo(page, paRow, 26)
  await pause(page, 1600)
  // Live snapshot polling can re-render the list mid-click (the row node is
  // swapped out), so confirm the navigation landed and retry once if not.
  await paRow.click()
  try {
    await page.waitForURL(/\/document\?/, { timeout: 6000 })
  } catch {
    await paRow.click()
    await page.waitForURL(/\/document\?/, { timeout: 15000 })
  }

  // The overlay data comes from a live DocuPipe fetch that can occasionally
  // stall or error; if the rail doesn't materialize, log the placeholder
  // state and reload once (React Query refetches on a fresh load).
  const railField = page.locator('.ovl-field').first()
  try {
    await railField.waitFor({ timeout: 45000 })
  } catch {
    const state = await page
      .locator('.ovl-state')
      .first()
      .textContent()
      .catch(() => null)
    console.error('overlay rail missing, state was:', state?.trim())
    await page.reload({ waitUntil: 'domcontentloaded' })
    await railField.waitFor({ timeout: 60000 })
  }
  await page.locator('.ovl-mark').first().waitFor({ timeout: 60000 })
  await caption(
    page,
    'The document detail page: the PDF with every extracted value boxed on the page it was read from, and the full field rail beside it.',
    { kicker: 'Step 3 · Document review' },
  )
  await pause(page, 3800)

  // Inline correction: edit the first *text* rail value (a numeric field
  // would trip validation instead of showing the Corrected chip), then
  // revert so the record stays exactly as extracted.
  const firstInput = page.locator('.ovl-field-input[inputmode="text"]').first()
  await firstInput.evaluate((el) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
  await pause(page, 900)
  await moveCursorTo(page, firstInput, 24)
  const original = await firstInput.inputValue()
  await caption(
    page,
    'Corrections happen inline — edit a value and it is marked Corrected until you finalize. Mistyped numbers are caught before they can save.',
    { kicker: 'Step 3 · Inline corrections' },
  )
  await firstInput.click()
  await firstInput.fill('')
  await firstInput.pressSequentially(`${original}X`, { delay: 90 })
  await page.locator('.pill', { hasText: 'Corrected' }).first().waitFor({
    timeout: 8000,
  })
  await pause(page, 2400)
  const revert = page.getByRole('button', { name: 'Revert value' }).first()
  await moveCursorTo(page, revert, 18)
  await revert.click()
  await pause(page, 1200)

  const finalize = page.getByRole('button', { name: /Finalize/ })
  await moveCursorTo(page, finalize, 24)
  await caption(
    page,
    'Finalize locks the reviewed values into the submission — one clear completion moment.',
    { kicker: 'Step 3 · Finalize' },
  )
  await pause(page, 900)
  await finalize.click()
  await page.getByText('Extraction finalized').waitFor({ timeout: 30000 })
  await pause(page, 2600)

  // ------------------------ scene 4: the extracted record explained (1:25)
  const waterfall = page.locator('.pa-waterfall').first()
  await smoothScrollTo(page, waterfall)
  await caption(
    page,
    'Below the viewer sits the extracted record — everything SG DREAM read from the document, as structured data.',
    { kicker: 'Step 4 · The extracted record' },
  )
  await pause(page, 3200)

  const mathPill = page.locator('.pill', { hasText: 'Math checks out' }).first()
  await moveCursorTo(page, mathPill, 26)
  await caption(
    page,
    'For pay applications, the full AIA G702 waterfall is rebuilt — contract sum, completed and stored, retainage, prior payments — and the current payment due is recomputed to confirm the math checks out.',
    { kicker: 'Step 4 · The extracted record' },
  )
  await pause(page, 5200)

  // ------------------------ scene 5: line items, column by column (1:40)
  const lineItems = page.locator('.line-items').first()
  await smoothScrollTo(page, lineItems)
  const meta = page.locator('.line-items-meta').first()
  await moveCursorTo(page, meta, 22)
  await caption(
    page,
    'Then the line items: every G703 continuation-sheet row on this pay app — all 196 of them — extracted as its own record.',
    { kicker: 'Step 5 · Line items' },
  )
  await pause(page, 3600)

  const expand = page.getByRole('button', { name: 'Expand' }).first()
  await moveCursorTo(page, expand, 20)
  await expand.click()
  const pctInputs = page.locator('.line-items-pct-input')
  await pctInputs.first().waitFor({ timeout: 15000 })
  // The expanded table extends past the fold — bring it fully into view
  // before narrating it, or the captions cover the header row.
  const itemsScroll = page.locator('.line-items-scroll').first()
  await smoothScrollTo(page, itemsScroll)
  await pause(page, 400)

  await caption(
    page,
    'Each row carries its scheduled value and % complete exactly as billed on the document. The two columns on the right belong to your reviewers.',
    { kicker: 'Step 5 · Line items' },
  )
  await itemsScroll.evaluate((el) => {
    el.scrollTo({ top: 520, behavior: 'smooth' })
  })
  await pause(page, 2400)
  await itemsScroll.evaluate((el) => {
    el.scrollTo({ top: 0, behavior: 'smooth' })
  })
  await pause(page, 1800)

  await caption(
    page,
    'Type an approval percentage into Applied % and the Approved amount computes live — the percentage of that row’s value you are approving for payment.',
    { kicker: 'Step 5 · Applying percentages' },
  )
  const values = ['100', '75', '50'] as const
  for (let i = 0; i < values.length; i += 1) {
    const input = pctInputs.nth(i)
    await moveCursorTo(page, input, 18)
    await input.click()
    await input.fill('')
    await input.pressSequentially(values[i], { delay: 110 })
    await pause(page, 700)
  }

  const footerTotals = page.locator('.line-items-footer-totals').first()
  await moveCursorTo(page, footerTotals, 22)
  await caption(
    page,
    'The footer keeps a running total — approved dollars against the scheduled total — so partial approvals stay honest.',
    { kicker: 'Step 5 · Applying percentages' },
  )
  await pause(page, 3400)

  const save = page.getByRole('button', { name: 'Save percentages' })
  await moveCursorTo(page, save, 22)
  await caption(
    page,
    'Save writes the sheet to the record and the audit trail — the summary line above now reads 3 approved.',
    { kicker: 'Step 5 · Applying percentages' },
  )
  await pause(page, 700)
  await save.click()
  await page.getByText('Percentages saved').waitFor({ timeout: 20000 })
  await moveCursorTo(page, meta, 20)
  await pause(page, 3000)
  await caption(page, null)
  await pause(page, 400)

  // --------------------------------------------- scene 6: back + outro (2:00)
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
  await pause(page, 1100)
  const back = page.getByRole('link', { name: /All documents/ }).first()
  await moveCursorTo(page, back, 24)
  await caption(
    page,
    'Back to the queue — the document now shows Verified, and the arc carries you on to filing.',
    { kicker: 'Wrap up' },
  )
  await pause(page, 1200)
  await back.click()
  await page.locator('.pstrip').first().waitFor({ timeout: 30000 })
  await pause(page, 2600)
  await caption(page, null)

  await titleCard(page, {
    title: 'Upload to approval — one page at a time.',
    sub: 'In-place processing, a single review surface per document, inline corrections, and line-item approvals. In SG DREAM today.',
  })
  await pause(page, 4400)

  await context.close()
  const video = page.video()
  const rawPath = video ? await video.path() : null
  await browser.close()

  if (!rawPath) throw new Error('Playwright did not produce a video file')
  await rename(rawPath, OUT)
  const info = await stat(OUT)
  console.log('VIDEO_SAVED:', OUT)
  console.log('VIDEO_BYTES:', info.size)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
