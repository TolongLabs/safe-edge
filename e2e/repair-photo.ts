import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect } from './fixtures'

const retestPhoto = join(__dirname, 'fixtures', 'retest.png')

// The tracker enables the photo Pass only after a real photo is uploaded there.
export async function uploadRetestPhoto(page: Page) {
  const region = page.getByRole('region', { name: 'Re-test photo', exact: true })
  await region.getByLabel('Upload from gallery').setInputFiles(retestPhoto)
  await expect(region.getByRole('img', { name: 'After repair' })).toBeVisible()
  await expect(
    page.getByRole('radiogroup', { name: 'Re-test photo result' }).getByRole('radio', { name: 'Pass' })
  ).toBeEnabled()
}
