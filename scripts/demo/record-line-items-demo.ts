/**
 * Records a narrated client demo of the latest SG DREAM features:
 *
 *   1. Line-item extraction on invoices & pay applications (G703 rows)
 *   2. Per-row approval percentages with live approved-amount math + save
 *   3. Admin user management (entity-access multi-select + pending invites)
 *
 * Drives a Chromium session against the local dev server (yarn dev, port
 * 3000), renders on-screen captions + a visible cursor so the client can
 * follow along, and saves a .webm video to demo-output/line-items-demo.webm.
 *
 * Run: npx tsx scripts/demo/record-line-items-demo.ts
 */

import { mkdir, rename, stat } from 'node:fs/promises'
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'

const BASE = 'http://localhost:3000'
const CLIENT = 'dawson-trails-md1'
const PROCESSING = `${BASE}/processing?client=${CLIENT}`
const USERS = `${BASE}/users?client=${CLIENT}`
const PA_MARKER = 'SG-DT1-V001-PA-CLAS-2026-007'
const SIZE = { width: 1440, height: 900 }
const OUT = 'demo-output/line-items-demo.webm'

/** Inject (or move) the fake cursor dot that mirrors Playwright's mouse. */
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

/** Show/update the bottom caption banner. Pass null to hide it. */
async function caption(
  page: Page,
  text: string | null,
  opts?: { kicker?: string },
) {
  await page.evaluate(
    ({ text: body, kicker: kick }) => {
      let el = document.getElementById('__demo_caption')
      if (!body) {
        el?.remove()
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
          'transition:opacity 220ms ease', 'opacity:0',
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

/** Full-screen intro/outro card. Pass null to dismiss. */
async function titleCard(
  page: Page,
  content: { title: string; sub: string } | null,
) {
  await page.evaluate((card) => {
    let el = document.getElementById('__demo_title')
    if (!card) {
      if (el) {
        el.style.opacity = '0'
        setTimeout(() => el?.remove(), 450)
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
        'background:rgba(10,15,28,0.96)', 'color:#f8fafc',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'transition:opacity 420ms ease', 'opacity:0', 'padding:0 120px',
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

async function glideTo(page: Page, x: number, y: number, steps = 28) {
  await page.mouse.move(x, y, { steps })
}

async function moveCursorTo(
  page: Page,
  locator: ReturnType<Page['locator']>,
  steps = 28,
) {
  const box = await locator.boundingBox()
  if (!box) return
  await glideTo(page, box.x + box.width / 2, box.y + box.height / 2, steps)
}

function paCard(page: Page) {
  return page.locator('.queue-row', { hasText: PA_MARKER })
}

async function waitForProcessing(page: Page) {
  await page.goto(PROCESSING, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await paCard(page).waitFor({ timeout: 45000 })
}

async function waitForUsers(page: Page) {
  await page.goto(USERS, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.getByRole('heading', { name: 'Users & access' }).waitFor({
    timeout: 45000,
  })
  await page.getByRole('heading', { name: 'Add a user' }).waitFor({
    timeout: 15000,
  })
}

/**
 * Clear any saved applied % on rows 1–3 of the featured PA so the demo
 * starts clean. Uses a non-recorded browser context.
 */
async function resetPercentages(browser: Browser) {
  const context = await browser.newContext({ viewport: SIZE })
  const page = await context.newPage()
  await waitForProcessing(page)

  const card = paCard(page)
  await card.scrollIntoViewIfNeeded()
  await pause(page, 400)

  const meta = card.locator('.line-items-meta')
  const metaText = (await meta.textContent()) ?? ''
  if (/0 with applied %/.test(metaText)) {
    console.log('RESET: already clean (0 with applied %)')
    await context.close()
    return
  }

  const expand = card.getByRole('button', { name: 'Expand' })
  await expand.click()
  await card.locator('.line-items-pct-input').first().waitFor({ timeout: 10000 })

  const inputs = card.locator('.line-items-pct-input')
  for (let i = 0; i < 3; i += 1) {
    const input = inputs.nth(i)
    await input.fill('')
  }

  const save = card.getByRole('button', { name: 'Save percentages' })
  await save.click()
  await card.getByText('Percentages saved').waitFor({ timeout: 15000 })
  await card.getByText('0 with applied %').waitFor({ timeout: 15000 })
  console.log('RESET: cleared rows 1–3 → 0 with applied %')
  await context.close()
}

async function main() {
  await mkdir('demo-output', { recursive: true })

  const browser = await chromium.launch({ headless: true })

  // Pre-recording reset — not captured on video.
  await resetPercentages(browser)

  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: 'demo-output', size: SIZE },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await page.addInitScript(CURSOR_INIT)
  // Keep the dev-only TanStack devtools badge out of the client recording.
  await page.addInitScript(DEVTOOLS_HIDE)

  // ---------------------------------------------------------------- intro
  await waitForProcessing(page)
  await titleCard(page, {
    title: 'What’s new in SG DREAM',
    sub: 'Line-item extraction with per-row approval percentages — plus admin user management.',
  })
  await pause(page, 4200)
  await titleCard(page, null)
  await pause(page, 500)

  // -------------------------------- scene 1: introduce extraction + PA card
  await caption(
    page,
    'Invoices and pay applications now extract every line — task-order rows on invoices, and all G703 continuation-sheet rows on pay apps.',
    { kicker: 'Feature 1 of 2 · Line-item extraction' },
  )
  await pause(page, 2800)

  const card = paCard(page)
  await card.scrollIntoViewIfNeeded()
  await pause(page, 900)

  const summary = card.locator('.line-items-summary')
  await moveCursorTo(page, summary, 36)
  await pause(page, 3200)

  // -------------------------------- scene 2: expand table + scroll
  await caption(
    page,
    'Expand to review every row — scheduled value, % complete, and more. This Classic SRJ pay app has all 196 G703 rows.',
    { kicker: 'Feature 1 of 2 · Line-item extraction' },
  )
  await pause(page, 1800)

  const expandBtn = card.getByRole('button', { name: 'Expand' })
  await moveCursorTo(page, expandBtn)
  await pause(page, 450)
  await expandBtn.click()

  const scroll = card.locator('.line-items-scroll')
  await scroll.waitFor({ timeout: 10000 })
  await pause(page, 1400)

  await scroll.evaluate((el) => {
    el.scrollTo({ top: 520, behavior: 'smooth' })
  })
  await pause(page, 1800)
  await scroll.evaluate((el) => {
    el.scrollTo({ top: 0, behavior: 'smooth' })
  })
  await pause(page, 1600)

  // --------------------- scene 3: type applied % on rows 1–3
  await caption(
    page,
    'The team applies an approval percentage to each row. Approved amounts compute live as you type.',
    { kicker: 'Feature 1 of 2 · Per-row approval %' },
  )
  await pause(page, 2200)

  const values = ['100', '75', '50'] as const
  for (let i = 0; i < values.length; i += 1) {
    const input = card.locator('.line-items-pct-input').nth(i)
    await moveCursorTo(page, input, 22)
    await input.click()
    await input.fill('')
    await input.pressSequentially(values[i], { delay: 110 })
    await pause(page, 900)
  }

  // Let viewers see the Approved amount column + footer total.
  const footer = card.locator('.line-items-footer-totals')
  await moveCursorTo(page, footer, 24)
  await pause(page, 2800)

  // --------------------- scene 4: save percentages
  await caption(
    page,
    'One click saves the percentages to the document and logs it in the audit trail.',
    { kicker: 'Feature 1 of 2 · Per-row approval %' },
  )
  await pause(page, 1600)

  const saveBtn = card.getByRole('button', { name: 'Save percentages' })
  await moveCursorTo(page, saveBtn)
  await pause(page, 500)
  await saveBtn.click()
  await card.getByText('Percentages saved').waitFor({ timeout: 15000 })
  await card.getByText('3 with applied %').waitFor({ timeout: 10000 })
  await pause(page, 2800)
  await caption(page, null)

  // --------------------- scene 5: admin user management
  await caption(
    page,
    'Also new: admin user management — invite teammates and control which entities they can see.',
    { kicker: 'Feature 2 of 2 · Users & access' },
  )
  await pause(page, 2200)

  await waitForUsers(page)
  await pause(page, 1000)

  await caption(
    page,
    'Add a user in one step: name, email, and entity access. The multi-select grants only the entities you choose.',
    { kicker: 'Feature 2 of 2 · Users & access' },
  )
  await pause(page, 2000)

  const entityTrigger = page.locator('[aria-labelledby="entity-access-label"]')
  await moveCursorTo(page, entityTrigger)
  await pause(page, 400)
  await entityTrigger.click()

  const menuItems = page.locator('[role="menuitemcheckbox"]')
  await menuItems.first().waitFor({ timeout: 8000 })
  await pause(page, 1600)

  // Uncheck the second entity so the trigger label updates (All entities → 1 entity).
  const second = menuItems.nth(1)
  await moveCursorTo(page, second, 20)
  await pause(page, 400)
  await second.click()
  await pause(page, 1400)

  // Close the dropdown (Escape) so the updated trigger label is visible.
  await page.keyboard.press('Escape')
  await pause(page, 700)
  await moveCursorTo(page, entityTrigger, 18)
  await pause(page, 2000)

  await caption(
    page,
    'Pending invitations stay visible until they’re accepted — revoke anytime without touching the form.',
    { kicker: 'Feature 2 of 2 · Users & access' },
  )
  const pending = page.getByRole('heading', { name: /Pending invitations/ })
  await pending.scrollIntoViewIfNeeded()
  await moveCursorTo(page, pending, 24)
  await pause(page, 3200)
  await caption(page, null)

  // ---------------------------------------------------------------- outro
  await titleCard(page, {
    title: 'Line-item extraction + per-row approval percentages — live now.',
    sub: 'Plus admin user management for entity-scoped access. All in SG DREAM today.',
  })
  await pause(page, 4200)

  await context.close()
  const video = page.video()
  const rawPath = video ? await video.path() : null
  await browser.close()

  if (!rawPath) {
    throw new Error('Playwright did not produce a video file')
  }
  await rename(rawPath, OUT)
  const info = await stat(OUT)
  console.log('VIDEO_SAVED:', OUT)
  console.log('VIDEO_BYTES:', info.size)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
