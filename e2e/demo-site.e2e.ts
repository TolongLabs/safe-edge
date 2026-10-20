import { expect, test } from '@playwright/test'

// The browser tests run against the prebuilt site that deploys to Vercel (#58): the landing page at /, the web app
// at /demo/.

test('the demo site serves the landing page and the scene', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Safe Edge · every water edge, closed and proven')
  await page.goto('demo/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 90_000 })
})
