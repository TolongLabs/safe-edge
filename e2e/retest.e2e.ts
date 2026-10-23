import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { uploadRetestPhoto } from './repair-photo'

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
    .getByRole('button', { name: /Playground path, fence line/ })
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
const CLEARANCE_CHECKS = ['Saved view 1', 'Saved view 2', 'Re-test photo']

async function answer(page: Page, checks: string[], failing?: string) {
  for (const name of checks) {
    await page
      .getByRole('radiogroup', { name: `${name} result` })
      .getByRole('radio', { name: name === failing ? 'Fail' : 'Pass' })
      .check()
    await page.getByRole('textbox', { name: `Reason for ${name}`, exact: true }).fill('Seen on site')
  }
}

// S1 to a sent work order (the manager sends fix B to the installer), then the repair check.
async function toSent(page: Page, decideBuoy = true) {
  await openLens(page)
  await compare(page)
  await sendFix(page)
  // A pass is issued only once no other Tier 2 flag is open on the segment, so the buoy flag is decided first.
  const href = (await page.getByRole('link', { name: 'Open the repair check' }).getAttribute('href'))!
  if (decideBuoy) await rejectBuoy(page)
  await page.goto(`demo/${href}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Repair check' })).toBeVisible()
}

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

async function toCompleted(page: Page, decideBuoy = true) {
  await toSent(page, decideBuoy)
  await signInAs(page, 'Hafiz Rahman')
  await page.getByRole('button', { name: 'Start work' }).click()
  await page
    .getByRole('textbox', { name: 'Note for the person who checks it' })
    .fill('Panel 4 replaced, fence extended')
  await page.getByRole('button', { name: 'Mark work complete' }).click()
  await expect(page.getByRole('heading', { name: 'A different person checks this repair' })).toBeVisible()
}

type Demo = {
  as: (id: string) => {
    listWorkOrders: () => Promise<{ id: string; status: string }[]>
    recordRetest: (call: unknown) => Promise<unknown>
  }
}

test('AC82-1 and AC82-3 the installer starts and completes, and never sees the sign action', async ({ page }) => {
  await toSent(page)
  await expect(page.getByText('Waiting for Hafiz Rahman to do the repair.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start work' })).toHaveCount(0)
  // Roles that cannot read flags see the repairs at once, read-only.
  await signInAs(page, 'Rosli Ahmad')
  await page.goto('demo/#/retest')
  await expect(page.getByRole('heading', { name: 'Repairs in progress' })).toBeVisible()
  await expect(page.getByText('Hafiz Rahman does the repair next')).toBeVisible()
  await signInAs(page, 'Hafiz Rahman')
  await page.goto('demo/#/retest')
  await expect(page.getByRole('link', { name: /Start work/ })).toBeVisible()
  await expect(page.getByText('simulated')).toHaveCount(0)
  await page.getByRole('link', { name: /Fence panel 4/ }).click()
  await expect(page.getByRole('img', { name: /^Work at opening 1/ })).toBeVisible()
  await page.getByRole('button', { name: 'Start work' }).click()
  await expect(page.getByRole('heading', { name: 'Repair started' })).toBeVisible()
  const done = page.getByRole('button', { name: 'Mark work complete' })
  await expect(done).toBeDisabled()
  await page.getByRole('textbox', { name: 'Note for the person who checks it' }).fill('Panel 4 replaced')
  await done.click()
  await expect(page.getByRole('heading', { name: 'A different person checks this repair' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Sign and issue the pass/ })).toHaveCount(0)
  // Core refuses the installer even when asked another way: the role check comes first.
  const refused = await page.evaluate(async () => {
    const demo = (window as unknown as { safeEdgeDemo: { demo: Demo } }).safeEdgeDemo.demo
    const [wo] = (await demo.as('usr_installer').listWorkOrders()).filter((w) => w.status === 'completed')
    try {
      await demo.as('usr_installer').recordRetest({
        body: {
          workOrderId: wo!.id,
          checklist: [{ kind: 'photo', subjectId: null, result: 'pass', reason: 'x', measuredMm: null }],
          evidence: [],
          result: 'accepted',
          reason: 'x'
        }
      })
      return null
    } catch (e) {
      return (e as { rule?: string }).rule ?? String(e)
    }
  })
  expect(refused).toBe('role_forbidden')
})

test('AC82-2 and AC82-4 the reviewer checks, signs, and the pass shows where it came from', async ({ page }) => {
  await toCompleted(page)
  await signInAs(page, 'Priya Nair')
  await expect(
    page.getByText(
      /^Fixed by Hafiz Rahman (today|\d+ \w+) at \d\d:\d\d\. You did not install it, so you can check it\.$/
    )
  ).toBeVisible()
  await expect(page.getByText('Sample reading, not measured on site')).toHaveCount(0)
  await expect(page.getByText('Before photo unavailable', { exact: true })).toBeVisible()
  // Phone screens sit on the canvas with white cards, in both themes.
  const main = page.getByRole('main')
  await expect(main).toHaveCSS('background-color', 'rgb(231, 235, 232)')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(main).toHaveCSS('background-color', 'rgb(17, 26, 23)')
  const sign = page.getByRole('button', { name: 'Sign and issue the pass' })
  await expect(sign).toBeDisabled()
  const total = REPAIR_CHECKS.length
  await expect(page.getByText(`0 of ${total} checks passed`)).toBeVisible()
  await uploadRetestPhoto(page)
  for (const name of REPAIR_CHECKS)
    await page
      .getByRole('radiogroup', { name: `${name} result` })
      .getByRole('radio', { name: 'Pass' })
      .check()
  await expect(sign).toBeDisabled()
  await expect(page.getByText(`Write a reason for ${total} more checks.`)).toBeVisible()
  for (const name of REPAIR_CHECKS.slice(0, -1))
    await page.getByRole('textbox', { name: `Reason for ${name}`, exact: true }).fill('Looks right')
  await expect(sign).toBeDisabled()
  await expect(page.getByText('Write a reason for 1 more check.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Reason for Re-test photo' }).fill('Photo matches')
  await expect(sign).toBeEnabled()
  await expect(page.getByText(`${total} of ${total} checks passed`)).toBeVisible()
  // A failed check turns the pass off and offers the failing path instead.
  await expect(page.getByRole('button', { name: 'Fail this repair' })).toHaveCount(0)
  const first = page.getByRole('radiogroup', { name: 'Saved view 1 result' })
  await first.getByRole('radio', { name: 'Fail' }).check()
  await expect(sign).toBeDisabled()
  await expect(page.getByText('A failed check cannot be signed as a pass. Use Fail this repair.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fail this repair' })).toBeEnabled()
  await first.getByRole('radio', { name: 'Pass' }).check()
  await sign.click()

  await expect(page.getByRole('heading', { name: 'Safety pass issued' })).toBeVisible()
  await expect(main).toHaveCSS('background-color', 'rgb(28, 41, 37)')
  // The pass lasts at most 12 months.
  const shown = (await page.getByText(/^Valid to /).textContent())!.replace('Valid to ', '')
  // The memory demo runs on the page's own clock, so the date is judged against that clock.
  const now = await page.evaluate(() => Date.now())
  const validTo = new Date(`${shown} UTC`).getTime()
  expect(validTo).toBeGreaterThan(now)
  expect(validTo).toBeLessThanOrEqual(now + 366 * 24 * 3600 * 1000)
  await expect(page.getByText(/^All 2 ways to the water at .+ are closed\./)).toBeVisible()
  await expect(page.getByText('Issued by Priya Nair')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Routes covered' }).getByRole('listitem')).toHaveCount(2)
  await expect(page.getByRole('region', { name: 'Re-tests' }).getByText('Re-test 1 · accepted')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to Inbox' })).toBeVisible()
  await expect(page.getByText(/can read this timeline\./)).toBeVisible()

  await signInAs(page, 'Farah Hashim')
  const timeline = page.getByRole('region', { name: 'How it got here' })
  await expect(timeline.getByText('Checked and signed')).toHaveCount(1)
  await expect(timeline.getByText('Priya Nair')).toBeVisible()
  await expect(timeline.getByText('Drone spotted something')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/\b(cand|rt|seg|wo|fnd)_\w+/)
})

test('AC82-4 a pass held by another open flag is cleared by the false-alarm check', async ({ page }) => {
  await toCompleted(page, false)
  await signInAs(page, 'Priya Nair')
  await expect(
    page.getByText(
      'A pass is issued only if no other flag on this edge is still open. A manager decides open flags in the Inbox.'
    )
  ).toBeVisible()
  await uploadRetestPhoto(page)
  await answer(page, REPAIR_CHECKS)
  await page.getByRole('button', { name: 'Sign and issue the pass' }).click()
  await expect(page.getByRole('heading', { name: 'Repair checked and accepted' })).toBeVisible()
  await expect(page.getByText(/No pass has been issued yet\. Still open on this edge: .*Ring buoy moved/)).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/\b(cand|rt|seg|wo|fnd)_\w+/)
  await expect(page.getByRole('link', { name: 'Open the pass' })).toHaveCount(0)
  // A flag still waiting for the manager is not offered for a clearance check.
  await page.goto('demo/#/retest')
  await expect(page.getByRole('heading', { name: 'No repairs are waiting' })).toBeVisible()
  await expect(page.getByText('No repair is waiting for a check right now.')).toBeVisible()
  await expect(page.getByText('Check a false alarm')).toHaveCount(0)
  // The manager decides the open flag and sees the false alarm read-only.
  await signInAs(page, 'Farah Hashim')
  await rejectBuoy(page)
  await page.goto('demo/#/retest')
  await expect(page.getByRole('link', { name: /Check a false alarm: Ring buoy moved/ })).toBeVisible()
  await expect(page.getByText('A reviewer checks this false alarm')).toBeVisible()
  // A role that may not read flags sees who checks it, not an error.
  const flagLink = await page.getByRole('link', { name: /Check a false alarm: Ring buoy moved/ }).getAttribute('href')
  await signInAs(page, 'Rosli Ahmad')
  await page.goto(`demo/${flagLink}`)
  await expect(page.getByRole('heading', { name: 'A reviewer checks this false alarm' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.goto('demo/#/retest')
  // The reviewer checks it and the pass is issued.
  await signInAs(page, 'Priya Nair')
  await page.getByRole('link', { name: /Check a false alarm: Ring buoy moved/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Check a false alarm' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/\b(cand|rt|seg|wo|fnd)_\w+/)
  await expect(page.getByRole('button', { name: 'Sign and clear this flag' })).toBeDisabled()
  await expect(page.getByText('Before photo unavailable', { exact: true })).toBeVisible()
  await uploadRetestPhoto(page)
  await answer(page, CLEARANCE_CHECKS)
  await page.getByRole('button', { name: 'Sign and clear this flag' }).click()
  await expect(page.getByRole('heading', { name: 'Safety pass issued' })).toBeVisible()
  // This pass names no route, so it claims no closure.
  await expect(page.getByText('No way to the water is named by this pass.')).toBeVisible()
  await expect(page.getByText(/is closed\.|are closed\./)).toHaveCount(0)
  // A cleared flag is not offered again.
  await page.goto('demo/#/retest')
  await expect(page.getByText('Check a false alarm')).toHaveCount(0)
})

test('AC82-7 a cleared flag is not offered again while another flag still holds the pass', async ({ page }) => {
  // No repair here: the manager calls the fence flag not a problem and sends the buoy flag to look again, which
  // core keeps as an open suspicion until it is cleared too.
  await page.goto('demo/')
  const list = page.getByRole('navigation', { name: 'Inbox list' })
  await list.getByRole('button', { name: /Playground path, fence line/ }).click()
  await page.getByRole('button', { name: 'Not a problem', exact: true }).click()
  await page.getByLabel('Reason for rejecting').fill('Panel removed on purpose')
  await page.getByRole('button', { name: 'Submit rejection' }).click()
  await expect(page.getByText(/Rejected by Farah Hashim/)).toBeVisible()
  await list.getByRole('button', { name: /Playground path, ring buoy post/ }).click()
  await page.getByRole('button', { name: 'Look again', exact: true }).click()
  await signInAs(page, 'Priya Nair')
  await page.goto('demo/#/retest')
  await expect(page.getByRole('link', { name: /Check a false alarm: Fence panel 4 missing/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Check a false alarm: Ring buoy moved/ })).toBeVisible()
  await page.getByRole('link', { name: /Check a false alarm: Fence panel 4 missing/ }).click()
  await uploadRetestPhoto(page)
  await answer(page, CLEARANCE_CHECKS)
  await page.getByRole('button', { name: 'Sign and clear this flag' }).click()
  await expect(page.getByRole('heading', { name: 'False alarm checked' })).toBeVisible()
  await expect(page.getByText(/No pass has been issued yet\. Still open on this edge: .*Ring buoy moved/)).toBeVisible()
  await page.goto('demo/#/retest')
  await expect(page.getByRole('link', { name: /Check a false alarm: Ring buoy moved/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Check a false alarm: Fence panel 4 missing/ })).toHaveCount(0)
})

test('AC82-2 a failed re-test reopens the finding and a new fix can be sent', async ({ page }) => {
  await toCompleted(page)
  await signInAs(page, 'Priya Nair')
  await uploadRetestPhoto(page)
  await answer(page, REPAIR_CHECKS, 'Saved view 1')
  await page.getByRole('button', { name: 'Fail this repair' }).click()
  await expect(
    page.getByText('This repair failed its check. The finding is open again. A manager chooses a new fix in Fix Lens.')
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open the pass' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Open Fix Lens' }).click()
  await signInAs(page, 'Farah Hashim')
  await expect(page.getByText('Fix B failed its re-test. Choose a fix again.')).toBeVisible()
  await page.getByRole('radio', { name: /^B ·/ }).check()
  await page.getByRole('button', { name: /^Send fix B to .+ crew$/ }).click()
  await expect(page.getByRole('heading', { name: /^Fix B sent to .+ crew$/ })).toBeVisible()
  // The new order waits on the installer's list.
  await signInAs(page, 'Hafiz Rahman')
  await page.goto('demo/#/retest')
  await expect(page.getByRole('heading', { name: 'Repairs for you' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Fence panel 4 missing.*Submitted.*Start work/ })).toBeVisible()
})

test.describe('AC82-6 the guest link', () => {
  test('as=reviewer opens the re-test list, keeps the address, and survives a reload', async ({ page }) => {
    await page.goto('demo/?as=reviewer')
    await expect(page).toHaveURL(/\/demo\/\?as=reviewer$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Repair check' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Priya Nair, Reviewer/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No repairs are waiting' })).toBeVisible()
    await expect(page.getByText('This does not mean the lake edge is safe')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: /^Priya Nair, Reviewer/ })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Repair check' })).toBeVisible()
  })

  test('a tab that remembers a person ignores as', async ({ page }) => {
    await page.goto('demo/?as=reviewer')
    await expect(page.getByRole('button', { name: /^Priya Nair, Reviewer/ })).toBeVisible()
    await signInAs(page, 'Farah Hashim')
    await page.reload()
    await expect(page.getByRole('button', { name: /^Farah Hashim, Park manager/ })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()
  })

  test('as=manager opens the Inbox as the manager', async ({ page }) => {
    await page.goto('demo/?as=manager')
    await expect(page).toHaveURL(/\/demo\/\?as=manager$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()
  })

  test('any other as value is ignored', async ({ page }) => {
    await page.goto('demo/?as=nobody')
    await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()
  })
})

test('AC1 no rendered text on Retest contains Tier', async ({ page }) => {
  await page.goto('demo/#/retest')
  await expect(page.getByRole('heading', { level: 1, name: 'Repair check' })).toBeVisible()
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toMatch(/\bTier\b/i)
})
