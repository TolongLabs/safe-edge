import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Chromium's fake camera stands in for a phone's rear camera. Gallery and camera-off tests run in the same browser.
test.use({
  viewport: { width: 390, height: 844 },
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }
})

const SEGMENT = 'seg_866518980_11'
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

async function signInAs(page: Page, name: string) {
  await page.getByRole('banner').getByRole('button', { expanded: false }).click()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await page.keyboard.press('Escape')
}

/** Opens the capture screen of the S1 segment as the walk crew. */
async function asCrew(page: Page) {
  await page.goto('demo/#/capture')
  await expect(page.getByRole('heading', { level: 1, name: 'Capture' })).toBeVisible()
  await signInAs(page, 'Siti Aminah')
  await page.goto(`demo/#/capture/${SEGMENT}`)
  await expect(page.getByRole('heading', { name: /2 viewpoints/ })).toBeVisible()
}

const viewpoint = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^Viewpoint ${n}:`) })
const recorded = (page: Page) =>
  page.evaluate(async () => {
    // counts the presenter's audit entries; only a proof of exactly-once, no screen shows it
    const audit = await (
      window as unknown as { safeEdgeDemo: { demo: { listAudit: () => Promise<Record<string, unknown>[]> } } }
    ).safeEdgeDemo.demo.listAudit()
    return audit.filter(
      (e) => JSON.stringify(e).includes('recordObservation') && JSON.stringify(e).includes('usr_crew')
    ).length
  })

test('AC87-1 the crew sees the segments and the viewpoints of one', async ({ page }) => {
  await page.goto('demo/#/capture')
  await signInAs(page, 'Siti Aminah')
  await expect(page.getByRole('heading', { name: 'Which edge are you walking?' })).toBeVisible()
  await page.getByRole('link', { name: /segment 12/ }).click()
  await expect(page.getByRole('heading', { name: '2 viewpoints · 0 sent' })).toBeVisible()
  await expect(viewpoint(page, 1)).toBeVisible()
  await expect(viewpoint(page, 2)).toBeVisible()
  await expect(page.getByRole('banner')).toContainText('Siti Aminah')
})

test('AC87-1 other roles see who captures and no way to take a photo', async ({ page }) => {
  await page.goto(`demo/#/capture/${SEGMENT}`)
  await expect(page.getByText('Phone capture is the walk crew’s step.')).toBeVisible()
  await expect(page.getByRole('heading', { name: /2 viewpoints/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Viewpoint/ })).toHaveCount(0)
})

test('AC87-2 AC87-3 the camera shows the ghost; the shutter sends a phone observation', async ({ page }) => {
  await asCrew(page)
  await viewpoint(page, 1).click()
  await expect(page.getByLabel('Live camera')).toBeVisible()
  await expect(page.getByText('Baseline ghost of this viewpoint')).toBeVisible()
  const slider = page.getByRole('slider')
  await slider.press('End')
  await expect(page.getByText('100%')).toBeVisible()
  await page.getByRole('button', { name: 'Take photo' }).click()
  const sent = page.getByRole('status').filter({ hasText: 'Sent to Edge Watch' })
  await expect(sent).toContainText(/Recorded in core as a phone observation obs_\d+\./)
  await expect(sent).toContainText('kept on this phone, not stored in core')
  await expect(page.getByText('A sent photo is not a pass.')).toBeVisible()
  await expect(page.getByRole('heading', { name: '2 viewpoints · 1 sent' })).toBeVisible()
  expect(await recorded(page)).toBe(1)
})

test('AC87-2 with the camera off the screen says why and the gallery upload works', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError'))
  })
  await asCrew(page)
  await viewpoint(page, 2).click()
  await expect(page.getByRole('status').filter({ hasText: 'The camera is off.' })).toContainText(
    'This browser did not allow it.'
  )
  await page.getByLabel('Upload from gallery').setInputFiles({ name: 'fence.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('status').filter({ hasText: 'Sent to Edge Watch' })).toContainText(/obs_\d+/)
  await expect(page.getByRole('img', { name: /The photo you took/ })).toBeVisible()
})

test('AC87-4 photos taken offline queue, survive closing the page and upload exactly once', async ({
  page,
  context
}) => {
  await asCrew(page)
  await context.setOffline(true)
  for (const n of [1, 2]) {
    await viewpoint(page, n).click()
    await expect(page.getByLabel('Live camera')).toBeVisible()
    await page.getByRole('button', { name: 'Take photo' }).click()
    await expect(page.getByRole('heading', { name: /2 viewpoints/ })).toBeVisible()
  }
  await expect(page.getByRole('status').filter({ hasText: '2 photos waiting to upload.' })).toContainText('Siti Aminah')
  await expect(page.getByRole('button', { name: 'Upload now' })).toBeDisabled()
  expect(await recorded(page)).toBe(0)
  // The phone is closed and opened again once it has signal: the new page, not the online event, delivers them.
  await page.goto('about:blank')
  await context.setOffline(false)
  await page.goto(`demo/#/capture/${SEGMENT}`)
  await expect(page.getByRole('heading', { name: '2 viewpoints · 2 sent' })).toBeVisible()
  await expect(page.getByText(/waiting to upload/)).toHaveCount(0)
  expect(await recorded(page)).toBe(2)
  await page.reload()
  await expect(page.getByRole('heading', { name: /2 viewpoints/ })).toBeVisible()
  expect(await recorded(page)).toBe(0) // nothing is left to upload, so a reload sends nothing again
})

test('AC87-5 dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await asCrew(page)
  await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgb(231, 235, 232)')
})

test('AC87-2 a gallery file that is not JPEG, PNG or WebP is refused, not recorded as JPEG', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError'))
  })
  await asCrew(page)
  await viewpoint(page, 2).click()
  await page.getByLabel('Upload from gallery').setInputFiles({ name: 'a.gif', mimeType: 'image/gif', buffer: PNG })
  await expect(page.getByRole('alert')).toContainText('not a JPEG, PNG or WebP')
  expect(await recorded(page)).toBe(0)
})

test('AC87-4 photos taken offline upload exactly once when the browser comes back online, without a reload', async ({
  page,
  context
}) => {
  await asCrew(page)
  await context.setOffline(true)
  for (const n of [1, 2]) {
    await viewpoint(page, n).click()
    await expect(page.getByLabel('Live camera')).toBeVisible()
    await page.getByRole('button', { name: 'Take photo' }).click()
    await expect(page.getByRole('heading', { name: /2 viewpoints/ })).toBeVisible()
  }
  await expect(page.getByText('2 photos waiting to upload.')).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByRole('heading', { name: '2 viewpoints · 2 sent' })).toBeVisible()
  await expect(page.getByText(/waiting to upload/)).toHaveCount(0)
  expect(await recorded(page)).toBe(2)
})

test('AC1 no rendered text on Capture contains Tier', async ({ page }) => {
  await page.goto('demo/#/capture')
  await expect(page.getByRole('heading', { level: 1, name: 'Capture' })).toBeVisible()
  expect(await page.locator('body').innerText()).not.toMatch(/\bTier\b/i)
  await page.goto(`demo/#/capture/${SEGMENT}`)
  await expect(page.getByRole('heading', { name: /2 viewpoints/ })).toBeVisible()
  expect(await page.locator('body').innerText()).not.toMatch(/\bTier\b/i)
})
