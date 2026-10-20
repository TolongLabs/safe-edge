import { expect, test } from '@playwright/test'

// The browser tests run against the prebuilt site that deploys to Vercel (#58): the landing page at /, the web app
// at /demo/.

test('the demo site serves the landing page, the app and the scene', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Safe Edge · every water edge, closed and proven')
  await page.goto('demo/')
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Map' }).click()
  await expect(page).toHaveURL(/\/demo\/scene\.html$/)
  await expect(page.locator('canvas')).toBeVisible({ timeout: 90_000 })
})
