import { expect, test } from './fixtures'

// The scene's frame: a branded card while it loads or when it fails, a small strip that says what the mouse or
// fingers do, in place of a controls toggle, and a way back to the app. The offline fixture fails any test that
// fetched from outside, fonts included.

const MOUSE = 'LMB rotate · MMB zoom · RMB pan'
const TOUCH = 'Drag to rotate · Pinch to zoom · Two fingers to pan'

test('the map has a way back to the app', async ({ page }) => {
  await page.goto('demo/')
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Map' }).click()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 90_000 })
  await page.getByRole('link', { name: 'Back to Safe Edge' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()
  // Opened directly, Back links to the app instead of leaving the site.
  await page.goto('demo/scene.html')
  await expect(page.getByRole('link', { name: 'Back to Safe Edge' })).toHaveAttribute('href', /\/demo\/$/)
})

test('the scene loads behind a branded card', async ({ page }) => {
  // Hold the seed back so the card is still up to be seen; a local load is otherwise over in milliseconds.
  let release = () => {}
  const held = new Promise<void>((done) => (release = done))
  await page.route('**/seed-*.json', async (route) => {
    await held
    await route.continue()
  })
  await page.goto('demo/scene.html')
  const card = page.getByRole('status')
  await expect(card).toContainText('Loading the Elmina simulation')
  await expect(card.getByRole('progressbar')).toBeVisible()
  release()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 90_000 })
  await expect(card).toHaveCount(0)
})

test('a failed load says so and retries', async ({ page }) => {
  let fail = true
  await page.route('**/seed-*.json', (route) => (fail ? route.abort() : route.continue()))
  await page.goto('demo/scene.html')
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('did not load')
  fail = false
  await alert.getByRole('button', { name: 'Retry' }).click()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 90_000 })
})

test('the controls strip replaces the toggle', async ({ page }) => {
  await page.goto('demo/scene.html')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('button', { name: /controls: switch to/ })).toHaveCount(0)
  const strip = page.getByText(MOUSE)
  await expect(strip).toBeVisible()
  const box = (await strip.boundingBox())!
  const height = page.viewportSize()!.height
  expect(box.x).toBeLessThan(40)
  expect(box.y + box.height).toBeGreaterThan(height - 40)
})

test('the controls strip reads clearly over the night map', async ({ page }) => {
  await page.goto('demo/scene.html')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 90_000 })
  const { background, contrast } = await page.getByText(MOUSE).evaluate((el) => {
    const rgba = (value: string) => value.match(/[\d.]+/g)!.map(Number)
    const lum = ([r, g, b]: number[]) =>
      [r!, g!, b!]
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0)
    const style = getComputedStyle(el)
    const [a, b] = [lum(rgba(style.color)), lum(rgba(style.backgroundColor))].sort((x, y) => y - x)
    return { background: rgba(style.backgroundColor), contrast: (a! + 0.05) / (b! + 0.05) }
  })
  // A translucent strip shows the dark map through it, so only a solid one keeps its contrast.
  expect(background[3] ?? 1).toBe(1)
  expect(contrast).toBeGreaterThanOrEqual(4.5)
})

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('the strip gives touch wording', async ({ page }) => {
    await page.goto('demo/scene.html')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 90_000 })
    await expect(page.getByText(TOUCH)).toBeVisible()
  })
})

test('recording mode hides the strip', async ({ page }) => {
  await page.goto('demo/scene.html?record')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(MOUSE)).toHaveCount(0)
  await expect(page.getByText(TOUCH)).toHaveCount(0)
})
