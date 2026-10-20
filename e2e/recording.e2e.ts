import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

// SIM-11: recording mode holds the camera on a fixed path and records the tab, labels included, to a WebM file.
// Capture needs `getDisplayMedia`, which headless Chromium does not support, so the recording half skips there.

test('recording mode records S6 to a WebM file', async ({ page }) => {
  await page.goto('demo/scene.html?scenario=s6&record')
  const record = page.getByRole('button', { name: 'Record', exact: true })
  await expect(record).toBeVisible({ timeout: 90_000 })
  // The camera follows the path, so the camera controls and the time slider are gone.
  await expect(page.getByRole('button', { name: /controls: switch to/ })).toHaveCount(0)
  await expect(page.getByRole('slider', { name: 'Scenario time' })).toHaveCount(0)

  await record.click()
  const outcome = page.getByRole('link', { name: 'Download the recording' }).or(page.getByRole('alert'))
  await expect(outcome).toBeVisible({ timeout: 60_000 })
  const alert = page.getByRole('alert')
  const failure = (await alert.count()) > 0 ? await alert.textContent() : null
  test.skip(failure?.includes('Not supported') ?? false, 'this browser cannot capture the tab (headless)')
  expect(failure).toBeNull()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download the recording' }).click()
  ])
  expect(download.suggestedFilename()).toBe('safe-edge-s6.webm')
  const bytes = await readFile(await download.path())
  // A WebM file starts with the EBML magic number.
  expect([...bytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3])
  expect(bytes.length).toBeGreaterThan(10_000)
})
