import { expect, test } from '@playwright/test'

// The scene's frame: a branded card while it loads or when it fails, and a small strip that says what the mouse or
// fingers do, in place of a controls toggle.

const MOUSE = 'LMB rotate · MMB zoom · RMB pan'
const TOUCH = 'Drag to rotate · Pinch to zoom · Two fingers to pan'

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
