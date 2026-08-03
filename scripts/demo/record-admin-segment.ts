/**
 * Records ONLY the Users & access scene, designed to splice onto the end of
 * the flattened walkthrough without re-recording it.
 *
 * Seam strategy: the main video is cut on the processing page while the
 * "Back to the queue…" caption is fully visible. This clip opens on that
 * exact same frame (same page, same caption), so the concat point is
 * invisible. It then walks the admin surface and ends with the outro title
 * card (which the cut removed from the main video).
 *
 * Prints SEAM_MS — the clip time at which the seam caption is fully shown —
 * so the assembler knows where to trim the clip's cold-load lead-in.
 *
 * Run: npx tsx scripts/demo/record-admin-segment.ts
 */

import { mkdir, rename, stat } from 'node:fs/promises'
import { chromium } from 'playwright'
import type { Page } from 'playwright'

const BASE = 'http://localhost:3000'
const CLIENT = 'dawson-trails-md1'
const VERIFICATION = 'dawson-trails-md1-v1'
const PROCESSING = `${BASE}/processing?client=${CLIENT}&verification=${VERIFICATION}`
const SIZE = { width: 1440, height: 900 }
const OUT = 'demo-output/admin-segment.webm'

const SEAM_CAPTION =
  'Back to the queue — the document now shows Verified, and the arc carries you on to filing.'

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
  opts?: { kicker?: string; instant?: boolean },
) {
  await page.evaluate(
    ({ text: body, kicker: kick, instant }) => {
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
      if (instant) {
        mounted.style.transition = 'none'
        mounted.style.opacity = '1'
        requestAnimationFrame(() => {
          mounted.style.transition = 'opacity 240ms ease'
        })
      } else {
        requestAnimationFrame(() => {
          mounted.style.opacity = '1'
        })
      }
    },
    { text, kicker: opts?.kicker ?? null, instant: opts?.instant ?? false },
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

async function main() {
  await mkdir('demo-output', { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: 'demo-output', size: SIZE },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await page.addInitScript(CURSOR_INIT)
  await page.addInitScript(DEVTOOLS_HIDE)
  const t0 = Date.now()

  // ------------------------------------------- seam frame (matches the cut)
  await page.goto(PROCESSING, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('.pstrip').first().waitFor({ timeout: 45000 })
  await pause(page, 600)
  await caption(page, SEAM_CAPTION, { kicker: 'Wrap up', instant: true })
  const seamMs = Date.now() - t0
  console.log('SEAM_MS:', seamMs)
  await pause(page, 900)

  // ----------------------------------------------- scene: users & access
  await caption(
    page,
    'One more piece — team administration lives in the app too, under Users & access.',
    { kicker: 'Step 6 · Users & access' },
  )
  const navLink = page.getByRole('link', { name: 'Users & access' })
  await moveCursorTo(page, navLink, 34)
  await pause(page, 1200)
  await navLink.click()
  await page.waitForURL(/\/users\?/, { timeout: 15000 })
  await page.getByRole('heading', { name: 'Users & access' }).waitFor({
    timeout: 45000,
  })
  await pause(page, 800)

  await caption(
    page,
    'Admins invite teammates in one step — name, email, and exactly which entities they can see.',
    { kicker: 'Step 6 · Users & access' },
  )
  await pause(page, 2400)

  const entityTrigger = page.locator('[aria-labelledby="entity-access-label"]')
  await moveCursorTo(page, entityTrigger, 28)
  await pause(page, 400)
  await entityTrigger.click()
  const menuItems = page.locator('[role="menuitemcheckbox"]')
  await menuItems.first().waitFor({ timeout: 8000 })
  await caption(
    page,
    'Access is scoped per entity — a reviewer sees only the districts they are granted.',
    { kicker: 'Step 6 · Users & access' },
  )
  await pause(page, 2600)
  await page.keyboard.press('Escape')
  await pause(page, 600)

  const directory = page.getByRole('heading', { name: 'Active users' })
  const pending = page.getByRole('heading', { name: /Pending invitations/ })
  const scrollTarget = (await pending.count()) > 0 ? pending : directory
  await scrollTarget.first().evaluate((el) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
  await caption(
    page,
    'Invitations stay visible until they are accepted — and access can be revoked at any time.',
    { kicker: 'Step 6 · Users & access' },
  )
  await moveCursorTo(page, scrollTarget.first(), 24)
  await pause(page, 3200)
  await caption(page, null)
  await pause(page, 500)

  // ------------------------------------------------------------------ outro
  await titleCard(page, {
    title: 'Upload to approval — one page at a time.',
    sub: 'In-place processing, a single review surface per document, line-item approvals, and entity-scoped team access. In SG DREAM today.',
  })
  await pause(page, 4600)

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
