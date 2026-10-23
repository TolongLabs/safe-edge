import type { Page } from '@playwright/test'
import { join } from 'node:path'
import { expect, test } from './fixtures'

test.use({
  viewport: { width: 390, height: 844 },
  timezoneId: 'Asia/Kuala_Lumpur',
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }
})

type Presenter = {
  demo: { listAudit: () => Promise<Record<string, unknown>[]> }
  refresh: () => Promise<void>
}

const SEGMENT = 'seg_866518980_11'
const PLAYGROUND = 'Playground path, fence line'
const fixture = (name: string) => join(__dirname, 'fixtures', name)

async function signInAs(page: Page, name: string) {
  const profile = page.getByRole('banner').getByRole('button', { expanded: false })
  await profile.click()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('banner')).toContainText(name)
}

async function asCrew(page: Page) {
  await page.goto('demo/#/capture')
  await expect(page.getByRole('heading', { level: 1, name: 'Capture' })).toBeVisible()
  await signInAs(page, 'Siti Aminah')
  await page.goto(`demo/#/capture/${SEGMENT}`)
  await expect(page.getByRole('heading', { name: /2 viewpoints/ })).toBeVisible()
}

const viewpoint = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^Viewpoint ${n}:`) })

const reportTrigger = (page: Page) =>
  page.getByRole('button', { name: /Report a problem/ }).or(page.getByRole('link', { name: /Report a problem/ }))

async function openReport(page: Page) {
  await expect(reportTrigger(page)).toBeVisible()
  await reportTrigger(page).click()
  await expect(page.getByRole('heading', { name: /Report a problem/ })).toBeVisible()
}

async function cameraReport(page: Page, n: number) {
  await viewpoint(page, n).click()
  await expect(page.getByLabel('Live camera')).toBeVisible()
  await page.getByRole('button', { name: 'Take photo' }).click()
  await openReport(page)
}

async function uploadReport(page: Page, n: number, file: string) {
  await viewpoint(page, n).click()
  await page.getByLabel('Upload from gallery').setInputFiles(fixture(file))
  await openReport(page)
}

const send = (page: Page) => page.getByRole('button', { name: 'Send report' })

async function fillRequired(page: Page, description: string, type: string, urgency: 'Low' | 'Medium' | 'High') {
  await page.getByRole('textbox', { name: /What did you see/i }).fill(description)
  await page.getByRole('radio', { name: new RegExp(`^${type}$`) }).check()
  await page.getByRole('radio', { name: new RegExp(`^${urgency}\\b`) }).check()
}

async function reportDispatches(page: Page) {
  return page.evaluate(async () => {
    const { demo } = (window as unknown as { safeEdgeDemo: Presenter }).safeEdgeDemo
    const audit = await demo.listAudit()
    return audit.filter((entry) => JSON.stringify(entry).includes('reportDamage')).length
  })
}

async function openInbox(page: Page) {
  await signInAs(page, 'Farah Hashim')
  await page.goto('demo/#/inbox')
  await expect(page.getByRole('navigation', { name: 'Inbox list' })).toBeVisible()
}

function reportRow(page: Page, title: string) {
  return page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: new RegExp(title) })
    .last()
}

async function openManagerReport(page: Page, title: string) {
  await openInbox(page)
  const row = reportRow(page, title)
  await expect(row).toBeVisible()
  await row.click()
  return page.getByRole('main')
}

test('a camera report reaches the manager in blind mode, shows no AI panel, and becomes a finding and work order', async ({
  page
}) => {
  await asCrew(page)
  await cameraReport(page, 2)

  const description = 'The middle fence panel by the swings is gone. You can walk straight to the water.'
  const button = send(page)
  await expect(button).toBeDisabled()

  await fillRequired(page, description, 'Fence or barrier missing', 'High')
  await expect(button).toBeEnabled()
  await button.click()
  await expect(page.getByRole('status').filter({ hasText: /Report sent to the manager/i })).toBeVisible()
  expect(await reportDispatches(page)).toBeGreaterThan(0)

  await openInbox(page)
  await page.getByLabel('Blind-first mode').check()
  const row = reportRow(page, PLAYGROUND)
  await expect(row).toBeVisible()
  await row.click()

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: PLAYGROUND })).toBeVisible()
  await expect(main.getByText(description)).toBeVisible()
  await expect(main.locator('img[src^="blob:"]').first()).toBeVisible()
  await expect(main.getByText(/AI suggestion|AI label|AI confidence|unvalidated|Sample summary/i)).toHaveCount(0)

  await expect(main.getByText('How urgent')).toBeVisible()
  await expect(main.getByText('High', { exact: true }).first()).toBeVisible()
  await expect(main.getByText('No estimate yet')).toBeVisible()
  await expect(main.getByRole('link', { name: /#227|estimate/i })).toHaveAttribute('href', /issues\/227$/)

  const decision = page.getByRole('group', { name: 'Decision' })
  await expect(decision.getByRole('combobox', { name: /^Severity/ })).toHaveValue('high')
  await expect(decision.getByText(/From the reporter/)).toBeVisible()
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  await expect(page.getByRole('region', { name: /^Finding / })).toBeVisible()
  await expect(page.getByRole('region', { name: /^Work order / })).toBeVisible()
})

test('an uploaded photo’s EXIF GPS wins over the phone location and its EXIF time is labelled from the photo', async ({
  page,
  context
}) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 1.2345, longitude: 103.4567, accuracy: 5 })
  await asCrew(page)
  await uploadReport(page, 2, 'report-gps.jpg')

  await expect(page.getByText('From the photo').first()).toBeVisible()
  expect(await page.getByText('From the photo').count()).toBeGreaterThanOrEqual(2)
  const latitude = page.getByLabel(/^Latitude/)
  const longitude = page.getByLabel(/^Longitude/)
  await expect(latitude).toHaveValue(/3\.1087/)
  expect(Number(await longitude.inputValue())).toBeCloseTo(101.6149, 5)
  await expect(latitude).not.toHaveValue(/1\.2345/)
  await expect(longitude).not.toHaveValue(/103\.4567/)

  const when = page.getByLabel(/^When/)
  await expect(when).not.toHaveValue('')
  expect(await when.inputValue()).toMatch(/2024/)
})

test('with geolocation allowed, a camera report takes its place from the phone', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 3.2222, longitude: 101.7777, accuracy: 9 })
  await asCrew(page)
  await cameraReport(page, 2)

  await expect(page.getByText('From your phone').first()).toBeVisible()
  await expect(page.getByLabel(/^Latitude/)).toHaveValue(/3\.2222/)
  await expect(page.getByLabel(/^Longitude/)).toHaveValue(/101\.7777/)
  await expect(page.getByText('From the camera').first()).toBeVisible()
})

test('with geolocation denied, a camera report falls back to the viewpoint', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) =>
      fail?.({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError)
  })
  await asCrew(page)
  await cameraReport(page, 2)

  await expect(page.getByText('From the viewpoint').first()).toBeVisible()
  await expect(page.getByLabel(/^Latitude/)).toHaveValue(/3\.1784/)
  await expect(page.getByLabel(/^Longitude/)).toHaveValue(/101\.5116/)
})

test('an upload with no EXIF needs a time, a description, a type and Other text before Send', async ({ page }) => {
  await asCrew(page)
  await uploadReport(page, 2, 'report-no-exif.jpg')

  const button = send(page)
  await expect(button).toBeDisabled()
  await expect(page.getByLabel(/^When/)).toHaveValue('')
  await expect(page.getByText(/Still needed|Add when you saw it/i).first()).toBeVisible()

  await page.getByRole('textbox', { name: /What did you see/i }).fill('A loose drain cover beside the path')
  await page.getByRole('radio', { name: /^Other$/ }).check()
  await page.getByRole('radio', { name: /^Low\b/ }).check()
  await expect(button).toBeDisabled()
  await page.getByLabel(/Say what it is/i).fill('Loose drain cover')
  await expect(button).toBeDisabled()

  await page.getByLabel(/^When/).fill('2026-10-22T10:30')
  await expect(button).toBeEnabled()
  await button.click()
  await expect(page.getByRole('status').filter({ hasText: /Report sent to the manager/i })).toBeVisible()
})

test('the manager sees a report’s action and cause, and prevention stays saved after the data refreshes', async ({
  page
}) => {
  await asCrew(page)
  await uploadReport(page, 2, 'report-date.jpg')
  await expect(page.getByText('From the photo').first()).toBeVisible()
  expect(await page.getByLabel(/^When/).inputValue()).toMatch(/2025/)

  const description = 'The lower rail is loose and one post leans towards the water.'
  await fillRequired(page, description, 'Fence or barrier damaged', 'Medium')
  await page.getByRole('radio', { name: /^Repair$/ }).check()
  await page.getByLabel(/^Note/i).fill('One loose panel, about 1.5 m wide')
  await page.getByLabel(/Possible cause/i).selectOption({ label: 'Vandalism' })
  await send(page).click()
  await expect(page.getByRole('status').filter({ hasText: /Report sent to the manager/i })).toBeVisible()

  const main = await openManagerReport(page, PLAYGROUND)
  await expect(main.getByText(description)).toBeVisible()
  await expect(main.getByText(/Vandalism/).first()).toBeVisible()
  await expect(main.getByText(/Repair/).first()).toBeVisible()
  await expect(main.getByText(/One loose panel/).first()).toBeVisible()

  const prevention = main
    .locator('fieldset, [role="group"]')
    .filter({ hasText: /Prevention/i })
    .first()
  await expect(prevention).toBeVisible()
  await prevention.getByRole('checkbox', { name: 'CCTV' }).check()
  await prevention.getByRole('checkbox', { name: /Other/ }).check()
  const save = page.getByRole('button', { name: /^Save/ })
  await expect(save).toBeDisabled()
  await prevention.getByRole('textbox').fill('Lighting at the gate')
  await expect(save).toBeEnabled()
  await save.click()
  await expect(page.getByRole('status').filter({ hasText: /Saved/ })).toBeVisible()

  await page.evaluate(async () => {
    await (window as unknown as { safeEdgeDemo: Presenter }).safeEdgeDemo.refresh()
  })
  await expect(prevention.getByRole('checkbox', { name: 'CCTV' })).toBeChecked()
  await expect(prevention.getByRole('checkbox', { name: /Other/ })).toBeChecked()
  await expect(prevention.getByRole('textbox')).toHaveValue('Lighting at the gate')
  await expect(main.getByText(/Vandalism/).first()).toBeVisible()
})

test('an offline report waits on the phone and reaches the manager after reconnecting', async ({ page, context }) => {
  await asCrew(page)
  await context.setOffline(true)
  await viewpoint(page, 2).click()
  await expect(page.getByLabel('Live camera')).toBeVisible()
  await page.getByRole('button', { name: 'Take photo' }).click()
  await openReport(page)

  const description = 'A sign is down in the grass after the storm.'
  await fillRequired(page, description, 'Sign down or missing', 'Low')
  await send(page).click()
  await expect(page.getByRole('status').filter({ hasText: /Report saved to your phone/i })).toBeVisible()
  expect(await reportDispatches(page)).toBe(0)

  await context.setOffline(false)
  await expect.poll(() => reportDispatches(page)).toBeGreaterThan(0)

  const main = await openManagerReport(page, PLAYGROUND)
  await expect(main.getByText(description)).toBeVisible()
})
