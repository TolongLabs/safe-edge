import type { Page } from '@playwright/test'
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

const RAIL = ['Inbox', 'Patrol', 'Map', 'Passes', 'Agent', 'Developers']

/** The logo button and every rail link, with their boxes on the page. */
async function railTargets(page: Page) {
  const rail = page.getByRole('navigation', { name: 'Main' })
  const targets = [
    rail.getByRole('button', { name: 'Collapse navigation' }),
    ...RAIL.map((name) => rail.getByRole('link', { name: new RegExp(`^${name}`) }))
  ]
  return Promise.all(
    targets.map(async (t) => {
      const box = await t.boundingBox()
      if (!box) throw new Error('A rail target has no box')
      return box
    })
  )
}

test('AC160-1 at 390 px every rail target stays on screen, 44 px, the current one named', async ({ page }) => {
  for (const [hash, current] of [
    ['', 'Inbox'],
    ['#/developers', 'Developers'],
    ['#/patrol', 'Patrol']
  ] as const) {
    await page.goto(`demo/${hash}`)
    await expect(page.getByRole('banner').getByRole('heading', { level: 1, name: current })).toBeVisible()
    for (const box of await railTargets(page)) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(390)
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    const rail = page.getByRole('navigation', { name: 'Main' })
    // Only the current item shows its name; the others keep it for screen readers.
    await expect(rail.getByText(current, { exact: true })).toBeVisible()
    for (const other of RAIL.filter((n) => n !== current)) {
      const label = await rail.getByText(other, { exact: true }).boundingBox()
      expect(label?.width).toBeLessThanOrEqual(1)
    }
  }
  await expect(page.getByRole('button', { name: /Open the profile menu/ })).toBeVisible()
})

test('AC160-1 at 320 px the rail scrolls within itself and keeps the current item in view', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('demo/#/developers')
  await expect(page.getByRole('banner').getByRole('heading', { level: 1, name: 'Developers' })).toBeVisible()
  const rail = page.getByRole('navigation', { name: 'Main' })
  const current = rail.getByRole('link', { name: 'Developers' })
  await expect(current).toHaveAttribute('aria-current', 'page')
  await expect(current).toBeInViewport({ ratio: 1 })
  for (const box of await railTargets(page)) {
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
  // The page itself never scrolls sideways; the rail does.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await rail.getByRole('link', { name: /^Inbox/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()
  await expect(rail.getByRole('link', { name: /^Inbox/ })).toBeInViewport({ ratio: 1 })
})
