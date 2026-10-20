import { expect, test } from './fixtures'

test.use({ viewport: { width: 390, height: 844 } })

test('AC160-1 the phone screens use the phone top bar and no rail', async ({ page }) => {
  await page.goto('demo/#/capture')
  const bar = page.getByRole('banner')
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await expect(bar.getByRole('heading', { level: 1, name: 'Capture' })).toBeVisible()
  await expect(bar.getByText('Simulation', { exact: true })).toBeVisible()
  for (const name of ['Back to Inbox', /Open the profile menu/]) {
    const box = await bar.getByRole(name === 'Back to Inbox' ? 'link' : 'button', { name }).boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
  await bar.getByRole('link', { name: 'Back to Inbox' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()
})

test('AC160-1 at 390 px all three rail items stay on screen', async ({ page }) => {
  await page.goto('demo/')
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  const rail = page.getByRole('navigation', { name: 'Main' })
  for (const name of ['Inbox', 'Map', 'Passes']) {
    const box = await rail.getByRole('link', { name: new RegExp(name) }).boundingBox()
    expect(box).not.toBeNull()
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
  }
  await expect(page.getByRole('button', { name: /Open the profile menu/ })).toBeVisible()
})
