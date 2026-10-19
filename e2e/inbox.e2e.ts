import { expect, test as base, type Page } from '@playwright/test'
import type { MemoryClient } from '@safe-edge/sdk'

// The page's presenter handle (apps/web/src/store.ts); typed here so the root typecheck stays free of the app's JSX.
type Presenter = { demo: MemoryClient; refresh: () => Promise<void> }

// AC8: abort every http(s) request that is not local, record it, and fail the test if any happened.
const test = base.extend<{ aborted: string[] }>({
  aborted: [
    async ({ page }, use) => {
      const aborted: string[] = []
      await page.route(/^https?:/, (route) => {
        const host = new URL(route.request().url()).hostname
        if (host === 'localhost' || host === '127.0.0.1') return route.continue()
        aborted.push(route.request().url())
        return route.abort()
      })
      await use(aborted)
      expect(aborted, 'non-local requests were aborted').toEqual([])
    },
    { auto: true }
  ]
})

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
  await page.goto('/')
  await expect(card(page, S1).getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
})

test('AC1 S1 card shows its evidence', async ({ page }) => {
  const c = card(page, S1)
  await expect(c.getByRole('heading', { name: /Fence panel 4 missing/ })).toBeVisible()
  await expect(c.getByRole('img', { name: /Before image/ })).toBeVisible()
  await expect(c.getByRole('img', { name: /After image/ })).toBeVisible()
  await expect(c.getByRole('img', { name: 'Flagged region: Fence panel 4 missing' })).toBeVisible()
  await expect(c.getByRole('img', { name: 'Zoomed crop of the flagged region' })).toBeVisible()
  await expect(c.getByText('Elmina Central Park lake, segment 12 (seg_866518980_11)')).toBeVisible()
  await expect(c.getByText('Pass suspended')).toBeVisible()
  await expect(c.getByText(/19 Oct 2026/)).toBeVisible()
  await expect(c.getByText('Tier 2 Confirm')).toBeVisible()
  await expect(c.getByText(/AI label: missing/)).toBeVisible()
  await expect(c.getByText(/AI confidence 82%/)).toBeVisible()
  await expect(c.getByText(/AI suggestion, unvalidated/)).toBeVisible()
  await expect(c.getByText(/Uncertainty: low/)).toBeVisible()
  await expect(c.getByText(/Reason: Panel 4 is in the baseline/)).toBeVisible()
  await expect(c.getByText(/Simulated, source provider/)).toBeVisible()
  // the summary is sample text, never claimed as the agent's
  await expect(c.getByText(/Sample summary, not written by the agent: .*obs_\d+, cand_1/)).toBeVisible()
  await expect(page.getByText('Drafted by agent')).toHaveCount(0)
  await expect(page.getByRole('slider', { name: /Compare before and after/ })).toBeVisible()
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
  await expect(page.getByRole('button', { name: 'Recapture' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0)
})

test('AC2 reject needs a reason', async ({ page }) => {
  await page.getByRole('button', { name: 'Reject' }).click()
  const submit = page.getByRole('button', { name: 'Submit rejection' })
  await expect(submit).toBeDisabled()
  await expect(page.getByText('Type a reason to enable this.')).toBeVisible()
  await page.getByLabel('Reason for rejecting').fill('   ')
  await expect(submit).toBeDisabled()
  await page.getByLabel('Reason for rejecting').fill('Panel was removed on purpose for repainting')
  await submit.click()
  const c = card(page, S1)
  await expect(c.getByText(/State: Rejected by Farah Hashim/)).toBeVisible()
  await expect(c.getByText(/Reason: Panel was removed on purpose/)).toBeVisible()
  await expect(list(page, 'Decided').getByRole('button', { name: /Fence panel 4/ })).toBeVisible()
  await expect(list(page, 'Open').getByRole('button', { name: /Fence panel 4/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirm' })).toHaveCount(0)
})

test('AC2 recapture records the re-shoot request', async ({ page }) => {
  await page.getByRole('button', { name: 'Recapture' }).click()
  await expect(
    card(page, S1).getByText(
      /State: Needs recapture by Farah Hashim \(manager\)\. Re-shoot viewpoint: Playground path, fence line/
    )
  ).toBeVisible()
  // Core opens a recapture task for the decision (#139).
  await expect(
    page.getByRole('region', { name: /^Task / }).getByRole('heading', { name: 'Recapture task' })
  ).toBeVisible()
})

test('AC3 AC7 confirm opens work and labels every record', async ({ page }) => {
  await page.getByLabel('Severity (pre-filled, you can change it)').selectOption('medium')
  await page.getByRole('button', { name: 'Confirm' }).click()
  const c = card(page, S1)
  await expect(c.getByText(/State: Confirmed by Farah Hashim/)).toBeVisible()
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
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('region', { name: /^Finding / })).toBeVisible()
  await expect(page.getByRole('region', { name: /^Task / })).toBeVisible()
  const wo = page.getByRole('region', { name: /^Work order / })
  await expect(wo).toBeVisible()
  await expect(wo.getByRole('button', { name: 'Submit work order' })).toBeDisabled()
  await expect(wo.getByText('Needs a repair approved by the engineer in Fix Lens (#81).')).toBeVisible()
  await expect(wo.getByText(/Interim protection is not done yet/)).toBeVisible()
})

test('AC4 submit once the other people have done their steps', async ({ page }) => {
  await page.getByRole('button', { name: 'Confirm' }).click()
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
  for (const n of ['Confirm', 'Reject', 'Recapture']) await expect(page.getByRole('button', { name: n })).toBeDisabled()
  await page.getByRole('radio', { name: 'changed' }).click()
  await expect(c.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  await expect(c.getByText(/AI label: missing/)).toBeVisible()
  await expect(c.getByText(/Your label: changed\. Differs with the AI label/)).toBeVisible()
  await expect(c.getByRole('img', { name: /Flagged region/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeEnabled()
})

test('AC6 blind-first does not affect Tier 1 and Tier 3', async ({ page }) => {
  await page.getByLabel('Blind-first mode').check()
  await open(page, 'Worn path')
  await expect(card(page, PATH).getByText(/AI label: general change/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeEnabled()
  await open(page, 'Fence panel 3 not visible')
  await expect(page.getByRole('button', { name: 'Recapture' })).toBeEnabled()
})

test('AC6 the reject form cannot be used while blind-first hides the card', async ({ page }) => {
  await page.getByRole('button', { name: 'Reject' }).click()
  await page.getByLabel('Reason for rejecting').fill('Looks fine')
  await page.getByLabel('Blind-first mode').check()
  await expect(page.getByLabel('Reason for rejecting')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Submit rejection' })).toHaveCount(0)
})

test('AC7 banner, image labels, reset', async ({ page }) => {
  await expect(page.getByText(/SAMPLE DATA/)).toBeVisible()
  for (const title of ['Fence panel 4', 'Ring buoy moved', 'Worn path', 'Fence panel 3']) {
    await open(page, title)
    const c = page.getByRole('main')
    const images = c.getByRole('img', { name: /^(Before image|After image|Zoomed crop)/ })
    const tags = c.getByText('Sample image, not a site photo')
    const count = await images.count()
    expect(count).toBeGreaterThanOrEqual(2)
    await expect(tags).toHaveCount(count)
    for (let i = 0; i < count; i++) await expect(tags.nth(i)).toBeVisible()
  }
  await open(page, 'Fence panel 4')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(list(page, 'Decided').getByRole('button', { name: /Fence panel 4/ })).toBeVisible()
  await page.getByRole('button', { name: 'Reset demo' }).click()
  await expect(list(page, 'Open').getByRole('button', { name: /Fence panel 4/ })).toBeVisible()
  await expect(page.getByRole('region', { name: /^Finding / })).toHaveCount(0)
})

test('AC7 reset clears an open reject form', async ({ page }) => {
  await page.getByRole('button', { name: 'Reject' }).click()
  await page.getByLabel('Reason for rejecting').fill('Old reason')
  await page.getByRole('button', { name: 'Reset demo' }).click()
  await expect(card(page, S1).getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  await expect(page.getByLabel('Reason for rejecting')).toHaveCount(0)
})

test('AC2 keyboard-only confirm', async ({ page }) => {
  const confirm = page.getByRole('button', { name: 'Confirm' })
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
  await page.getByRole('button', { name: 'Recapture', exact: true }).click()
  await expect(
    list(page, 'Decided').getByText('Re-shoot viewpoint: Playground path, fence line (vp_866518980_11_2)')
  ).toBeVisible()
  await expect(page.getByText('Nothing open.')).toHaveCount(0)
  for (const title of ['Ring buoy moved', 'Worn path', 'Fence panel 3']) {
    await open(page, title)
    await page.getByRole('button', { name: 'Recapture', exact: true }).click()
  }
  await expect(page.getByText('Nothing open.')).toBeVisible()
})

test('AC10 slider handle shows a focus ring', async ({ page }) => {
  const handle = page.getByRole('slider', { name: /Compare before and after/ })
  await handle.focus()
  await page.keyboard.press('ArrowRight')
  const outline = await page
    .locator('.knob')
    .first()
    .evaluate((e) => getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineWidth)
  expect(outline).toBe('solid 3px')
})
