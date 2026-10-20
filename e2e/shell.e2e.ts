import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const profile = (page: Page) => page.getByRole('banner').getByRole('button', { expanded: false })
async function signInAs(page: Page, name: string) {
  await profile(page).click()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
}
const confirmS1 = async (page: Page) => {
  await page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Fence panel 4/ })
    .click()
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  await expect(page.getByRole('region', { name: /^Finding / })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
})

test('AC160-1 rail links, current page and the Map link', async ({ page }) => {
  const rail = page.getByRole('navigation', { name: 'Main' })
  await expect(rail.getByRole('link', { name: /Inbox/ })).toHaveAttribute('aria-current', 'page')
  await rail.getByRole('link', { name: 'Passes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
  await expect(rail.getByRole('link', { name: 'Passes' })).toHaveAttribute('aria-current', 'page')
  await expect(rail.getByRole('link', { name: /Inbox/ })).not.toHaveAttribute('aria-current', 'page')
  await rail.getByRole('link', { name: /Inbox/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()
  const map = rail.getByRole('link', { name: 'Map' })
  await expect(map).toHaveAttribute('href', '/scene.html')
  await expect(map).toHaveAttribute('title', /seed and the scenario player, not this session/)
  await expect(page.getByRole('banner').getByText('Simulation', { exact: true })).toBeVisible()
})

test('AC160-1 the rail collapses and expands by keyboard', async ({ page }) => {
  const rail = page.getByRole('navigation', { name: 'Main' })
  const width = () => rail.evaluate((e) => e.getBoundingClientRect().width)
  const logo = rail.getByRole('button', { name: 'Collapse navigation' })
  const collapsedNames = () => rail.getByRole('link', { name: 'Inbox' })
  await logo.focus()
  await page.keyboard.press('Enter')
  await expect(rail.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(width).toBe(72)
  await expect(collapsedNames()).toBeVisible()
  await page.keyboard.press('Enter')
  await expect.poll(width).toBe(232)
})

test('AC160-2 deep links open the same screen after a reload', async ({ page }) => {
  await page.goto('/#/passes')
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
  await page.goto('/#/fix-lens/fnd_missing')
  await expect(page.getByRole('heading', { name: 'Not in this demo session' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Not in this demo session' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to Inbox' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()
  await page.goto('/#/nowhere')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  // The bare list routes stay routes (not "Page not found") whatever a later task puts on them.
  for (const hash of ['#/fix-lens', '#/retest', '#/capture']) {
    await page.goto(`/${hash}`)
    await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Page not found' })).toHaveCount(0)
    expect(page.url()).toMatch(new RegExp(`${hash}$`))
  }
})

test('AC160-2 a malformed address shows Page not found inside the shell', async ({ page }) => {
  for (const hash of ['#/fix-lens/%E0%A4%A', '#/passes/%']) {
    await page.goto(`/${hash}`)
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  }
})

test('AC160-2 an id that is not shaped like any record shows Not in this demo session', async ({ page }) => {
  for (const hash of ['#/passes/abc', '#/fix-lens/abc', '#/retest/abc', '#/capture/abc', '#/passes/%25']) {
    await page.goto(`/${hash}`)
    await expect(page.getByRole('heading', { name: 'Not in this demo session' })).toBeVisible()
  }
})

test('AC160-2 phone routes use the phone top bar and no rail', async ({ page }) => {
  await page.goto('/#/capture')
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Capture' })).toBeVisible()
})

test('AC160-3b the Inbox links to Fix Lens and the repair check', async ({ page }) => {
  await confirmS1(page)
  await page.getByRole('link', { name: 'Choose a fix' }).click()
  await expect(page).toHaveURL(/#\/fix-lens\/fnd_/)
  await expect(page.getByRole('heading', { name: 'Not in this demo session' })).toHaveCount(0)
  await page.goBack()
  await page.getByRole('button', { name: 'Mark done' }).click()
  await page.getByRole('button', { name: 'Submit work order' }).waitFor()
  await page.evaluate(async () => {
    const { demo, refresh } = (window as unknown as { safeEdgeDemo: { demo: any; refresh: () => Promise<void> } })
      .safeEdgeDemo
    const wo = (await demo.listWorkOrders())[0]
    const gap = await demo.createOpening({
      body: {
        segmentId: wo.segmentId ?? (await demo.listFindings())[0].segmentId,
        type: 'fence_gap',
        photoMarks: [{ evidenceId: 'evd_s1_photo', x: 0.45, y: 0.6 }],
        measuredMm: 1200
      }
    })
    const remedy = await demo.as('usr_engineer').createRemedy({
      body: {
        segmentId: gap.segmentId,
        type: 'panel_replacement',
        label: 'Replace fence panel 4',
        blocksOpeningIds: [gap.id],
        quantities: [{ item: 'Fence panel 2.4 m', amount: 1, unit: 'panel' }],
        acceptanceTest: 'No gap over 100 mm',
        quote: 'quote_needed'
      }
    })
    await demo.as('usr_engineer').approveRemedy({ params: { id: remedy.id } })
    await demo.updateWorkOrder({ params: { id: wo.id }, body: { remedyId: remedy.id } })
    await refresh()
  })
  await page.getByRole('button', { name: 'Submit work order' }).click()
  await page.getByRole('link', { name: 'Open the repair check' }).click()
  await expect(page).toHaveURL(/#\/retest\/wo_/)
  await expect(page.getByRole('heading', { name: 'Not in this demo session' })).toHaveCount(0)
})

test('AC160-4 profile menu: signed-in person, role limits, appearance, reload', async ({ page }) => {
  await profile(page).click()
  const menu = page.getByRole('group', { name: 'Profile menu' })
  await expect(menu.getByRole('button', { name: /Lim Wei Jie/ })).toBeVisible()
  await expect(menu.getByRole('button', { name: /drone|agent/i })).toHaveCount(0)
  await menu.getByRole('button', { name: /Lim Wei Jie/ }).click()
  await expect(page.getByText("Candidate triage is the park manager's step")).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Inbox list' }).getByRole('button')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText("Candidate triage is the park manager's step")).toBeVisible()
  // appearance
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await profile(page).click()
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  expect(await bg()).toBe('rgb(17, 26, 23)')
  await page.reload()
  expect(await bg()).toBe('rgb(17, 26, 23)')
  await profile(page).click()
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  expect(await bg()).toBe('rgb(231, 235, 232)')
  // back to the manager, S1 confirms
  await page.getByRole('button', { name: /Farah Hashim/ }).click()
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  // Reset demo signs back in as the manager
  await profile(page).click()
  await page
    .getByRole('group', { name: 'Profile menu' })
    .getByRole('button', { name: /Lim Wei Jie/ })
    .click()
  await profile(page).click()
  await page.getByRole('button', { name: 'Reset demo' }).click()
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  await expect(page.getByRole('banner').getByRole('button', { name: /Farah Hashim/ })).toBeVisible()
})

test('AC160-4 the engineer sees tasks and work orders, not flags', async ({ page }) => {
  await confirmS1(page)
  await signInAs(page, 'Lim Wei Jie')
  await expect(
    page.getByRole('region').filter({ has: page.getByRole('heading', { name: 'Interim protection task' }) })
  ).toBeVisible()
  await expect(page.getByRole('region', { name: /^Work order / })).toBeVisible()
  await expect(page.getByText('The park manager, walk crew or installer marks this done')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark done' })).toHaveCount(0)
})

test('AC160-4b the crew marks the interim protection done', async ({ page }) => {
  await confirmS1(page)
  await expect(page.getByRole('button', { name: 'Submit work order' })).toBeDisabled()
  await expect(page.getByText('Interim protection is not done yet')).toBeVisible()
  await signInAs(page, 'Siti Aminah')
  await page.getByRole('button', { name: 'Mark done' }).click()
  await expect(page.getByText('Marked done by Siti Aminah')).toBeVisible()
  await signInAs(page, 'Farah Hashim')
  await expect(page.getByText('Interim protection is not done yet')).toHaveCount(0)
})

test('AC160-4 switching people quickly never shows a stale screen', async ({ page }) => {
  const errors: Error[] = []
  page.on('pageerror', (e) => errors.push(e))
  await profile(page).click()
  const menu = page.getByRole('group', { name: 'Profile menu' })
  // Both clicks in one page turn, so the second sign-in starts while the first is still reading.
  const lim = await menu.getByRole('button', { name: /Lim Wei Jie/ }).elementHandle()
  const farah = await menu.getByRole('button', { name: /Farah Hashim/ }).elementHandle()
  await page.evaluate(
    ([a, b]) => {
      ;(a as HTMLElement).click()
      ;(b as HTMLElement).click()
    },
    [lim, farah]
  )
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  await signInAs(page, 'Lim Wei Jie')
  await expect(page.getByText("Candidate triage is the park manager's step")).toBeVisible()
  await signInAs(page, 'Farah Hashim')
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  expect(errors).toEqual([])
})

test('AC160-4 Appearance System follows the browser colour scheme', async ({ page }) => {
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await profile(page).click()
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.getByRole('button', { name: 'System', exact: true }).click()
  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await bg()).toBe('rgb(17, 26, 23)')
  await page.emulateMedia({ colorScheme: 'light' })
  expect(await bg()).toBe('rgb(231, 235, 232)')
})

test('an unexpected error shows the error banner instead of a blank page', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as unknown as { safeEdgeDemo: { demo: { as: () => unknown } } }
    w.safeEdgeDemo.demo.as = () => ({
      getFinding: () => {
        throw new Error('boom from core')
      }
    })
    window.location.hash = '#/fix-lens/fnd_1'
  })
  await expect(page.getByRole('alert')).toContainText('boom from core')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
})
