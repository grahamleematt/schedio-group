/**
 * Records a narrated client demo of the latest SG DREAM features:
 *
 *   1. Streamlined email-first sign-in (WorkOS loginHint, self-serve reset)
 *   2. In-app extraction overlay corrections — editable values + draggable /
 *      resizable bounding boxes persisted to the DocuPipe review
 *   3. Per-document "Re-run extraction (high effort)" escalation
 *
 * Drives a Chromium session against the local dev server (yarn dev, port
 * 3000), renders on-screen captions + a visible cursor so the client can
 * follow along, and saves a .webm video to demo-output/.
 *
 * Run: npx tsx scripts/demo/record-demo.ts
 */

import { chromium } from 'playwright'
import type { Page } from 'playwright'

const BASE = 'http://localhost:3000'
const VERIFICATION = 'dawson-trails-md1-v1'
const SIZE = { width: 1440, height: 900 }

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

/** Pulse a highlight ring around an element (by selector) for emphasis. */
async function spotlight(page: Page, selector: string, on: boolean) {
  await page.evaluate(
    ({ selector: sel, on: active }) => {
      const el = document.querySelector<HTMLElement>(sel)
      if (!el) return
      if (active) {
        el.style.outline = '3px solid #f59e0b'
        el.style.outlineOffset = '4px'
        el.style.borderRadius = '6px'
      } else {
        el.style.outline = ''
        el.style.outlineOffset = ''
      }
    },
    { selector, on },
  )
}

async function pause(page: Page, ms: number) {
  await page.waitForTimeout(ms)
}

async function glideTo(page: Page, x: number, y: number, steps = 28) {
  await page.mouse.move(x, y, { steps })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: 'demo-output', size: SIZE },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await page.addInitScript(CURSOR_INIT)
  // Keep the dev-only TanStack devtools badge out of the client recording.
  await page.addInitScript(`
    const style = document.createElement('style')
    style.textContent =
      '[id*="tanstack" i], [class*="tsqd" i], [id*="tsqd" i], [class*="TanStackRouterDevtools" i], [aria-label*="devtools" i] { display: none !important; }'
    document.addEventListener('DOMContentLoaded', () =>
      document.head.appendChild(style),
    )
  `)

  // ---------------------------------------------------------------- intro
  await page.goto(`${BASE}/login`)
  await page.locator('#login-email').waitFor({ timeout: 30000 })
  await titleCard(page, {
    title: 'What’s new in SG DREAM',
    sub: 'Three updates to the document pipeline: streamlined sign-in, hands-on extraction corrections, and a high-effort re-run for stubborn documents.',
  })
  await pause(page, 4600)
  await titleCard(page, null)
  await pause(page, 600)

  // ------------------------------------------------- scene 1: sign-in flow
  await caption(
    page,
    'Sign-in now starts with just your work email. It carries straight through to the secure WorkOS screen — sign in with your password or a one-time emailed code.',
    { kicker: 'Feature 1 of 3 · Streamlined sign-in' },
  )
  await pause(page, 4200)

  const email = page.locator('#login-email')
  const emailBox = await email.boundingBox()
  if (emailBox) {
    await glideTo(
      page,
      emailBox.x + emailBox.width / 2,
      emailBox.y + emailBox.height / 2,
    )
  }
  await email.click()
  await email.pressSequentially('tim@dawsontrails.org', { delay: 95 })
  await pause(page, 900)

  const continueBtn = page.getByRole('button', { name: /Continue/ })
  const cb = await continueBtn.boundingBox()
  if (cb) await glideTo(page, cb.x + cb.width / 2, cb.y + cb.height / 2)
  await pause(page, 700)

  await caption(
    page,
    'Forgot your password? Reset it yourself from the sign-in screen — or skip passwords entirely with the emailed one-time code. No admin ticket needed.',
    { kicker: 'Feature 1 of 3 · Streamlined sign-in' },
  )
  await spotlight(page, '.login-reset-head', true)
  await pause(page, 4600)
  await spotlight(page, '.login-reset-head', false)
  await caption(page, null)

  // --------------------------------------- scene 2: overlay + draggable box
  await page.goto(
    `${BASE}/processing?client=dawson-trails-md1&verification=${VERIFICATION}`,
  )
  await page
    .getByRole('button', { name: 'View extraction overlay' })
    .first()
    .waitFor({ timeout: 30000 })
  await pause(page, 800)

  await caption(
    page,
    'This is the processing view for a live submission. Every document DocuPipe has finished now offers an in-app extraction overlay.',
    { kicker: 'Feature 2 of 3 · Extraction review & corrections' },
  )
  await pause(page, 4000)

  const overlayBtn = page
    .getByRole('button', { name: 'View extraction overlay' })
    .first()
  await overlayBtn.scrollIntoViewIfNeeded()
  const ob = await overlayBtn.boundingBox()
  if (ob) await glideTo(page, ob.x + ob.width / 2, ob.y + ob.height / 2)
  await pause(page, 500)
  await overlayBtn.click()

  await page.locator('.ovl-mark').first().waitFor({ timeout: 30000 })
  await pause(page, 1200)

  await caption(
    page,
    'The document renders right here, and every extracted value is boxed at the exact spot it was read from. Click a field on the left to jump to it.',
    { kicker: 'Feature 2 of 3 · Extraction review & corrections' },
  )
  const firstField = page.locator('.ovl-field-jump').first()
  const ff = await firstField.boundingBox()
  if (ff) await glideTo(page, ff.x + ff.width / 2, ff.y + ff.height / 2)
  await firstField.click()
  await pause(page, 4200)

  // Correct a value inline.
  await caption(
    page,
    'Spot a wrong value? Fix it inline — the field is marked “Edited” and the correction is applied when you finalize.',
    { kicker: 'Feature 2 of 3 · Extraction review & corrections' },
  )
  const firstInput = page.locator('.ovl-field-input').first()
  const originalValue = await firstInput.inputValue()
  const fi = await firstInput.boundingBox()
  if (fi) await glideTo(page, fi.x + fi.width / 2, fi.y + fi.height / 2)
  await firstInput.click()
  await firstInput.fill('')
  await firstInput.pressSequentially(originalValue + ' (corrected)', {
    delay: 55,
  })
  await pause(page, 2600)
  // Restore so the demo leaves no pending edit behind.
  await firstInput.fill(originalValue)
  await pause(page, 700)

  // Drag the biggest visible box so the move reads clearly on video.
  await caption(
    page,
    'New: if a box was drawn in the wrong place, just drag it. Grab any box and move it to where the value actually appears on the page.',
    { kicker: 'Feature 2 of 3 · Extraction review & corrections' },
  )
  const targetBoxId: string | null = await page.evaluate(() => {
    const marks = Array.from(
      document.querySelectorAll<HTMLElement>('.ovl-mark'),
    )
    const scroller = document.querySelector('.ovl-scroll')
    const scrollerRect = scroller?.getBoundingClientRect()
    let best: HTMLElement | null = null
    let bestArea = 0
    for (const m of marks) {
      const r = m.getBoundingClientRect()
      if (
        scrollerRect &&
        (r.top < scrollerRect.top || r.bottom > scrollerRect.bottom)
      ) {
        continue
      }
      const area = r.width * r.height
      if (area > bestArea) {
        bestArea = area
        best = m
      }
    }
    return best?.id ?? null
  })
  if (!targetBoxId) throw new Error('No visible overlay box found to drag')
  const box = page.locator(`#${targetBoxId}`)
  const bb = await box.boundingBox()
  if (!bb) throw new Error('Overlay box has no bounding box')

  const startX = bb.x + bb.width / 2
  const startY = bb.y + bb.height / 2
  await glideTo(page, startX, startY)
  await pause(page, 600)
  await page.mouse.down()
  await page.mouse.move(startX + 130, startY + 60, { steps: 45 })
  await pause(page, 350)
  await page.mouse.up()
  await pause(page, 1400)

  await caption(
    page,
    'The field is flagged “Box moved”, and the footer shows the pending correction. Finalizing writes the corrected position back to the DocuPipe review — the audit trail keeps both.',
    { kicker: 'Feature 2 of 3 · Extraction review & corrections' },
  )
  const movedPill = page.getByText('Box moved').first()
  await movedPill.waitFor({ timeout: 5000 })
  await pause(page, 4800)

  await caption(
    page,
    'Changed your mind? “Reset box position” snaps it back to DocuPipe’s original placement instantly.',
    { kicker: 'Feature 2 of 3 · Extraction review & corrections' },
  )
  const resetBtn = page.getByRole('button', { name: 'Reset box position' })
  await resetBtn.scrollIntoViewIfNeeded()
  const rb = await resetBtn.boundingBox()
  if (rb) await glideTo(page, rb.x + rb.width / 2, rb.y + rb.height / 2)
  await pause(page, 800)
  await resetBtn.click()
  await pause(page, 2600)

  await caption(
    page,
    'When everything checks out, “Finalize extraction” locks it in — corrected values flow into costs submitted and the confirmation gate automatically.',
    { kicker: 'Feature 2 of 3 · Extraction review & corrections' },
  )
  await spotlight(page, '.ovl-button-primary', true)
  await pause(page, 4200)
  await spotlight(page, '.ovl-button-primary', false)
  await caption(page, null)
  await page.keyboard.press('Escape')
  await pause(page, 900)

  // ----------------------------------------- scene 3: high-effort re-run
  await caption(
    page,
    'Last one: when a document classifies poorly or extraction looks thin, you can escalate just that file.',
    { kicker: 'Feature 3 of 3 · High-effort re-run' },
  )
  const rerunBtn = page
    .locator('button.qlink', { hasText: /high effort/ })
    .first()
  await rerunBtn.scrollIntoViewIfNeeded()
  await pause(page, 2600)

  const rr = await rerunBtn.boundingBox()
  if (rr) await glideTo(page, rr.x + rr.width / 2, rr.y + rr.height / 2)
  await rerunBtn.evaluate((el) => {
    el.style.outline = '3px solid #f59e0b'
    el.style.outlineOffset = '4px'
    el.style.borderRadius = '6px'
  })
  await caption(
    page,
    '“Re-run extraction (high effort)” sends that one document back through DocuPipe’s V3 engine at maximum effort. Unclassified documents are re-classified first, then extracted — results stream back into this view automatically.',
    { kicker: 'Feature 3 of 3 · High-effort re-run' },
  )
  await pause(page, 5600)
  await rerunBtn.evaluate((el) => {
    el.style.outline = ''
    el.style.outlineOffset = ''
  })
  await caption(page, null)

  // ---------------------------------------------------------------- outro
  await titleCard(page, {
    title: 'That’s the tour',
    sub: 'Streamlined sign-in · hands-on extraction corrections with draggable boxes · per-document high-effort re-runs. All live in SG DREAM today.',
  })
  await pause(page, 4600)

  await context.close()
  const video = page.video()
  const path = video ? await video.path() : null
  await browser.close()
  console.log('VIDEO_SAVED:', path)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
