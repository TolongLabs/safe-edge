import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Every screen here is a phone screen.
test.use({ viewport: { width: 390, height: 844 } })

const profile = (page: Page) => page.getByRole('banner').getByRole('button', { expanded: false })
async function signInAs(page: Page, name: string) {
  await profile(page).click()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
}

// S1: the manager decides the buoy flag, then confirms the fence flag as a finding that needs a fix.
async function rejectBuoy(page: Page) {
  await page.goto('demo/#/inbox')
  await page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Playground path, ring buoy post/ })
    .click()
  await page.getByRole('button', { name: 'Not a problem', exact: true }).click()
  await page.getByLabel('Reason for rejecting').fill('The buoy was moved for the swim lesson')
  await page.getByRole('button', { name: 'Submit rejection' }).click()
  await expect(page.getByText(/Rejected by Farah Hashim/)).toBeVisible()
}

// S2: the panel gap by clicking the photo, the fence end by the form, and the two ways to the water.
async function markOpenings(page: Page) {
  await page.getByRole('textbox', { name: 'Size' }).fill('120')
  const photo = page.getByRole('img', { name: 'Sample illustration of the finding' })
  const box = (await photo.boundingBox())!
  await photo.click({ position: { x: box.width * 0.45, y: box.height * 0.6 } })
  await expect(page.getByRole('img', { name: 'Opening 1, Panel gap, 120 cm' })).toBeVisible()
  await page.getByLabel('Add an opening: type').selectOption({ label: 'Fence end' })
  await page.getByLabel('Across the photo').fill('90')
  await page.getByLabel('Down the photo').fill('60')
  await page.getByRole('textbox', { name: 'Size' }).fill('45')
  await page.getByRole('button', { name: 'Add opening' }).click()
  await expect(page.getByRole('img', { name: 'Opening 2, Fence end, 45 cm' })).toBeVisible()
  for (const [name, opening] of [
    ['Playground path, through the panel gap', 'Opening 1, Panel gap'],
    ['Playground path, around the fence end', 'Opening 2, Fence end']
  ] as const) {
    await page.getByLabel('Name of the way').fill(name)
    await page.getByRole('checkbox', { name: opening }).check()
    await page.getByRole('button', { name: 'Add way to the water' }).click()
    await expect(page.getByRole('list').getByText(name, { exact: true })).toBeVisible()
  }
  await expect(page.getByText('2 openings and 2 ways recorded.')).toBeVisible()
}

async function propose(page: Page, label: string, blocks: string[], test: string) {
  await page.getByLabel('Name of the fix').fill(label)
  for (const b of blocks) await page.getByRole('checkbox', { name: b }).check()
  await page.getByLabel('Quantity of').fill('Fence panel')
  await page.getByLabel('Amount', { exact: true }).fill('1')
  await page.getByLabel('Unit', { exact: true }).fill('panel')
  await page.getByLabel('Acceptance test').fill(test)
  await page.getByRole('button', { name: 'Add this fix' }).click()
  await expect(page.getByRole('radio', { name: new RegExp(label) })).not.toBeChecked()
}

async function compare(page: Page) {
  await markOpenings(page)
  await page.getByRole('button', { name: 'Next: compare fixes' }).click()
  await propose(page, 'Replace panel 4', ['Opening 1, Panel gap'], 'No gap over 10 cm at panel 4')
  await propose(
    page,
    'Replace panel 4 and extend the fence end',
    ['Opening 1, Panel gap', 'Opening 2, Fence end'],
    'No gap over 10 cm along the run and around both fence ends'
  )
  // Nothing is chosen for the manager.
  await expect(page.getByRole('button', { name: /^Send fix to/ })).toBeDisabled()
  await expect(page.getByText('Choose a fix first.')).toBeVisible()
  await page.getByRole('radio', { name: /^B ·/ }).check()
}

// What each check is called; the groups and reasons on screen are found by these names.
const REPAIR_CHECKS = [
  'Saved view 1',
  'Saved view 2',
  'Playground path, through the panel gap',
  'Playground path, around the fence end',
  'Panel gap gauge',
  'Fence end gauge',
  'Re-test photo'
]

test('S1 to S3 the core loop, played through the screens as each role', async ({ page }) => {
  // S1: the manager confirms the fence flag as a finding that needs a fix.
  await page.goto('demo/')
  await page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Playground path, fence line/ })
    .click()
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  await expect(page.getByRole('region', { name: /^Finding / })).toBeVisible()

  // S2: the crew marks the interim protection done.
  await signInAs(page, 'Siti Aminah')
  await page.getByRole('button', { name: 'Mark done' }).click()
  await expect(page.getByText('Marked done by Siti Aminah')).toBeVisible()

  // S3: the manager opens Fix Lens, marks the openings and compares two fixes.
  await signInAs(page, 'Farah Hashim')
  await page.getByRole('link', { name: 'Choose a fix' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fix Lens' })).toBeVisible()
  await compare(page)
  await expect(page.getByText('Leaves 1 way to the water open, Playground path, around the fence end')).toBeVisible()
  await expect(page.getByText('Closes all 2 ways to the water')).toBeVisible()

  // S4: the engineer approves fix B, and the manager sends it to the installer's crew.
  await signInAs(page, 'Lim Wei Jie')
  await page.getByRole('button', { name: 'Approve fix B as Lim Wei Jie' }).click()
  await expect(page.getByText('Approved by Lim Wei Jie')).toBeVisible()
  await signInAs(page, 'Farah Hashim')
  await page.getByRole('button', { name: /^Send fix B to .+ crew$/ }).click()
  await expect(page.getByRole('heading', { name: /^Fix B sent to .+ crew$/ })).toBeVisible()

  // The buoy flag is decided before the repair check, because a pass waits for every other open flag on the edge.
  // Deciding it leaves the Fix Lens screen, so the repair check's address is kept and opened again.
  const repairCheck = (await page.getByRole('link', { name: 'Open the repair check' }).getAttribute('href'))!
  await rejectBuoy(page)
  await page.goto(`demo/${repairCheck}`)

  // S5: the installer starts the work and marks it complete.
  await signInAs(page, 'Hafiz Rahman')
  await page.getByRole('button', { name: 'Start work' }).click()
  await page
    .getByRole('textbox', { name: 'Note for the person who checks it' })
    .fill('Panel 4 replaced, fence extended')
  await page.getByRole('button', { name: 'Mark work complete' }).click()
  await expect(page.getByRole('heading', { name: 'A different person checks this repair' })).toBeVisible()

  // S6: the reviewer passes every check and signs the pass.
  await signInAs(page, 'Priya Nair')
  for (const name of REPAIR_CHECKS) {
    await page
      .getByRole('radiogroup', { name: `${name} result` })
      .getByRole('radio', { name: 'Pass' })
      .check()
    await page.getByRole('textbox', { name: `Reason for ${name}`, exact: true }).fill('Seen on site')
  }
  await page.getByRole('button', { name: 'Sign and issue the pass' }).click()
  await expect(page.getByRole('heading', { name: 'Safety pass issued' })).toBeVisible()
  // The pass lasts at most 12 months; the page's own clock judges the date.
  const shown = (await page.getByText(/^Valid to /).textContent())!.replace('Valid to ', '')
  const now = await page.evaluate(() => Date.now())
  const validTo = new Date(`${shown} UTC`).getTime()
  expect(validTo).toBeGreaterThan(now)
  expect(validTo).toBeLessThanOrEqual(now + 366 * 24 * 3600 * 1000)

  // S7: the manager sees how the finding got to the pass.
  await signInAs(page, 'Farah Hashim')
  const history = page.getByRole('region', { name: 'How it got here' })
  await expect(history.getByText('Checked and signed')).toHaveCount(1)
  await expect(history.getByText('Priya Nair')).toBeVisible()
})
