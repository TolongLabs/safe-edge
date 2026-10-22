// Regenerates the README's images in docs/readme/: the light and dark banners, the screenshots and the How It Works
// steps. It builds the demo site, serves it the way Vercel routes it, and drives it in Google Chrome as each role, so
// the images show this commit. The architecture diagram comes from Archify instead (docs/readme/architecture.json).
//
//   bun run readme:assets
import { chromium, type Browser, type Page } from '@playwright/test'
import { $ } from 'bun'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const out = join(root, 'docs/readme')
const port = 4175
const base = `http://127.0.0.1:${port}/`
const viewport = { width: 1440, height: 900 }

const shot = (page: Page, name: string) => page.screenshot({ path: join(out, `${name}.png`) })
const settle = (page: Page, ms = 800) => page.waitForTimeout(ms)

async function open(browser: Browser) {
  const context = await browser.newContext({ baseURL: base, viewport, colorScheme: 'light' })
  return context.newPage()
}

async function signInAs(page: Page, name: string) {
  await page.getByRole('banner').getByRole('button', { expanded: false }).click()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await page.keyboard.press('Escape')
}

async function screenshots(browser: Browser) {
  const page = await open(browser)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  // The hero claim animates in before it settles.
  await settle(page, 2500)
  await shot(page, 'screenshots/landing')

  await page.goto('demo/#/passes')
  await page.getByRole('heading', { name: 'Every edge, worst first' }).waitFor()
  await settle(page, 1500)
  await shot(page, 'screenshots/passes')

  await page.goto('demo/#/patrol')
  await page.getByRole('button', { name: 'Plan the after-rain patrol' }).click()
  await page.getByRole('heading', { level: 2, name: 'Patrol of 3 segments' }).waitFor()
  await settle(page)
  await shot(page, 'screenshots/patrol')

  for (const name of ['agent', 'developers']) {
    await page.goto(`demo/#/${name}`)
    await settle(page, 1000)
    await shot(page, `screenshots/${name}`)
  }
  await page.context().close()
}

/** The scene's first screen, then two moments of its story: the patrol marks a hidden buoy unknown, and a flag suspends
 * the pass. */
async function scene(browser: Browser) {
  const page = await open(browser)
  await page.goto('demo/scene.html')
  await page.locator('canvas').waitFor({ timeout: 90_000 })
  const story = page.getByRole('region', { name: 'Story' })
  await story.getByRole('button', { name: /^Play the story/ }).waitFor()
  await settle(page, 4000)
  await shot(page, 'screenshots/scene')

  await story.getByRole('button', { name: /^Play the story/ }).click()
  const caption = page.getByTestId('caption')
  await caption.filter({ hasText: 'Glare hides a ring buoy' }).waitFor({ timeout: 120_000 })
  await settle(page, 2000)
  await shot(page, 'steps/1-patrol')
  await caption.filter({ hasText: 'panel 4 is gone' }).waitFor({ timeout: 120_000 })
  await settle(page, 2000)
  await shot(page, 'steps/2-flag')
  await page.context().close()
}

/** S1 to S3 through the screens as each role, as e2e/s1-s3.e2e.ts plays it. */
async function loop(browser: Browser) {
  const page = await open(browser)
  await page.goto('demo/')
  await page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Fence panel 4/ })
    .click()
  const confirm = page.getByRole('button', { name: 'Confirm: needs a fix', exact: true })
  await confirm.waitFor()
  await settle(page)
  await shot(page, 'steps/3-confirm')

  await confirm.click()
  await signInAs(page, 'Siti Aminah')
  await page.getByRole('button', { name: 'Mark done' }).click()
  await signInAs(page, 'Farah Hashim')
  await page.getByRole('link', { name: 'Choose a fix' }).click()
  await page.getByRole('button', { name: 'Use the S2 sample markings' }).click()
  await page.getByRole('button', { name: 'Next: compare fixes' }).click()
  await page.getByRole('button', { name: 'Use the two sample fixes' }).click()
  await page.getByRole('radio', { name: /^B ·/ }).check()
  await settle(page)
  await shot(page, 'steps/4-fix')

  await signInAs(page, 'Lim Wei Jie')
  await page.getByRole('button', { name: 'Approve fix B as Lim Wei Jie' }).click()
  await signInAs(page, 'Farah Hashim')
  await page.getByRole('button', { name: /^Send fix B to .+ crew$/ }).click()
  const repairCheck = await page.getByRole('link', { name: 'Open the repair check' }).getAttribute('href')
  if (!repairCheck) throw new Error('the sent fix has no repair check link')
  // A pass waits for every other open flag on the edge, so the buoy flag is decided first.
  await page.goto('demo/#/inbox')
  await page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Ring buoy/ })
    .click()
  await page.getByRole('button', { name: 'Not a problem', exact: true }).click()
  await page.getByLabel('Reason for rejecting').fill('The buoy was moved for the swim lesson')
  await page.getByRole('button', { name: 'Submit rejection' }).click()

  await page.goto(`demo/${repairCheck}`)
  await signInAs(page, 'Hafiz Rahman')
  await page.getByRole('button', { name: 'Start work' }).click()
  await page
    .getByRole('textbox', { name: 'Note for the person who checks it' })
    .fill('Panel 4 replaced, fence extended')
  await page.getByRole('button', { name: 'Mark work complete' }).click()
  await signInAs(page, 'Priya Nair')
  for (const check of [
    'Saved view 1',
    'Saved view 2',
    'Playground path, through the panel gap',
    'Playground path, around the fence end',
    'Panel gap gauge',
    'Fence end gauge',
    'Re-test photo'
  ]) {
    await page
      .getByRole('radiogroup', { name: `${check} result` })
      .getByRole('radio', { name: 'Pass' })
      .check()
    await page.getByRole('textbox', { name: `Reason for ${check}`, exact: true }).fill('Seen on site')
  }
  await settle(page)
  await shot(page, 'steps/5-prove')

  await page.getByRole('button', { name: 'Sign and issue the pass' }).click()
  await page.getByRole('heading', { name: 'Safety pass issued' }).waitFor()
  await settle(page)
  await shot(page, 'steps/6-repeat')
  await page.context().close()
}

const THEMES = {
  light: {
    bg: '#e6eeea',
    ink: '#1c2925',
    text: '#3c4a45',
    rule: '#17302a',
    frame: '#fbfcfb',
    edge: '#cfd6d2',
    logo: 'favicon.svg'
  },
  dark: {
    bg: '#0d1d19',
    ink: '#fbfcfb',
    text: '#c9d9d1',
    rule: '#6cc495',
    frame: '#17302a',
    edge: '#24443b',
    logo: 'mark-rail.svg'
  }
} as const

/**
 * 1280 × 640 social banners in the site's tokens (apps/site/src/base.css): the product name and the landing page's hero,
 * its words beside its picture. The site has one theme, so both banners frame the same hero.
 */
async function banners(browser: Browser) {
  const landing = await open(browser)
  await landing.goto('/')
  const title = await landing.locator('.hero-title').innerText()
  const line = await landing.locator('.hero-line').innerText()
  await landing.context().close()
  // The landing screenshot screenshots() took, hero first.
  const hero = (await Bun.file(join(out, 'screenshots/landing.png')).bytes()).toBase64()

  const fonts = join(root, 'apps/site/node_modules/@fontsource/atkinson-hyperlegible-next/files')
  const font = async (weight: number) =>
    (await Bun.file(join(fonts, `atkinson-hyperlegible-next-latin-${weight}-normal.woff2`)).bytes()).toBase64()
  const [regular, heavy] = await Promise.all([font(400), font(800)])
  for (const [name, t] of Object.entries(THEMES)) {
    const logo = await Bun.file(join(root, 'apps/site/public', t.logo)).text()
    const page = await open(browser)
    await page.setViewportSize({ width: 1280, height: 640 })
    await page.setContent(`<!doctype html>
<style>
  @font-face { font-family: 'Atkinson Hyperlegible Next'; font-weight: 400; src: url(data:font/woff2;base64,${regular}) format('woff2') }
  @font-face { font-family: 'Atkinson Hyperlegible Next'; font-weight: 800; src: url(data:font/woff2;base64,${heavy}) format('woff2') }
  body { margin: 0; width: 1280px; height: 640px; display: flex; align-items: center; gap: 48px; padding: 0 0 0 72px;
    box-sizing: border-box; background: ${t.bg}; font-family: 'Atkinson Hyperlegible Next' }
  .copy { flex: 0 0 450px }
  .name { display: flex; align-items: center; gap: 18px; color: ${t.ink}; font-size: 56px; font-weight: 800;
    letter-spacing: -0.02em }
  .name svg { width: 64px; height: 64px }
  hr { width: 64px; height: 6px; margin: 28px 0; border: 0; border-radius: 3px; background: ${t.rule} }
  h1 { margin: 0 0 16px; color: ${t.ink}; font-size: 36px; font-weight: 800; line-height: 1.15; letter-spacing: -0.01em }
  p { margin: 0; color: ${t.text}; font-size: 22px; line-height: 1.45 }
  .frame { padding: 14px; border: 1px solid ${t.edge}; border-radius: 20px; background: ${t.frame};
    box-shadow: 0 24px 60px rgb(13 29 25 / 0.18) }
  .frame img { display: block; width: 600px; border-radius: 8px }
</style>
<div class="copy">
  <div class="name">${logo}Safe Edge</div>
  <hr />
  <h1>${title}</h1>
  <p>${line}</p>
</div>
<div class="frame"><img src="data:image/png;base64,${hero}" alt="" /></div>`)
    await page.evaluate(() => document.fonts.ready)
    await shot(page, `banner-${name}`)
    await page.context().close()
  }
}

const site = await mkdtemp(join(tmpdir(), 'safe-edge-readme-'))
await $`bun run build:demo-site ${site}`
const server = Bun.spawn(['bun', join(root, 'scripts/serve-demo-site.ts'), site, String(port)], {
  stdout: 'pipe',
  stderr: 'inherit'
})
const browser = await chromium.launch({ channel: 'chrome' })
try {
  // The server prints one line once it listens.
  if ((await server.stdout.getReader().read()).done) throw new Error('the demo site server exited before it listened')
  await screenshots(browser)
  await scene(browser)
  await loop(browser)
  await banners(browser)
} finally {
  await browser.close()
  server.kill()
  await rm(site, { recursive: true })
}
