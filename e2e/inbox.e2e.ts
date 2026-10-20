import type { Page } from '@playwright/test'
import type { MemoryClient } from '@safe-edge/sdk'
import { expect, test } from './fixtures'

// The page's presenter handle (apps/web/src/store.ts); typed here so the root typecheck stays free of the app's JSX.
type Presenter = { demo: MemoryClient; refresh: () => Promise<void> }

// The demo core assigns IDs in order: the four sample cards are cand_1 (S1) to cand_4.
const S1 = 'cand_1'
const BUOY = 'cand_2'
const PATH = 'cand_3'
const FIELD = 'cand_4'
const card = (page: Page, id: string) => page.getByRole('article', { name: `Card ${id}` })
const open = (page: Page, title: string) =>
  page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: new RegExp(title) })
    .click()
const resetDemo = async (page: Page) => {
  await page.getByRole('button', { name: /Farah Hashim/ }).click()
  await page.getByRole('button', { name: 'Reset demo' }).click()
}
const list = (page: Page, group: 'Open' | 'Decided') => page.getByRole('list', { name: group })

// What other people do between the manager's steps, made through the demo core as them (the Fix Lens and crew screens
// are not built yet). The page exposes a presenter's handle for this.
async function otherPeopleAct(page: Page) {
  await page.evaluate(async () => {
    const { demo, refresh } = (window as unknown as { safeEdgeDemo: Presenter }).safeEdgeDemo
    const finding = (await demo.listFindings())[0]
    const wo = (await demo.listWorkOrders())[0]
    if (!finding || !wo) throw new Error('Confirm a card before the other people act')
    const task = (await demo.listTasks()).find((t) => t.findingId === finding.id)
    if (!task) throw new Error('No interim task for the finding')
    await demo.as('usr_crew').completeTask({ params: { id: task.id } })
    const gap = await demo.createOpening({
      body: {
        segmentId: finding.segmentId,
        type: 'fence_gap',
        photoMarks: [{ evidenceId: 'evd_s1_photo', x: 0.45, y: 0.6 }],
        measuredMm: 1200
      }
    })
    const remedy = await demo.as('usr_engineer').createRemedy({
      body: {
        segmentId: finding.segmentId,
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
}

test.beforeEach(async ({ page }) => {
  await page.goto('demo/')
  await expect(card(page, S1).getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
})

test('AC1 S1 card shows its evidence', async ({ page }) => {
  const c = card(page, S1)
  await expect(c.getByRole('heading', { name: /Fence panel 4 missing/ })).toBeVisible()
  await expect(c.getByRole('img', { name: /Before image/ })).toBeVisible()
  await expect(c.getByRole('img', { name: /After image/ })).toBeVisible()
  await expect(c.getByRole('img', { name: 'Flagged region: Fence panel 4 missing' })).toBeVisible()
  await expect(c.getByRole('img', { name: 'Zoomed crop of the flagged region' })).toBeVisible()
  await expect(c.getByText('Elmina Central Park lake, segment 12')).toBeVisible()
  await expect(c.getByText('Segment seg_866518980_11')).toBeAttached()
  await expect(c.getByText('The safety pass for this fence is paused until it is fixed')).toBeVisible()
  await expect(c.getByRole('figure').filter({ hasText: 'Drone' }).getByText('19 Oct 2026, 15:48 MYT')).toBeVisible()
  await expect(c.getByText('How sure: high')).toBeVisible()
  await expect(c.getByText('Tier 2 · a person confirms')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Tier 2 · a person confirms' }).first()).toBeVisible()
  await expect(c.getByText(/AI label: missing/)).toBeVisible()
  await expect(c.getByText(/AI confidence 82%/)).toBeVisible()
  await expect(c.getByText(/AI suggestion, unvalidated/)).toBeVisible()
  await expect(c.getByText(/Uncertainty: low/)).toBeVisible()
  await expect(c.getByText(/Reason: Panel 4 is in the baseline/)).toBeVisible()
  await expect(c.getByText(/Simulated, source provider/)).toBeVisible()
  // the summary is sample text, never claimed as the agent's
  await expect(c.getByText(/Sample summary, not written by the agent: .*obs_\d+, cand_1/)).toBeVisible()
  await expect(page.getByText('Drafted by agent')).toHaveCount(0)
  await expect(c.getByText(/^Before · \d+ \w+$/)).toBeVisible()
  await expect(c.getByText(/Accepted by .* · simulated/)).toBeVisible()
  await expect(c.getByText(/Drone · simulated/)).toBeVisible()
})

test('AC1 Tier 3 card shows images and core field task only', async ({ page }) => {
  await open(page, 'Fence panel 3 not visible')
  const c = card(page, FIELD)
  await expect(c.getByRole('img', { name: /Before image/ })).toBeVisible()
  await expect(c.getByRole('img', { name: /After image/ })).toBeVisible()
  await expect(c.getByText(/Viewpoint: Lake bank, fence line under tree cover/)).toBeVisible()
  await expect(c.getByText('Not visible: unknown, never a pass')).toBeVisible()
  await expect(c.getByRole('img', { name: /Flagged region/ })).toHaveCount(0)
  await expect(c.getByRole('img', { name: /Zoomed crop/ })).toHaveCount(0)
  await expect(c.getByText(/AI confidence/)).toHaveCount(0)
  await expect(c.getByText(/^Pass /)).toHaveCount(0)
  const task = c.getByRole('region', { name: /^Task / })
  await expect(task.getByText(/Fence panel 3 was not visible .*check it in the field/)).toBeVisible()
  await expect(task.getByText(/Assigned to Farah Hashim/)).toBeVisible()
  // AC2: only Recapture
  await expect(page.getByRole('button', { name: 'Look again', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm: needs a fix', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Not a problem', exact: true })).toHaveCount(0)
})

test('AC2 reject needs a reason', async ({ page }) => {
  await page.getByRole('button', { name: 'Not a problem', exact: true }).click()
  const submit = page.getByRole('button', { name: 'Submit rejection' })
  await expect(submit).toBeDisabled()
  await expect(page.getByText('Type a reason to enable this.')).toBeVisible()
  await page.getByLabel('Reason for rejecting').fill('   ')
  await expect(submit).toBeDisabled()
  await page.getByLabel('Reason for rejecting').fill('Panel was removed on purpose for repainting')
  await submit.click()
  const c = card(page, S1)
  await expect(c.getByText(/Rejected by Farah Hashim/)).toBeVisible()
  await expect(c.getByText(/Reason: Panel was removed on purpose/)).toBeVisible()
  await expect(list(page, 'Decided').getByRole('button', { name: /Fence panel 4/ })).toBeVisible()
  await expect(list(page, 'Open').getByRole('button', { name: /Fence panel 4/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirm: needs a fix', exact: true })).toHaveCount(0)
})

test('AC2 the rejected banner is scrolled into view after submitting', async ({ page }) => {
  await page.getByRole('button', { name: 'Not a problem', exact: true }).click()
  await page.getByLabel('Reason for rejecting').fill('Panel was removed on purpose for repainting')
  await page.getByRole('button', { name: 'Submit rejection' }).click()
  await expect(card(page, S1).getByText(/Rejected by Farah Hashim/)).toBeInViewport()
})

test('AC2 recapture records the re-shoot request', async ({ page }) => {
  await page.getByRole('button', { name: 'Look again', exact: true }).click()
  await expect(
    card(page, S1).getByText(
      /Needs recapture by Farah Hashim \(manager\)\. Re-shoot viewpoint: Playground path, fence line/
    )
  ).toBeVisible()
  // Core opens a recapture task for the decision (#139).
  await expect(
    page.getByRole('region', { name: /^Task / }).getByRole('heading', { name: 'Recapture task' })
  ).toBeVisible()
})

test('AC3 AC7 confirm opens work and labels every record', async ({ page }) => {
  await page.getByLabel('Severity (pre-filled, you can change it)').selectOption('medium')
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  const c = card(page, S1)
  await expect(c.getByText(/Confirmed by Farah Hashim/)).toBeVisible()
  const finding = page.getByRole('region', { name: /^Finding / })
  await expect(finding.getByText(/Status: open/)).toBeVisible()
  await expect(finding.getByText(/Severity: medium/)).toBeVisible()
  await expect(finding.getByText(/Owner: Farah Hashim/)).toBeVisible()
  const task = page.getByRole('region', { name: /^Task / })
  await expect(task.getByText(/Protect or close the approach/)).toBeVisible()
  await expect(task.getByText(/Status: open/)).toBeVisible()
  const wo = page.getByRole('region', { name: /^Work order / })
  await expect(wo.getByText(/Status: draft\. Drafted by Farah Hashim \(manager\)\./)).toBeVisible()
  await expect(page.getByText('Drafted by agent')).toHaveCount(0)
  // AC7: Sample badge on card, finding, task and work order
  for (const r of [c, finding, task, wo]) await expect(r.getByText('Sample', { exact: true }).first()).toBeVisible()
})

test('AC5 confirming is one click and opens all three records', async ({ page }) => {
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  await expect(page.getByRole('region', { name: /^Finding / })).toBeVisible()
  await expect(page.getByRole('region', { name: /^Task / })).toBeVisible()
  const wo = page.getByRole('region', { name: /^Work order / })
  await expect(wo).toBeVisible()
  await expect(wo.getByRole('button', { name: 'Submit work order' })).toBeDisabled()
  await expect(wo.getByText('Needs a repair approved by the engineer in Fix Lens (#81).')).toBeVisible()
  await expect(wo.getByText(/Interim protection is not done yet/)).toBeVisible()
})

test('AC4 submit once the other people have done their steps', async ({ page }) => {
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  const wo = page.getByRole('region', { name: /^Work order / })
  await expect(wo.getByRole('button', { name: 'Submit work order' })).toBeDisabled()
  await otherPeopleAct(page)
  await expect(wo.getByRole('button', { name: 'Submit work order' })).toBeEnabled()
  await wo.getByLabel('Work order text').fill('')
  await expect(wo.getByRole('button', { name: 'Submit work order' })).toBeDisabled()
  await expect(wo.getByText('Add work order text.')).toBeVisible()
  await wo.getByLabel('Work order text').fill('Edited by the manager: replace panel 4 and barricade.')
  // one click submits once its conditions hold
  await wo.getByRole('button', { name: 'Submit work order' }).click()
  await expect(wo.getByText(/Status: submitted\..*Submitted by Farah Hashim/)).toBeVisible()
  await expect(wo.getByText('Edited by the manager: replace panel 4 and barricade.')).toBeVisible()
  await expect(page.getByRole('region', { name: /^Finding / }).getByText(/Status: work_ordered/)).toBeVisible()
})

test('AC6 blind-first hides the AI view of Tier 2 until the manager picks a label', async ({ page }) => {
  await page.getByLabel('Blind-first mode').check()
  const c = card(page, S1)
  // the title would give the AI conclusion away, in the detail pane and in the list
  await expect(page.getByText('Fence panel 4 missing')).toHaveCount(0)
  await expect(page.getByText('Ring buoy moved')).toHaveCount(0)
  await expect(c.getByRole('heading', { name: 'Tier 2 flag: Playground path, fence line' })).toBeVisible()
  await expect(c.getByText(/AI label/)).toHaveCount(0)
  await expect(c.getByText(/AI confidence/)).toHaveCount(0)
  await expect(c.getByText(/Reason: Panel 4/)).toHaveCount(0)
  await expect(c.getByText(/Sample summary/)).toHaveCount(0)
  await expect(c.getByRole('img', { name: /Flagged region/ })).toHaveCount(0)
  await expect(c.getByRole('img', { name: /Zoomed crop/ })).toHaveCount(0)
  for (const n of ['Confirm: needs a fix', 'Not a problem', 'Look again'])
    await expect(page.getByRole('button', { name: n, exact: true })).toBeDisabled()
  await page.getByRole('radio', { name: 'changed' }).click()
  await expect(c.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  await expect(c.getByText(/AI label: missing/)).toBeVisible()
  await expect(c.getByText(/Your label: changed\. Differs with the AI label/)).toBeVisible()
  await expect(c.getByRole('img', { name: /Flagged region/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm: needs a fix', exact: true })).toBeEnabled()
})

test('AC6 blind-first does not affect Tier 1 and Tier 3', async ({ page }) => {
  await page.getByLabel('Blind-first mode').check()
  await open(page, 'Worn path')
  await expect(card(page, PATH).getByText(/AI label: general change/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm: needs a fix', exact: true })).toBeEnabled()
  await open(page, 'Fence panel 3 not visible')
  await expect(page.getByRole('button', { name: 'Look again', exact: true })).toBeEnabled()
})

test('AC6 the reject form cannot be used while blind-first hides the card', async ({ page }) => {
  await page.getByRole('button', { name: 'Not a problem', exact: true }).click()
  await page.getByLabel('Reason for rejecting').fill('Looks fine')
  await page.getByLabel('Blind-first mode').check()
  await expect(page.getByLabel('Reason for rejecting')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Submit rejection' })).toHaveCount(0)
})

test('AC7 banner, image labels, reset', async ({ page }) => {
  await expect(page.getByText('Simulation', { exact: true })).toBeVisible()
  for (const title of ['Fence panel 4', 'Ring buoy moved', 'Worn path', 'Fence panel 3']) {
    await open(page, title)
    const c = page.getByRole('main')
    const images = c.getByRole('img', { name: /^(Before image|After image|Zoomed crop)/ })
    const tags = c.getByText('Sample illustration, not a site photo')
    const count = await images.count()
    expect(count).toBeGreaterThanOrEqual(2)
    await expect(tags).toHaveCount(count)
    for (let i = 0; i < count; i++) await expect(tags.nth(i)).toBeVisible()
  }
  await open(page, 'Fence panel 4')
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  await expect(list(page, 'Decided').getByRole('button', { name: /Fence panel 4/ })).toBeVisible()
  await resetDemo(page)
  await expect(list(page, 'Open').getByRole('button', { name: /Fence panel 4/ })).toBeVisible()
  await expect(page.getByRole('region', { name: /^Finding / })).toHaveCount(0)
})

test('AC7 reset clears an open reject form', async ({ page }) => {
  await page.getByRole('button', { name: 'Not a problem', exact: true }).click()
  await page.getByLabel('Reason for rejecting').fill('Old reason')
  await resetDemo(page)
  await expect(card(page, S1).getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  await expect(page.getByLabel('Reason for rejecting')).toHaveCount(0)
})

test('AC2 keyboard-only confirm', async ({ page }) => {
  const confirm = page.getByRole('button', { name: 'Confirm: needs a fix', exact: true })
  let reached = false
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = await confirm.evaluate((e) => e === document.activeElement)
  }
  expect(reached, 'Confirm is reachable with Tab').toBe(true)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: /^Finding / })).toBeVisible()
})

test('list rows show the re-shoot request and empty groups say so', async ({ page }) => {
  await expect(list(page, 'Open')).toBeVisible()
  await page.getByRole('button', { name: 'Look again', exact: true }).click()
  await expect(
    list(page, 'Decided').getByText('Re-shoot viewpoint: Playground path, fence line (vp_866518980_11_2)')
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: /^No changes to review/ })).toHaveCount(0)
  for (const title of ['Ring buoy moved', 'Worn path', 'Fence panel 3']) {
    await open(page, title)
    await page.getByRole('button', { name: 'Look again', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: /^No changes to review/ })).toBeVisible()
})

test('AC1 every row has a visible tier mark, hollow for Tier 3', async ({ page }) => {
  const mark = (name: string) => list(page, 'Open').getByRole('img', { name }).first()
  const style = (name: string) =>
    mark(name).evaluate((e) => {
      const s = getComputedStyle(e)
      return { w: e.getBoundingClientRect().width, bg: s.backgroundColor, border: s.borderTopWidth }
    })
  const big = await style('Tier 2 · a person confirms')
  const small = await style('Tier 1 · watch')
  const ring = await style('Tier 3 · field check')
  await expect(mark('Tier 2 · a person confirms')).toBeVisible()
  await expect(mark('Tier 3 · field check')).toBeVisible()
  expect(big.w).toBeGreaterThan(small.w)
  expect(big.bg).not.toBe('rgba(0, 0, 0, 0)')
  expect(small.w).toBeGreaterThan(0)
  expect(ring.w).toBeGreaterThan(0)
  expect(ring.bg).toBe('rgba(0, 0, 0, 0)')
  expect(ring.border).toBe('2px')
})

test('AC1 the context line and rows come from the data, in Malaysian time', async ({ page }) => {
  await expect(page.getByText('Mon 19 Oct · 4 changes from drone images')).toBeVisible()
  await expect(page.getByText('To review · 4')).toBeVisible()
  await expect(list(page, 'Open').getByText('simulated')).toHaveCount(4)
  await expect(
    list(page, 'Open')
      .getByRole('button', { name: /Fence panel 4/ })
      .getByText('15:48')
  ).toBeVisible()
})

test('AC4 the Inbox uses the bundled font', async ({ page }) => {
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.fonts].some((f) => f.family.includes('Atkinson Hyperlegible Next') && f.status === 'loaded')
      )
    )
    .toBe(true)
  expect(await page.evaluate(() => document.fonts.check('16px "Atkinson Hyperlegible Next"'))).toBe(true)
})

test('AC4 dark mode switches the page background to the dark token', async ({ page }) => {
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(await bg()).toBe('rgb(231, 235, 232)')
  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await bg()).toBe('rgb(17, 26, 23)')
})

test('AC4 empty state after every card is decided never reads as all clear', async ({ page }) => {
  for (const title of ['Fence panel 4', 'Ring buoy moved', 'Worn path', 'Fence panel 3']) {
    await open(page, title)
    await page.getByRole('button', { name: 'Look again', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: 'No changes to review from the 19 Oct drone images' })).toBeVisible()
  await expect(page.getByText('1 spot the drone could not see stays unknown')).toBeVisible()
  await expect(page.getByText(/all clear/i)).toHaveCount(0)
})

test('AC10 the primary button shows the focus ring when reached by keyboard', async ({ page }) => {
  const confirm = page.getByRole('button', { name: 'Confirm: needs a fix', exact: true })
  let reached = false
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = await confirm.evaluate((e) => e === document.activeElement)
  }
  expect(reached).toBe(true)
  expect(await confirm.evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe('none')
})
