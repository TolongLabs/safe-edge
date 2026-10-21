import { expect, test, type Page } from '@playwright/test'

// The landing site's product pages: /drone, /agent, /sdk and /privacy. Each has its own clean URL, and the header
// on every page reaches every other page, marks the one you are on, and opens the demo.

const pages = [
  { path: 'drone', link: 'Drone', title: 'Drone patrols · Safe Edge', h1: 'Automated patrols. Never autonomous.' },
  { path: 'agent', link: 'Agent', title: 'The agent and MCP · Safe Edge', h1: 'One agent. It drafts. People decide.' },
  { path: 'sdk', link: 'SDK', title: 'SDK and API · Safe Edge', h1: 'One typed client, in the browser or on the API.' },
  { path: 'privacy', link: 'Privacy', title: 'Privacy by design · Safe Edge', h1: 'We watch edges, not people.' }
] as const

const pageNav = (page: Page) => page.getByRole('banner').getByRole('navigation', { name: 'Pages' })

for (const { path, link, title, h1 } of pages) {
  test(`/${path} serves its page, marked as current in the header`, async ({ page }) => {
    await page.goto(path)
    await expect(page).toHaveTitle(title)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible()
    for (const other of pages) {
      const item = pageNav(page).getByRole('link', { name: other.link, exact: true })
      if (other.path === path) await expect(item).toHaveAttribute('aria-current', 'page')
      else await expect(item).not.toHaveAttribute('aria-current')
    }
    await expect(page.getByRole('banner').getByRole('link', { name: 'Open the demo' })).toHaveAttribute(
      'href',
      '/sign-in'
    )
  })
}

test('the header walks from the landing page through every page and back home', async ({ page }) => {
  await page.goto('/')
  for (const { path, link, h1 } of pages) {
    await pageNav(page).getByRole('link', { name: link, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/${path}$`))
    await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible()
  }
  await page.getByRole('banner').getByRole('link', { name: 'Safe Edge, home' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Every water edge, closed and proven.' })).toBeVisible()
})

test('the landing page links to every page from its header and its footer', async ({ page }) => {
  await page.goto('/')
  const footer = page.locator('footer').getByRole('navigation', { name: 'Pages, footer' })
  for (const { path, link } of pages) {
    await expect(pageNav(page).getByRole('link', { name: link, exact: true })).toHaveAttribute('href', `/${path}`)
    await expect(footer.locator(`a[href="/${path}"]`)).toHaveCount(1)
  }
})

test('the sign-in page links to every page', async ({ page }) => {
  await page.goto('sign-in')
  const nav = page.getByRole('navigation', { name: 'Pages' })
  for (const { path, link } of pages)
    await expect(nav.getByRole('link', { name: link, exact: true })).toHaveAttribute('href', `/${path}`)
})

for (const path of ['', ...pages.map((p) => p.path), 'sign-in'])
  test(`every picture on /${path} loads`, async ({ page }) => {
    await page.goto(path)
    const broken = await page.evaluate(async () => {
      const images = [...document.images]
      for (const image of images) image.loading = 'eager'
      // decode() rejects for a file the browser cannot draw; the list below names those.
      await Promise.allSettled(images.map((image) => image.decode()))
      return images.filter((image) => image.naturalWidth === 0).map((image) => image.getAttribute('src'))
    })
    expect(broken).toEqual([])
  })

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 640 }
])
  test(`at ${viewport.width} px each page's hero shows the whole dawn picture, its claim in clear sky`, async ({
    page
  }) => {
    await page.setViewportSize(viewport)
    for (const { path } of pages) {
      await page.goto(path)
      const hero = await page.locator('.page-hero').evaluate((el) => {
        const art = el.querySelector('.page-art')!.getBoundingClientRect()
        const words = [...el.querySelectorAll('.page-hero-words > *')].map((w) => w.getBoundingClientRect().bottom)
        // The sun's top, the picture's highest shape, sits 40.8% down its 1600 × 1000 frame.
        return { art, wordsBottom: Math.max(...words), sunTop: art.bottom - art.width * 0.625 * 0.592 }
      })
      expect(hero.art.width / hero.art.height, path).toBeCloseTo(1.6, 2)
      expect(hero.wordsBottom, path).toBeLessThan(hero.sunTop)
    }
  })

test('a Copy button copies its code', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('sdk')
  const block = page.locator('.code').first()
  const code = await block.locator('code').textContent()
  await block.getByRole('button', { name: 'Copy' }).click()
  await expect(block.getByRole('button', { name: 'Copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code)
  expect(code).toContain("createSafeEdgeClient({ transport: 'memory', userId: 'usr_manager' })")
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('a page still reads, with its header, and hides the Copy button it cannot run', async ({ page }) => {
    await page.goto('sdk')
    await expect(page.getByRole('heading', { level: 1, name: pages[2].h1 })).toBeVisible()
    await expect(pageNav(page).getByRole('link')).toHaveCount(4)
    await expect(page.locator('.code').first().locator('code')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy' })).toHaveCount(0)
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  for (const path of ['', ...pages.map((p) => p.path), 'sign-in'])
    test(`/${path} fits the screen width`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    })

  test('every page link in the header is on screen and a full-size target', async ({ page }) => {
    await page.goto('drone')
    const links = await pageNav(page).getByRole('link').all()
    expect(links).toHaveLength(4)
    for (const link of links) {
      await expect(link).toBeInViewport()
      const box = (await link.boundingBox())!
      expect(box.height, (await link.textContent()) ?? '').toBeGreaterThanOrEqual(44)
    }
  })
})
