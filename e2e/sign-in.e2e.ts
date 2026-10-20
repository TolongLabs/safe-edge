import { expect, test } from '@playwright/test'

// The prototype has no accounts: the sign-in page shows email and password closed, and only a guest gets in. The
// guest's view follows the device, without asking: the manager's on a computer, the reviewer's on a phone.

const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } as const

test("the landing page's button opens /sign-in", async ({ page }) => {
  await page.goto('/')
  await page.getByRole('banner').getByRole('link', { name: 'Open the demo' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('email and password are shown but closed', async ({ page }) => {
  await page.goto('sign-in')
  for (const field of [page.getByLabel('Email'), page.getByLabel('Password')]) {
    await expect(field).toBeDisabled()
    expect(await field.evaluate((el) => getComputedStyle(el).cursor)).toBe('not-allowed')
  }
  await expect(page.getByText('Accounts open after the pilot.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0)
})

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("a guest opens the manager's view", async ({ page }) => {
    await page.goto('sign-in')
    await page.getByRole('button', { name: 'Sign in as Guest' }).click()
    await expect(page).toHaveURL(/\/demo\/\?as=manager$/)
    await expect(page.locator('canvas')).toBeVisible({ timeout: 90_000 })
  })
})

test.describe('on a phone', () => {
  test.use(phone)

  test("a guest opens the reviewer's view", async ({ page }) => {
    await page.goto('sign-in')
    await page.getByRole('button', { name: 'Sign in as Guest' }).click()
    await expect(page).toHaveURL(/\/demo\/\?as=reviewer$/)
  })

  test('its links are full-size touch targets', async ({ page }) => {
    await page.goto('sign-in')
    for (const link of await page.getByRole('link').all())
      expect((await link.boundingBox())!.height, await link.textContent()).toBeGreaterThanOrEqual(44)
  })

  test('the two panes stack', async ({ page }) => {
    await page.goto('sign-in')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    const brand = await page.getByRole('complementary', { name: 'Safe Edge' }).boundingBox()
    const form = await page.getByRole('main').boundingBox()
    expect(brand!.y + brand!.height).toBeLessThanOrEqual(form!.y + 1)
  })
})
