import { expect, test, type Page } from '@playwright/test'

// The landing page ends on the night footer, which fills the screen and carries the way into the demo.

/** Scrolls until the page rests at its very end: smooth scrolling and pinned sections can move the end meanwhile. */
const scrollToEnd = async (page: Page) => {
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.waitForTimeout(300)
        return page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 1)
      },
      { timeout: 20_000 }
    )
    .toBe(true)
  await page.waitForTimeout(1_000)
}

for (const [size, use] of [
  ['a laptop', { viewport: { width: 1440, height: 900 } }],
  ['a phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]
] as const) {
  test.describe(`on ${size}`, () => {
    test.use(use)

    test('there is no "Prove every edge." section', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Prove every edge.' })).toHaveCount(0)
    })

    test('every "Open the demo" link goes to /sign-in', async ({ page }) => {
      await page.goto('/')
      const links = page.getByRole('link', { name: 'Open the demo' })
      await expect(links).toHaveCount(2)
      for (const link of await links.all()) await expect(link).toHaveAttribute('href', '/sign-in')
      await expect(page.locator('footer').getByRole('link', { name: 'Open the demo' })).toHaveCount(1)
    })

    test('the end of the scroll shows only the footer', async ({ page }) => {
      await page.goto('/')
      await scrollToEnd(page)
      const view = await page.evaluate(() => {
        const box = document.querySelector('footer')!.getBoundingClientRect()
        const top = document.elementFromPoint(innerWidth / 2, 10)
        return { top: box.top, bottom: box.bottom, height: innerHeight, inFooter: !!top?.closest('footer') }
      })
      expect(view.top).toBeLessThanOrEqual(1)
      expect(view.bottom).toBeGreaterThanOrEqual(view.height - 1)
      expect(view.inFooter).toBe(true)
    })
  })
}
