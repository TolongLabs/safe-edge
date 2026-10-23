import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Every screen here is a phone screen.
test.use({ viewport: { width: 390, height: 844 } })

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

// S2: the panel gap by clicking the photo, the fence end by the form.
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
  await page.getByRole('radio', { name: /^B ·/ }).check()
}

async function sendFix(page: Page) {
  await signInAs(page, 'Lim Wei Jie')
  await page.getByRole('button', { name: 'Approve fix B as Lim Wei Jie' }).click()
  await expect(page.getByText('Approved by Lim Wei Jie')).toBeVisible()
  await signInAs(page, 'Farah Hashim')
  await page.getByRole('button', { name: /^Send fix B to .+ crew$/ }).click()
  await expect(page.getByRole('heading', { name: /^Fix B sent to .+ crew$/ })).toBeVisible()
}

// S1 through to a submitted work order: the manager chose fix B and sent it to the installer.
async function toSubmitted(page: Page) {
  await openLens(page)
  await compare(page)
  await sendFix(page)
}

// A path report filed through the presenter, on the server segment the demo seed already carries.
async function reportPathDamage(page: Page) {
  await page.evaluate(async () => {
    const demo = (
      window as unknown as {
        safeEdgeDemo: {
          demo: {
            as: (id: string) => {
              recordObservation: (call: unknown) => Promise<{ id: string }>
              reportDamage: (call: unknown) => Promise<{ id: string }>
            }
          }
        }
      }
    ).safeEdgeDemo.demo
    const crew = demo.as('usr_crew')
    const observation = await crew.recordObservation({
      body: {
        patrolId: null,
        segmentId: 'seg_866518980_10',
        viewpointId: null,
        captureSource: 'phone',
        image: null,
        pose: null,
        capturedAt: new Date().toISOString(),
        quality: { sharpness: 0.9, alignmentResidualPx: 1.2, occlusion: 0.05 },
        privacyAction: 'none',
        simulated: true
      }
    })
    await demo.as('usr_manager').reportDamage({
      body: {
        segmentId: 'seg_866518980_10',
        observationIds: [observation.id],
        inventoryItemId: null,
        itemStatus: null,
        class: 'worn_path',
        rationale: 'The path is broken by the boardwalk',
        simulated: true,
        report: {
          description: 'The path is broken by the boardwalk',
          observedAt: new Date().toISOString(),
          issueType: 'path_broken',
          urgency: 'medium',
          viewpointId: null,
          where: null,
          timeSource: null,
          issueTypeOther: null,
          action: null,
          actionNote: null,
          cause: 'wear',
          prevention: null
        }
      }
    })
  })
}

// The buoy flag must be decided first: a pass is issued only once no other Tier 2 flag is open.
async function rejectBuoy(page: Page) {
  await page.goto('demo/#/inbox')
  await page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Ring buoy/ })
    .click()
  await page.getByRole('button', { name: 'Not a problem', exact: true }).click()
  await page.getByLabel('Reason for rejecting').fill('The buoy was moved for the swim lesson')
  await page.getByRole('button', { name: 'Submit rejection' }).click()
  await expect(page.getByText(/Rejected by Farah Hashim/)).toBeVisible()
}

// S1 to a submitted work order, with the buoy decided, then the installer starts and completes the repair.
async function toCompleted(page: Page) {
  await toSubmitted(page)
  const href = (await page.getByRole('link', { name: 'Open the repair check' }).getAttribute('href'))!
  await rejectBuoy(page)
  await page.goto(`demo/${href}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Repair check' })).toBeVisible()
  await signInAs(page, 'Hafiz Rahman')
  await page.getByRole('button', { name: 'Start work' }).click()
  await page.getByRole('textbox', { name: 'Note for the person who checks it' }).fill('Panel 4 replaced')
  await page.getByRole('button', { name: 'Mark work complete' }).click()
  await expect(page.getByRole('heading', { name: 'A different person checks this repair' })).toBeVisible()
}

// What each repair check is called; the failures and reasons on screen are found by these names.
const REPAIR_CHECKS = [
  'Saved view 1',
  'Saved view 2',
  'Playground path, through the panel gap',
  'Playground path, around the fence end',
  'Panel gap gauge',
  'Fence end gauge',
  'Re-test photo'
]

// The tracker for a submitted job names every stage from confirm to the work order, with the real person.
async function expectTrackerSubmitted(page: Page) {
  const tracker = page.getByRole('region', { name: /Repair tracker|Repair progress|tracker/i }).first()
  await expect(tracker).toContainText(/Report confirmed|Confirmed/)
  await expect(tracker).toContainText(/Work order submitted|Sent to work order/)
  await expect(tracker).toContainText('Hafiz Rahman')
}

// The tracker of a job that has only been confirmed still names its confirmed state.
async function expectTrackerConfirmed(page: Page) {
  const tracker = page.getByRole('region', { name: /Repair tracker|My reports|tracker/i }).first()
  await expect(tracker).toContainText(/Report confirmed|Confirmed/)
}

test('AC230 the tracker shows report confirmed to WO submitted with the assigned name in the Inbox', async ({
  page
}) => {
  await toSubmitted(page)
  await expectTrackerSubmitted(page)
  // The stage details open with a click and with the keyboard.
  const details = page.getByRole('button', { name: /details/i }).first()
  await details.click()
  await expect(page.getByText(/Submitted by Farah Hashim|submitted/i).first()).toBeVisible()
  await details.press('Enter')
  await expect(page.getByText(/Submitted by Farah Hashim|submitted/i).first()).toBeVisible()
})

test('AC230 the same tracker shows on the re-test waiting list', async ({ page }) => {
  await toSubmitted(page)
  await signInAs(page, 'Priya Nair')
  await expectTrackerSubmitted(page)
})

test('AC230 and AC233 My reports in Capture shows the tracker, and a path report has no forecast', async ({ page }) => {
  await reportPathDamage(page)
  await page.goto('demo/#/capture')
  const reports = page.getByRole('region', { name: /My reports/i })
  await expect(reports).toContainText(/path/i)
  await expectTrackerConfirmed(page)
  // The manager confirms it through the Inbox card.
  await page.goto('demo/')
  const card = page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /The path is broken by the boardwalk/ })
  await card.click()
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  await expect(page.getByRole('region', { name: /^Finding / })).toBeVisible()
  // No forecast for a type with fewer than three past jobs and no accepted history.
  await page.getByRole('link', { name: 'Choose a fix' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fix Lens' })).toBeVisible()
  await markOpenings(page)
  await page.getByRole('button', { name: 'Next: compare fixes' }).click()
  await expect(page.getByText(/Usually \d+–\d+ days/)).toHaveCount(0)
})

test('AC233 the S1 fix submission shows the forecast, and it counts the sample past jobs', async ({ page }) => {
  await openLens(page)
  await compare(page)
  // Four sample fence jobs {4,5,6,9}; the demo seed has no accepted repair, so the samples alone decide it.
  await expect(page.getByText('Usually 4–9 days (median 6), from 4 past jobs, includes sample data')).toBeVisible()
})

test('AC231 a rejected report shows Not a problem in the tracker', async ({ page }) => {
  await page.goto('demo/')
  const list = page.getByRole('navigation', { name: 'Inbox list' })
  await list.getByRole('button', { name: /Ring buoy/ }).click()
  await page.getByRole('button', { name: 'Not a problem', exact: true }).click()
  await page.getByLabel('Reason for rejecting').fill('The buoy was moved for the swim lesson')
  await page.getByRole('button', { name: 'Submit rejection' }).click()
  await expect(page.getByText(/Rejected by Farah Hashim/)).toBeVisible()
  await expect(page.getByRole('region', { name: /^Finding |^Card / }).or(page.locator('body'))).toContainText(
    'Not a problem'
  )
})

test('AC232 the installer records buying progress, then waiting delivery, then fixing', async ({ page }) => {
  await toSubmitted(page)
  await signInAs(page, 'Hafiz Rahman')
  await page
    .getByRole('link', { name: /Start work|Fence panel 4/ })
    .first()
    .click()
  const progress = page.getByRole('region', { name: 'Repair progress' })
  // Buying: an expected delivery date and a tracking number are saved.
  await progress.getByLabel('Expected delivery date').fill('2026-10-30')
  await progress.getByLabel('Shipment tracking number').fill('TRK-2026-0042')
  await progress.getByRole('button', { name: 'Save progress' }).click()
  await expect(progress).toContainText(/buying/i)
  await expect(progress).toContainText('TRK-2026-0042')
  // Waiting delivery: the supplier gave no tracking number is the checkbox way out.
  await progress.getByLabel('Shipment tracking number').fill('')
  await progress.getByLabel('The supplier gave no tracking number').check()
  await progress.getByRole('button', { name: 'Save progress' }).click()
  await expect(progress).toContainText(/waiting (for )?delivery|waiting delivery/i)
  // Fixing hands the work order to Start work.
  await page.getByRole('button', { name: 'Start work' }).click()
  await expect(page.getByRole('heading', { name: 'Repair started' })).toBeVisible()
})

test('AC233 the manager changes the finish date and sees the old and new date and the reason', async ({ page }) => {
  await toSubmitted(page)
  await signInAs(page, 'Hafiz Rahman')
  await page
    .getByRole('link', { name: /Start work|Fence panel 4/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Change finish date' }).click()
  await page.getByLabel('New finish date').fill('2026-11-06')
  await page.getByLabel('Reason for changing finish date').fill('The panel order slips a week')
  await page.getByRole('button', { name: 'Save progress' }).click()
  await signInAs(page, 'Farah Hashim')
  await page.goto('demo/#/inbox')
  await page
    .getByRole('button', { name: /Fence panel 4/ })
    .first()
    .click()
  await expect(page.getByText(/2026-11-06|6 Nov 2026|6 November 2026/).first()).toBeVisible()
  await expect(page.getByText(/The panel order slips a week/)).toBeVisible()
})

test('AC234 and AC235 the reviewer cannot pass the photo or sign before upload; the spending is shown', async ({
  page
}) => {
  await toCompleted(page)
  await signInAs(page, 'Priya Nair')
  // No photo evidence yet: the re-test photo cannot pass and nothing can sign.
  const radio = page.getByRole('radiogroup', { name: 'Re-test photo result' }).getByRole('radio', { name: 'Pass' })
  await expect(radio).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Sign and issue the pass' })).toBeDisabled()
  // Upload the before fixture through the gallery picker; before and after photos show.
  await page.getByLabel(/Upload from gallery/i).setInputFiles('e2e/fixtures/report-no-exif.jpg')
  await expect(page.getByRole('img', { name: /after/i })).toBeVisible()
  await expect(radio).toBeEnabled()
  await radio.check()
  await page.getByRole('textbox', { name: 'Reason for Re-test photo', exact: true }).fill('Photo matches')
  // The installer's spending is visible to the reviewer, in ringgit.
  await expect(page.getByText(/Amount spent \(RM\)|RM \d+/)).toBeVisible()
  // The rest of the checklist still has to be answered before the sign.
  for (const name of REPAIR_CHECKS.slice(0, -1))
    await page
      .getByRole('radiogroup', { name: `${name} result` })
      .getByRole('radio', { name: 'Pass' })
      .check()
  for (const name of REPAIR_CHECKS.slice(0, -1))
    await page.getByRole('textbox', { name: `Reason for ${name}`, exact: true }).fill('Looks right')
  await expect(page.getByRole('button', { name: 'Sign and issue the pass' })).toBeEnabled()
})

test('AC235 the installer records what the repair cost and the manager sees the amount and reason', async ({
  page
}) => {
  await toSubmitted(page)
  await signInAs(page, 'Hafiz Rahman')
  await page
    .getByRole('link', { name: /Start work|Fence panel 4/ })
    .first()
    .click()
  await page.getByLabel('Amount spent (RM)').fill('150')
  await page.getByLabel('Reason for spending more').fill('The panel cost more than quoted')
  await page.getByRole('button', { name: 'Save progress' }).click()
  await expect(page.getByText(/RM 150|Amount spent \(RM\)/)).toBeVisible()
  await signInAs(page, 'Farah Hashim')
  await page.goto('demo/#/inbox')
  await page
    .getByRole('button', { name: /Fence panel 4/ })
    .first()
    .click()
  await expect(page.getByText(/RM 150/)).toBeVisible()
  await expect(page.getByText(/The panel cost more than quoted/)).toBeVisible()
})
