import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const profile = (page: Page) => page.getByRole('banner').getByRole('button', { expanded: false })
async function signInAs(page: Page, name: string) {
  await profile(page).click()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
}

// S1 confirmed by the manager, interim protection done by the crew, then Fix Lens opened from the Inbox.
async function openLens(page: Page) {
  await page.goto('demo/')
  await page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Fence panel 4/ })
    .click()
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  await expect(page.getByRole('region', { name: /^Finding / })).toBeVisible()
  await signInAs(page, 'Siti Aminah')
  await page.getByRole('button', { name: 'Mark done' }).click()
  await expect(page.getByText('Marked done by Siti Aminah')).toBeVisible()
  await signInAs(page, 'Farah Hashim')
  await page.getByRole('link', { name: 'Choose a fix' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fix Lens' })).toBeVisible()
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

async function sendFix(page: Page) {
  await signInAs(page, 'Lim Wei Jie')
  await page.getByRole('button', { name: 'Approve fix B as Lim Wei Jie' }).click()
  await expect(page.getByText('Approved by Lim Wei Jie')).toBeVisible()
  await signInAs(page, 'Farah Hashim')
  const due = page.getByLabel('Due date')
  const kept = await due.inputValue()
  await due.fill('2020-01-01')
  await expect(page.getByRole('button', { name: /^Send fix B to .+ crew$/ })).toBeDisabled()
  await expect(page.getByText('Choose a due date from today on.')).toBeVisible()
  await due.fill(kept)
  await page.getByRole('button', { name: /^Send fix B to .+ crew$/ }).click()
  await expect(page.getByRole('heading', { name: /^Fix B sent to .+ crew$/ })).toBeVisible()
}

test('AC81-1 a confirmed finding links to its own photo, and the list shows open findings', async ({ page }) => {
  await page.goto('demo/#/fix-lens')
  await expect(page.getByRole('heading', { name: 'No open findings in this session' })).toBeVisible()
  await expect(page.getByText('This does not mean the lake edge is safe')).toBeVisible()
  await openLens(page)
  await expect(page.getByRole('img', { name: 'Sample illustration of the finding' })).toBeVisible()
  await expect(page.getByText('Sample illustration, not a site photo')).toBeVisible()
  await expect(page.getByRole('banner').getByText(/Fence panel 4 missing/)).toBeVisible()
  await page.goto('demo/#/fix-lens')
  await page.getByRole('link', { name: /Fence panel 4 missing/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Mark the openings' }).or(page.getByRole('button', { name: 'Mark the openings' }))
  ).toBeVisible()
})

test('AC81-2 marks openings by mouse and keyboard form, and records the ways to the water', async ({ page }) => {
  await openLens(page)
  await page.getByRole('textbox', { name: 'Size' }).fill('abc')
  await expect(page.getByRole('textbox', { name: 'Size' })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toContainText('Size must be a number of centimetres')
  await page.getByRole('img', { name: 'Sample illustration of the finding' }).click()
  await expect(page.getByRole('img', { name: /^Opening 1/ })).toHaveCount(0)
  await markOpenings(page)
  await expect(page.getByText('From play area · through opening 2')).toBeVisible()
  await page.getByLabel('Name of the way').fill('Path by the buoy')
  await page.getByRole('checkbox', { name: /not sure which opening/ }).check()
  await page.getByRole('button', { name: 'Add way to the water' }).click()
  await expect(page.getByText('opening not known')).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Ways to the water' }).getByText(/opening not known · unknown/)
  ).toBeVisible()
  await signInAs(page, 'Siti Aminah')
  await expect(page.getByText('A park manager or engineer marks the openings on this photo.')).toBeVisible()
})

test('AC81-2 the engineer marks an opening on the photo too', async ({ page }) => {
  await openLens(page)
  await signInAs(page, 'Lim Wei Jie')
  const photo = page.getByRole('img', { name: 'Sample illustration of the finding' })
  const box = (await photo.boundingBox())!
  await photo.click({ position: { x: box.width * 0.4, y: box.height * 0.5 } })
  await expect(page.getByRole('img', { name: /^Opening 1, Panel gap/ })).toBeVisible()
})

test('AC81-3 compares fixes on plan drawings with the result line from core', async ({ page }) => {
  await openLens(page)
  await compare(page)
  await expect(page.getByText('Leaves 1 way to the water open, Playground path, around the fence end')).toBeVisible()
  await expect(page.getByText('Closes all 2 ways to the water')).toBeVisible()
  await expect(
    page.getByRole('img', { name: /Plan for fix A\..*through the panel gap: closed; .*around the fence end: open/ })
  ).toBeVisible()
  await expect(
    page.getByRole('img', { name: /Plan for fix B\..*through the panel gap: closed; .*around the fence end: closed/ })
  ).toBeVisible()
  await expect(page.getByText('Still open', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Still open: Playground path, around the fence end')).toHaveCount(1)
  await expect(page.getByText('proposed repair, not installed', { exact: true })).toHaveCount(2)
  await expect(page.getByText(/· quote needed ·/)).toHaveCount(2)
})

test('AC81-4 only the engineer approves a fix', async ({ page }) => {
  await openLens(page)
  await compare(page)
  await expect(page.getByRole('button', { name: /^Approve fix/ })).toHaveCount(0)
  await expect(page.getByText('An engineer approves this fix')).toHaveCount(2)
  await signInAs(page, 'Lim Wei Jie')
  await page.getByRole('button', { name: 'Approve fix B as Lim Wei Jie' }).click()
  await expect(page.getByText('Approved by Lim Wei Jie')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve fix B as Lim Wei Jie' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Send fix/ })).toHaveCount(0)
  await expect(page.getByText('The park manager sends the work order')).toBeVisible()
})

test('AC81-5 sends the fix only after the engineer approved it, then shows the work order', async ({ page }) => {
  await openLens(page)
  await compare(page)
  const send = page.getByRole('button', { name: /^Send fix B to/ })
  await expect(send).toBeDisabled()
  await expect(page.getByText('An engineer must approve fix B first.')).toBeVisible()
  await sendFix(page)
  await expect(page.getByText(/engineer approved by Lim Wei Jie/)).toBeVisible()
  await expect(page.getByText('quote needed')).toBeVisible()
  await expect(page.getByText('No gap over 10 cm along the run and around both fence ends')).toBeVisible()
  await expect(page.getByText('Someone who did not install it')).toBeVisible()
  await expect(page.getByRole('rowheader', { name: 'Fence panel' })).toBeVisible()
  await expect(page.getByRole('img', { name: /^Proposed work at opening 2/ })).toBeVisible()
  await page.getByRole('link', { name: 'Open the repair check' }).click()
  await expect(page).toHaveURL(/#\/retest\/wo_/)
})

test('AC81-5 sending waits for interim protection', async ({ page }) => {
  await page.goto('demo/')
  await page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Fence panel 4/ })
    .click()
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  await page.getByRole('link', { name: 'Choose a fix' }).click()
  await compare(page)
  await signInAs(page, 'Lim Wei Jie')
  await page.getByRole('button', { name: 'Approve fix B as Lim Wei Jie' }).click()
  await signInAs(page, 'Farah Hashim')
  await expect(page.getByRole('button', { name: /^Send fix B to/ })).toBeDisabled()
  await expect(page.getByText('Interim protection must be done first.')).toBeVisible()
})

test('AC81-6 reads from core: a reset clears it, and a sent fix is still there after leaving and coming back', async ({
  page
}) => {
  await openLens(page)
  await compare(page)
  await profile(page).click()
  await page.getByRole('button', { name: 'Reset demo' }).click()
  await expect(page.getByRole('heading', { name: 'Not in this demo session' })).toBeVisible()
  await openLens(page)
  await expect(page.getByText('No openings marked yet.')).toBeVisible()
  await expect(page.getByText('No ways to the water recorded yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Compare fixes', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No fixes proposed yet' })).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await page.getByRole('button', { name: 'Mark the openings', exact: true }).click()
  await compare(page)
  await sendFix(page)
  const here = page.url()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Passes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
  await page.goto(here)
  await expect(page.getByRole('heading', { name: /^Fix .+ sent to .+ crew$/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open the repair check' })).toBeVisible()
})

test('AC81-5 after a failed re-test a new fix can be chosen and sent', async ({ page }) => {
  await openLens(page)
  await compare(page)
  await sendFix(page)
  const firstOrder = await page.getByRole('link', { name: 'Open the repair check' }).getAttribute('href')
  // The installer repairs it and the reviewer rejects the repair (the crew and re-test screens are other tasks').
  await page.evaluate(async () => {
    const { demo, refresh } = (window as unknown as { safeEdgeDemo: { demo: any; refresh: () => Promise<void> } })
      .safeEdgeDemo
    const wo = (await demo.listWorkOrders())[0]
    const installer = demo.as('usr_installer')
    await installer.startWorkOrder({ params: { id: wo.id } })
    await installer.completeWorkOrder({ params: { id: wo.id }, body: { evidence: [], note: 'Panel replaced' } })
    const finding = (await demo.listFindings())[0]
    const { routes } = await demo.previewRouteClosure({ params: { id: finding.segmentId }, body: { remedyIds: [] } })
    await demo.as('usr_reviewer').recordRetest({
      body: {
        workOrderId: wo.id,
        checklist: [
          { kind: 'route_check', subjectId: routes[0].id, result: 'fail', reason: 'Gap still open', measuredMm: 150 }
        ],
        evidence: [],
        result: 'rejected',
        reason: 'Gap still over 10 cm'
      }
    })
    await refresh()
  })
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Passes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
  await page.goBack()
  await expect(page.getByText('Fix B failed its re-test. Choose a fix again.')).toBeVisible()
  await expect(page.getByRole('heading', { name: /sent to/ })).toHaveCount(0)
  await expect(page.getByText('Failed its re-test', { exact: true })).toHaveCount(1)
  await expect(page.getByRole('radio', { name: /^B ·/ })).toHaveAccessibleDescription('Failed its re-test')
  await expect(page.getByRole('radio', { name: /^A ·/ })).not.toHaveAccessibleDescription('Failed its re-test')
  await expect(page.getByText('Approved by Lim Wei Jie')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Send fix to/ })).toBeDisabled()
  await expect(page.getByText('Choose a fix first.')).toBeVisible()
  await page.getByRole('radio', { name: /^B ·/ }).check()
  await page.getByRole('button', { name: /^Send fix B to .+ crew$/ }).click()
  await expect(page.getByRole('heading', { name: /^Fix B sent to .+ crew$/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open the repair check' })).not.toHaveAttribute('href', firstOrder!)
})

test('AC81-7 works in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await openLens(page)
  await compare(page)
  const bg = await page.locator('body').evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(bg).not.toBe('rgb(231, 235, 232)')
  await expect(page.getByText('Closes all 2 ways to the water')).toBeVisible()
})

test('AC81-8 the sample markings and fixes fill Fix Lens in one click each', async ({ page }) => {
  await openLens(page)
  await page.getByRole('button', { name: 'Use the S2 sample markings' }).click()
  await expect(page.getByText('2 openings and 2 ways recorded.')).toBeVisible()
  await page.getByRole('button', { name: 'Next: compare fixes' }).click()
  await page.getByRole('button', { name: 'Use the two sample fixes' }).click()
  await expect(page.getByText('Leaves 1 way to the water open, Playground path, around the fence end')).toBeVisible()
  await expect(page.getByText('Closes all 2 ways to the water')).toBeVisible()
})

test('AC81-8 a walk crew member sees no sample buttons on either step', async ({ page }) => {
  await openLens(page)
  await signInAs(page, 'Siti Aminah')
  await expect(page.getByRole('button', { name: 'Use the S2 sample markings' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Compare fixes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Use the two sample fixes' })).toHaveCount(0)
})

test('AC81-8 the sample fixes are offered only when the panel gap and the fence end are marked', async ({ page }) => {
  await openLens(page)
  await page.getByLabel('Add an opening: type').selectOption({ label: 'Gate' })
  await page.getByLabel('Across the photo').fill('30')
  await page.getByLabel('Down the photo').fill('60')
  await page.getByRole('button', { name: 'Add opening' }).click()
  await expect(page.getByRole('img', { name: /^Opening 1, Gate/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use the S2 sample markings' })).toHaveCount(0)
  await page.getByLabel('Name of the way').fill('Path through the gate')
  await page.getByRole('checkbox', { name: /^Opening 1, Gate/ }).check()
  await page.getByRole('button', { name: 'Add way to the water' }).click()
  await page.getByRole('button', { name: 'Next: compare fixes' }).click()
  await expect(page.getByRole('heading', { name: 'No fixes proposed yet' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use the two sample fixes' })).toHaveCount(0)
})
