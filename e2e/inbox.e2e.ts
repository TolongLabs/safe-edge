import type { Locator, Page } from '@playwright/test'
import type { MemoryClient } from '@safe-edge/sdk'
import { expect, test } from './fixtures'

// The page's presenter handle (apps/web/src/store.ts); typed here so the root typecheck stays free of the app's JSX.
type Presenter = { demo: MemoryClient; refresh: () => Promise<void> }

// The demo core assigns IDs in order: the four sample cards are cand_1 (S1) to cand_4.
const S1 = 'cand_1'
const BUOY = 'cand_2'
const PATH = 'cand_3'
const FIELD = 'cand_4'

// The AI title each sample carries; only a card heading may show it, and never while blind mode hides a guess.
const AI_TITLE = {
  S1: 'Fence panel 4 missing',
  BUOY: 'Ring buoy moved',
  PATH: 'Worn path towards the water edge',
  FIELD: 'Fence panel 3 not visible'
} as const

// Every list row is titled by its viewpoint place name (sample/index.ts), in both blind modes.
const VIEWPOINT = {
  S1: 'Playground path, fence line',
  BUOY: 'Playground path, ring buoy post',
  PATH: 'Lake bank, grass slope',
  FIELD: 'Lake bank, fence line under tree cover'
} as const
const VIEWPOINTS = new Set<string>(Object.values(VIEWPOINT))
// Tests name cards by the old AI titles; rows now carry the viewpoint name from the sample mapping.
const viewpointOf = (title: string) =>
  title.startsWith('Fence panel 4')
    ? VIEWPOINT.S1
    : title.startsWith('Ring buoy')
      ? VIEWPOINT.BUOY
      : title.startsWith('Worn path')
        ? VIEWPOINT.PATH
        : title.startsWith('Fence panel 3')
          ? VIEWPOINT.FIELD
          : title
const card = (page: Page, id: string) => page.getByRole('article', { name: `Card ${id}` })
const open = (page: Page, title: string) =>
  page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: viewpointOf(title) })
    .click()
const resetDemo = async (page: Page) => {
  await page.getByRole('button', { name: /Farah Hashim/ }).click()
  await page.getByRole('button', { name: 'Reset demo' }).click()
}
const list = (page: Page, group: 'Open' | 'Decided') => page.getByRole('list', { name: group })
const row = (page: Page, group: 'Open' | 'Decided', title: string) =>
  list(page, group).getByRole('button', { name: viewpointOf(title) })

const contrast = (foreground: string, background: string) => {
  const lum = (color: string) => {
    const channels = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const c = value / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
  }
  const [hi, lo] = [lum(foreground), lum(background)].sort((a, b) => b - a)
  return (hi! + 0.05) / (lo! + 0.05)
}
const titleStyle = (title: Locator) =>
  title.evaluate((el) => ({
    color: getComputedStyle(el).color,
    background: getComputedStyle(el.closest('.row') ?? el.closest('.detail')!).backgroundColor
  }))

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
  await expect(c.getByRole('img', { name: 'Flagged region: Fence panel 4 missing', exact: true })).toBeVisible()
  await expect(c.getByRole('img', { name: 'Close-up of the flagged region: Fence panel 4 missing' })).toBeVisible()
  await expect(c.getByText(/^Dotted: as in the \d+ \w+ baseline$/)).toBeVisible()
  await expect(c.getByText('Elmina Central Park lake, segment 12')).toBeVisible()
  await expect(c.getByText('Segment seg_866518980_11')).toBeAttached()
  await expect(c.getByText('The safety pass for this fence is paused until it is fixed')).toBeVisible()
  await expect(c.getByRole('figure').filter({ hasText: 'Drone' }).getByText('19 Oct 2026, 15:48 MYT')).toBeVisible()
  await expect(c.getByText('How sure: high')).toBeVisible()
  await expect(c.getByText(/\bTier\b/)).toHaveCount(0)
  await expect(page.locator('.tier-mark')).toHaveCount(0)
  await expect(c.getByText(/AI label: missing/)).toBeVisible()
  await expect(c.getByText(/AI confidence 82%/)).toBeVisible()
  await expect(c.getByText(/AI suggestion, unvalidated/)).toBeVisible()
  await expect(c.getByText(/Uncertainty: low/)).toBeVisible()
  await expect(c.getByText(/Reason: Panel 4 is in the baseline/)).toBeVisible()
  await expect(c.getByText('provider', { exact: true })).toBeVisible() // the record's source
  // the summary is sample text, never claimed as the agent's
  await expect(c.getByText(/Sample summary, not written by the agent: .*obs_\d+, cand_1/)).toBeVisible()
  await expect(page.getByText('Drafted by agent')).toHaveCount(0)
  await expect(c.getByText(/^Before · \d+ \w+$/)).toBeVisible()
  await expect(c.getByText(/^Accepted by /)).toBeVisible()
  await expect(c.getByText('Drone', { exact: true })).toBeVisible()
})

test('AC1 Tier 3 card shows images and core field task only', async ({ page }) => {
  await open(page, 'Fence panel 3 not visible')
  const c = card(page, FIELD)
  await expect(c.getByRole('img', { name: /Before image/ })).toBeVisible()
  await expect(c.getByRole('img', { name: /After image/ })).toBeVisible()
  await expect(c.getByText(/Viewpoint: Lake bank, fence line under tree cover/)).toBeVisible()
  await expect(c.getByText('Not visible: unknown, never a pass')).toBeVisible()
  await expect(c.getByText(/\bTier\b/)).toHaveCount(0)
  await expect(page.locator('.tier-mark')).toHaveCount(0)
  await expect(c.getByRole('img', { name: /Flagged region/ })).toHaveCount(0)
  await expect(c.getByRole('img', { name: /Close-up/ })).toHaveCount(0)
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
  await expect(row(page, 'Decided', AI_TITLE.S1)).toBeVisible()
  await expect(row(page, 'Open', AI_TITLE.S1)).toHaveCount(0)
  await expect(row(page, 'Decided', AI_TITLE.S1)).toContainText(VIEWPOINT.S1)
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
  // AC7: the top bar's Simulation label covers every record, so none carries a Sample badge of its own
  await expect(page.getByText('Sample', { exact: true })).toHaveCount(0)
})

test('the decision controls line up, and severity says when it is still pre-filled', async ({ page }) => {
  const decision = page.getByRole('group', { name: 'Decision' })
  const severity = decision.getByRole('combobox', { name: /^Severity/ })
  const controls = [
    severity.locator('xpath=ancestor::label'),
    decision.getByRole('button', { name: 'Confirm: needs a fix', exact: true }),
    decision.getByRole('button', { name: 'Look again' }),
    decision.getByRole('button', { name: 'Not a problem' })
  ]
  const sameRow = async (row: typeof controls) => {
    const [first, ...rest] = await Promise.all(row.map(async (l) => (await l.boundingBox())!))
    for (const b of rest) {
      expect(Math.abs(b.y - first!.y)).toBeLessThanOrEqual(1)
      expect(Math.abs(b.height - first!.height)).toBeLessThanOrEqual(1)
    }
  }
  // At the demo's 1440 x 900 every control shares one row.
  await page.setViewportSize({ width: 1440, height: 900 })
  await sameRow(controls)
  // Narrower, the field takes its own line and the three buttons still share theirs.
  await page.setViewportSize({ width: 1280, height: 720 })
  await sameRow(controls.slice(1))
  await expect(decision.getByText('(pre-filled')).toBeVisible()
  await severity.selectOption('low')
  await expect(decision.getByText('(pre-filled')).toHaveCount(0)
  await expect(severity).toHaveValue('low')
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

test('AC6 blind-first hides every AI conclusion until blind mode is off', async ({ page }) => {
  await page.getByLabel('Blind-first mode').check()
  const c = card(page, S1)
  const decision = page.getByRole('group', { name: 'Decision' })
  const severity = decision.getByRole('combobox', { name: /^Severity/ })
  const confirm = decision.getByRole('button', { name: 'Confirm: needs a fix', exact: true })
  // the AI title would give the conclusion away, in the list and in the detail heading
  await expect(page.getByText(AI_TITLE.S1)).toHaveCount(0)
  await expect(page.getByText(AI_TITLE.BUOY)).toHaveCount(0)
  await expect(c.getByRole('heading', { name: VIEWPOINT.S1 })).toBeVisible()
  await expect(row(page, 'Open', AI_TITLE.S1)).toContainText(VIEWPOINT.S1)
  await expect(c.getByText(/AI label/)).toHaveCount(0)
  await expect(c.getByText(/AI confidence/)).toHaveCount(0)
  await expect(c.getByText(/How sure/)).toHaveCount(0)
  await expect(c.getByText(/Reason: Panel 4/)).toHaveCount(0)
  await expect(c.getByText(/Sample summary/)).toHaveCount(0)
  await expect(c.getByRole('img', { name: /Flagged region/ })).toHaveCount(0)
  await expect(c.getByRole('img', { name: /Close-up/ })).toHaveCount(0)
  // no tier word, chip or list mark may stand in for the hidden AI conclusion
  await expect(c.getByText(/\bTier\b/)).toHaveCount(0)
  await expect(page.locator('.tier-mark')).toHaveCount(0)
  // severity starts blank and Confirm waits for both the manager's label and their own severity
  await expect(severity).toHaveValue('')
  await expect(decision.getByText('(pre-filled')).toHaveCount(0)
  await expect(confirm).toBeDisabled()
  await expect(decision.getByRole('button', { name: 'Look again' })).toBeDisabled()
  await expect(decision.getByRole('button', { name: 'Not a problem' })).toBeDisabled()

  // picking our own label keeps the AI answer hidden and enables the choices that do not need a severity
  await page.getByRole('radio', { name: 'changed' }).click()
  await expect(c.getByRole('heading', { name: VIEWPOINT.S1 })).toBeVisible()
  await expect(c.getByText('Your label: changed')).toBeVisible()
  await expect(c.getByText(/AI label/)).toHaveCount(0)
  await expect(c.getByText(/AI confidence/)).toHaveCount(0)
  await expect(c.getByRole('img', { name: /Flagged region/ })).toHaveCount(0)
  await expect(confirm).toBeDisabled()
  await expect(decision.getByText('Pick a severity to confirm.')).toBeVisible()
  await expect(decision.getByRole('button', { name: 'Look again' })).toBeEnabled()
  await expect(decision.getByRole('button', { name: 'Not a problem' })).toBeEnabled()

  // an explicit severity is the manager's own, so Confirm proceeds while every AI conclusion stays hidden
  await severity.selectOption('high')
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expect(c.getByText(/Confirmed by Farah Hashim/)).toBeVisible()
  await expect(c.getByText('AI answer hidden while blind mode is on')).toBeVisible()
  await expect(c.getByText('Your label: changed')).toBeVisible()
  await expect(c.getByText(/AI label/)).toHaveCount(0)
  await expect(c.getByText(/AI confidence/)).toHaveCount(0)
  await expect(c.getByText(/How sure/)).toHaveCount(0)
  await expect(c.getByText(/Sample summary/)).toHaveCount(0)
  await expect(c.getByRole('img', { name: /Flagged region/ })).toHaveCount(0)
  // the interim task reason and work-order notes repeat the AI rationale, so both stay hidden too
  await expect(page.getByRole('region', { name: /^Task / })).toHaveCount(0)
  await expect(page.getByRole('region', { name: /^Work order / })).toHaveCount(0)
  // the manager's decision and chosen severity are not AI conclusions, so they stay visible
  await expect(page.getByRole('region', { name: /^Finding / }).getByText(/Severity: high/)).toBeVisible()

  // turning blind mode off reveals the AI title and answer, with the manager's label still kept
  await page.getByLabel('Blind-first mode').uncheck()
  await expect(c.getByRole('heading', { name: AI_TITLE.S1 })).toBeVisible()
  await expect(c.getByText(/AI label: missing/)).toBeVisible()
  await expect(c.getByText(/AI confidence 82%/)).toBeVisible()
  await expect(c.getByText('Your label: changed. The AI said missing.')).toBeVisible()
  await expect(c.getByRole('img', { name: /Flagged region/ })).toBeVisible()
  await expect(page.getByRole('region', { name: /^Work order / })).toBeVisible()
})

test('AC6 blind-first hides the Tier 1 machine guess too', async ({ page }) => {
  await page.getByLabel('Blind-first mode').check()
  await open(page, AI_TITLE.PATH)
  const c = card(page, PATH)
  const decision = page.getByRole('group', { name: 'Decision' })
  const severity = decision.getByRole('combobox', { name: /^Severity/ })
  await expect(c.getByRole('heading', { name: VIEWPOINT.PATH })).toBeVisible()
  await expect(page.getByText(AI_TITLE.PATH)).toHaveCount(0)
  await expect(c.getByText(/AI label/)).toHaveCount(0)
  await expect(c.getByText(/How sure/)).toHaveCount(0)
  await expect(c.getByText(/Sample summary/)).toHaveCount(0)
  await expect(c.getByRole('img', { name: /Flagged region/ })).toHaveCount(0)
  await expect(severity).toHaveValue('')
  await expect(decision.getByText('(pre-filled')).toHaveCount(0)
  await expect(decision.getByRole('button', { name: 'Confirm: needs a fix', exact: true })).toBeDisabled()
  // turning blind off reveals the same card's AI title, answer and its tier-derived severity
  await page.getByLabel('Blind-first mode').uncheck()
  await expect(c.getByRole('heading', { name: AI_TITLE.PATH })).toBeVisible()
  await expect(c.getByText(/AI label: general change/)).toBeVisible()
  await expect(severity).toHaveValue('medium')
  await expect(decision.getByText('(pre-filled')).toBeVisible()
  await expect(decision.getByRole('button', { name: 'Confirm: needs a fix', exact: true })).toBeEnabled()
})

test('AC6 blind-first keeps each manager label with its candidate', async ({ page }) => {
  await page.getByLabel('Blind-first mode').check()
  await page.getByRole('radio', { name: 'changed' }).click()
  await expect(card(page, S1).getByText('Your label: changed')).toBeVisible()
  await open(page, AI_TITLE.PATH)
  await page.getByRole('radio', { name: 'present' }).click()
  await expect(card(page, PATH).getByText('Your label: present')).toBeVisible()
  await open(page, AI_TITLE.S1)
  const c = card(page, S1)
  await expect(c.getByText('Your label: changed')).toBeVisible()
  await expect(c.getByText(/AI label/)).toHaveCount(0)
  await expect(c.getByRole('heading', { name: VIEWPOINT.S1 })).toBeVisible()
})

test('AC6 blind-first leaves the Tier 3 card as it was', async ({ page }) => {
  await page.getByLabel('Blind-first mode').check()
  await open(page, AI_TITLE.FIELD)
  const c = card(page, FIELD)
  await expect(c.getByRole('heading', { name: AI_TITLE.FIELD })).toBeVisible()
  await expect(c.getByText('Not visible: unknown, never a pass')).toBeVisible()
  await expect(c.getByText(/\bTier\b/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Look again', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Confirm: needs a fix', exact: true })).toHaveCount(0)
})

test('AC6 the reject form cannot be used while blind-first hides the card', async ({ page }) => {
  await page.getByRole('button', { name: 'Not a problem', exact: true }).click()
  await page.getByLabel('Reason for rejecting').fill('Looks fine')
  await page.getByLabel('Blind-first mode').check()
  await expect(page.getByLabel('Reason for rejecting')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Submit rejection' })).toHaveCount(0)
  await expect(card(page, S1).getByText(/AI label/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Not a problem', exact: true })).toBeDisabled()
})

test('AC7 banner, images without per-image labels, reset', async ({ page }) => {
  await expect(page.getByText('Simulation', { exact: true })).toBeVisible()
  for (const title of ['Fence panel 4', 'Ring buoy moved', 'Worn path', 'Fence panel 3']) {
    await open(page, title)
    const c = page.getByRole('main')
    const images = c.getByRole('img', { name: /^(Before image|After image|Close-up)/ })
    expect(await images.count()).toBeGreaterThanOrEqual(2)
    await expect(c.getByText('Sample illustration, not a site photo')).toHaveCount(0)
  }
  await open(page, 'Fence panel 4')
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  await expect(row(page, 'Decided', AI_TITLE.S1)).toBeVisible()
  await resetDemo(page)
  await expect(row(page, 'Open', AI_TITLE.S1)).toBeVisible()
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

test('AC1 every row is titled by its viewpoint in both blind modes, with no tier words or marks', async ({ page }) => {
  const titles = () => list(page, 'Open').locator('.row-title').allTextContents()
  const expectViewpointTitles = async () => {
    const got = await titles()
    expect(got).toHaveLength(VIEWPOINTS.size)
    expect([...new Set(got)].sort()).toEqual([...VIEWPOINTS].sort())
    expect(got.join(' ')).not.toMatch(/\bTier\b/i)
    await expect(page.locator('.tier-mark')).toHaveCount(0)
    await expect(page.getByRole('img', { name: /Tier/ })).toHaveCount(0)
    expect(await page.locator('body').innerText()).not.toMatch(/\bTier\b/i)
  }
  await expectViewpointTitles()
  await page.getByLabel('Blind-first mode').check()
  await expectViewpointTitles()
})

test('AC1 the context line and rows come from the data, in Malaysian time', async ({ page }) => {
  await expect(page.getByText('Mon 19 Oct · 4 changes from drone images')).toBeVisible()
  await expect(page.getByText('To review · 4')).toBeVisible()
  // the top bar's Simulation label covers the list, so neither its head nor a row repeats it
  await expect(page.getByRole('navigation', { name: 'Inbox list' }).getByText(/simulated/i)).toHaveCount(0)
  await expect(row(page, 'Open', AI_TITLE.S1).getByText('15:48')).toBeVisible()
})

test('AC214 title colours and meaning lines keep approved contrast in both themes', async ({ page }) => {
  const cases = [
    {
      id: S1,
      title: AI_TITLE.S1,
      kind: 'suspends',
      meaning: 'A new flag like this pauses a valid pass. Confirming it does not restore the pass.'
    },
    { id: PATH, title: AI_TITLE.PATH, kind: 'watch', meaning: 'Watch only. The pass stays as it is.' },
    {
      id: FIELD,
      title: AI_TITLE.FIELD,
      kind: 'unseen',
      meaning: 'The drone could not see this part. It is never treated as safe.'
    }
  ] as const
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    const palette = {
      suspends: scheme === 'light' ? 'rgb(176, 46, 40)' : 'rgb(246, 179, 172)',
      unseen: scheme === 'light' ? 'rgb(93, 107, 102)' : 'rgb(180, 189, 184)',
      watch: scheme === 'light' ? 'rgb(28, 41, 37)' : 'rgb(251, 252, 251)'
    }
    const selected = { suspends: 'rgb(246, 179, 172)', unseen: 'rgb(180, 195, 188)', watch: 'rgb(230, 238, 234)' }
    for (const item of cases) {
      await open(page, item.id === S1 ? AI_TITLE.PATH : AI_TITLE.S1)
      const rowTitle = row(page, 'Open', item.title).locator('.row-title')
      const unselected = await titleStyle(rowTitle)
      expect(unselected.color).toBe(palette[item.kind])
      expect(
        contrast(unselected.color, unselected.background),
        `${item.kind} unselected ${scheme}`
      ).toBeGreaterThanOrEqual(4.5)
      await open(page, item.title)
      const active = await titleStyle(rowTitle)
      expect(active.color).toBe(selected[item.kind])
      expect(contrast(active.color, active.background), `${item.kind} selected ${scheme}`).toBeGreaterThanOrEqual(4.5)
      const heading = card(page, item.id).getByRole('heading', { name: item.title, exact: true })
      const detail = await titleStyle(heading)
      expect(detail.color).toBe(palette[item.kind])
      expect(contrast(detail.color, detail.background), `${item.kind} heading ${scheme}`).toBeGreaterThanOrEqual(4.5)
      await expect(card(page, item.id).locator('.consequence-line')).toHaveText(item.meaning)
    }
    expect(palette.suspends).not.toBe(palette.watch)
  }
})

test('AC214 chosen appearance overrides the system title palette', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page
    .getByRole('banner')
    .getByRole('button', { name: /Farah Hashim/ })
    .click()
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  expect((await titleStyle(card(page, S1).getByRole('heading', { name: AI_TITLE.S1 }))).color).toBe('rgb(176, 46, 40)')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  expect((await titleStyle(card(page, S1).getByRole('heading', { name: AI_TITLE.S1 }))).color).toBe(
    'rgb(246, 179, 172)'
  )
})

test('AC214 blind mode keeps titles neutral and meaning lines absent after a decision', async ({ page }) => {
  await page.getByLabel('Blind-first mode').check()
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    for (const title of [AI_TITLE.S1, AI_TITLE.PATH]) {
      await open(page, title)
      const style = await titleStyle(row(page, 'Open', title).locator('.row-title'))
      expect(style.color).toBe('rgb(230, 238, 234)')
      const heading = page.getByRole('main').getByRole('heading', { name: viewpointOf(title), exact: true })
      expect((await titleStyle(heading)).color).toBe(scheme === 'light' ? 'rgb(28, 41, 37)' : 'rgb(251, 252, 251)')
    }
    await expect(page.locator('.row-title[class*="consequence-"]')).toHaveCount(0)
    await expect(page.locator('.consequence-line')).toHaveCount(0)
  }
  await open(page, AI_TITLE.S1)
  await page.getByRole('radio', { name: 'Changed', exact: true }).click()
  await page.getByRole('combobox', { name: /^Severity/ }).selectOption('medium')
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  await expect(card(page, S1).getByText('AI answer hidden while blind mode is on', { exact: true })).toBeVisible()
  await expect(page.locator('.consequence-line')).toHaveCount(0)
  await expect(page.locator('.row-title[class*="consequence-"]')).toHaveCount(0)
})

test('AC1 severity native options keep readable colours in both themes', async ({ page }) => {
  const select = page.getByRole('group', { name: 'Decision' }).getByRole('combobox', { name: /^Severity/ })
  const read = () =>
    select.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        scheme: style.colorScheme,
        options: [...(el as HTMLSelectElement).options].map((option) => ({
          label: option.label,
          color: getComputedStyle(option).color,
          background: getComputedStyle(option).backgroundColor
        }))
      }
    })
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    const got = await read()
    expect(got.scheme).toContain(scheme)
    expect(got.options.map((option) => option.label)).toEqual(['Low', 'Medium', 'High'])
    for (const option of got.options) {
      expect(option.background, `${option.label} background in ${scheme}`).not.toBe('rgba(0, 0, 0, 0)')
      expect(contrast(option.color, option.background), `${option.label} in ${scheme}`).toBeGreaterThanOrEqual(4.5)
    }
  }
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
