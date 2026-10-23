import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const profile = (page: Page) => page.getByRole('banner').getByRole('button', { expanded: false })
async function signInAs(page: Page, name: string) {
  await profile(page).click()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
}
const openBoard = (page: Page) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Passes' }).click()
const s1Row = (page: Page) => page.getByRole('article', { name: /Elmina Central Park lake.*S12/ })

async function confirmS1(page: Page) {
  await page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Fence panel 4|Playground path, fence line/ })
    .click()
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  await expect(page.getByRole('region', { name: /^Finding / })).toBeVisible()
}

/** Fix Lens is not on this branch: a submitted work order three days past its due date is set up through the handle. */
async function submitOverdueWorkOrder(page: Page) {
  await page.evaluate(async () => {
    const { demo, refresh } = (window as unknown as { safeEdgeDemo: { demo: any; refresh: () => Promise<void> } })
      .safeEdgeDemo
    const wo = (await demo.listWorkOrders())[0]
    const finding = (await demo.listFindings())[0]
    const interim = (await demo.listTasks()).find((t: any) => t.kind === 'interim_protection' && t.status === 'open')
    await demo.as('usr_crew').completeTask({ params: { id: interim.id } })
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
        segmentId: gap.segmentId,
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
    await demo.submitWorkOrder({
      params: { id: wo.id },
      body: { installerUserId: 'usr_installer', dueAt: new Date(Date.now() - 3 * 86_400_000).toISOString() }
    })
    await refresh()
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('demo/')
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
})

test('AC216 action cards lead, and the remaining edges fold by mouse and keyboard', async ({ page }) => {
  await openBoard(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
  const cards = page.getByRole('region', { name: 'Action needed', exact: true }).getByRole('article')
  await expect(cards.nth(0)).toContainText('S12')
  await expect(cards.nth(0)).toContainText('Suspended')
  await expect(cards.nth(1)).toContainText('S7')
  await expect(cards.nth(1)).toContainText('Expired')
  await expect(cards.nth(2)).toContainText('S6')
  await expect(cards.nth(2)).toContainText('Expiring')
  await expect(cards).toHaveCount(3)
  await expect(cards.nth(0)).toContainText('Farah Hashim')
  await expect(cards.nth(0)).toContainText('Next:')
  await expect(cards.nth(0)).toContainText('Flag "Fence panel 4 missing" awaiting review')
  await expect(cards.nth(0)).not.toContainText(/Tier 2|candidate|cand_/)
  await expect(page.getByText('No pass yet: unknown', { exact: true }).first()).toBeHidden()
  const valid = page.locator('details').filter({ has: page.locator('summary', { hasText: /^Valid/ }) })
  const none = page.locator('details').filter({ has: page.locator('summary', { hasText: /^No pass yet/ }) })
  await expect(valid.locator('summary')).toContainText(/Valid.*[1-9]/)
  await expect(none.locator('summary')).toContainText(/No pass yet.*43/)
  await expect(valid).not.toHaveAttribute('open')
  await expect(none).not.toHaveAttribute('open')
  await valid.locator('summary').click()
  await expect(valid).toHaveAttribute('open', '')
  await expect(valid.getByRole('link').first()).toBeVisible()
  await valid.locator('summary').click()
  await expect(valid).not.toHaveAttribute('open')
  await none.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(none).toHaveAttribute('open', '')
  await expect(none.getByRole('link')).toHaveCount(43)
  await expect(none.getByRole('link').first()).toContainText('No pass yet: unknown')
  await expect(none.getByRole('link').first()).not.toContainText('Valid')
  await page.keyboard.press('Space')
  await expect(none).not.toHaveAttribute('open')
  const map = page.getByRole('link', { name: 'Open the Map' })
  await expect(map).toHaveAttribute('href', 'scene.html')
  await expect(page.getByRole('combobox', { name: 'Asset' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download JSON' })).toBeDisabled()
  // the notices and the handover pack keep their place below the board
  await expect(page.getByRole('heading', { name: 'Overdue work: escalation' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Monthly report/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Handover pack' })).toBeVisible()
})

test('AC217 pass links open suspended, expired and no-pass detail, including Enter', async ({ page }) => {
  const errors: Error[] = []
  page.on('pageerror', (error) => errors.push(error))
  await openBoard(page)
  await s1Row(page).getByRole('link').click()
  await expect(page).toHaveURL(/#\/passes\//)
  await expect(page.getByRole('heading', { level: 1, name: 'Pass details' })).toBeVisible()
  await expect(page.getByRole('main')).toContainText('Suspended')
  await expect(page.getByRole('main')).toContainText('Flag "Fence panel 4 missing" awaiting review')
  await expect(page.getByRole('main')).toContainText('Next:')
  await expect(page.getByRole('main')).not.toContainText(/Tier 2|candidate|cand_/)
  await page.getByRole('link', { name: 'Back to Passes' }).click()
  const expired = page.getByRole('article', { name: /Elmina Central Park lake.*S7/ }).getByRole('link')
  await expired.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toContainText('Expired')
  await expect(page.getByRole('main')).toContainText('Next:')
  await page.getByRole('link', { name: 'Back to Passes' }).click()
  const none = page.locator('details').filter({ has: page.locator('summary', { hasText: /^No pass yet/ }) })
  await none.locator('summary').focus()
  await page.keyboard.press('Enter')
  await none.getByRole('link').first().focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Pass details' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No pass yet', exact: true })).toBeVisible()
  await expect(page.getByRole('main')).toContainText('Next:')
  await expect(page.getByRole('main')).toContainText(/unknown/i)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('link', { name: 'Back to Passes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
  expect(errors).toEqual([])
})

test('a folded valid pass still opens its certificate', async ({ page }) => {
  await openBoard(page)
  const valid = page.locator('details').filter({ has: page.locator('summary', { hasText: /^Valid/ }) })
  await valid.locator('summary').click()
  await valid.getByRole('link').first().click()
  await expect(page.getByRole('heading', { name: 'Safety pass issued' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Routes covered' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Re-tests', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'How it got here' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to Passes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
})

test('an edge without any pass record opens its unknown detail', async ({ page }) => {
  const segmentId = await page.evaluate(async () => {
    const { demo, refresh } = (window as any).safeEdgeDemo
    const passes = await demo.listPasses()
    const segment = (await demo.listSegments()).find((s: any) =>
      passes.some((p: any) => p.id === s.passId && p.state === 'none')
    )
    if (!segment) throw new Error('Missing no-pass segment')
    const as = demo.as.bind(demo)
    demo.as = (id: string) => {
      const api = as(id)
      return {
        ...api,
        listSegments: async () =>
          (await api.listSegments()).map((s: any) => (s.id === segment.id ? { ...s, passId: null } : s)),
        getSegment: async (request: any) => {
          const detail = await api.getSegment(request)
          return detail.segment.id === segment.id ? { ...detail, segment: { ...detail.segment, passId: null } } : detail
        }
      }
    }
    await refresh()
    return segment.id
  })
  await openBoard(page)
  const none = page.locator('details').filter({ has: page.locator('summary', { hasText: /^No pass yet/ }) })
  await none.locator('summary').click()
  await none.locator(`a[href="#/passes/${segmentId}"]`).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Pass details' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No pass yet', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('main')).toContainText(/unknown/i)
  await expect(page.getByRole('link', { name: 'Back to Passes' })).toBeVisible()
})

test('AC83-2 overdue work is escalated by the manager and read by the general manager', async ({ page }) => {
  await confirmS1(page)
  await submitOverdueWorkOrder(page)
  await openBoard(page)
  await expect(s1Row(page)).toContainText(/3 days/)
  await page.getByRole('button', { name: 'Draft escalation' }).click()
  await page
    .getByRole('textbox', { name: /Escalation for/ })
    .fill('To: Rosli Ahmad. The fence repair is 3 days overdue.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Drafted by Farah Hashim · not sent')).toBeVisible()
  await page.getByRole('button', { name: 'Send escalation' }).click()
  await expect(page.getByText(/^Sent by Farah Hashim ·/)).toBeVisible()
  await expect(page.getByText('Drafted by Farah Hashim', { exact: true })).toBeVisible()
  await expect(page.getByRole('article', { name: /^Overdue work/ }).getByText('simulated')).toHaveCount(0)
  await signInAs(page, 'Rosli Ahmad')
  await expect(page.getByText(/^Sent by Farah Hashim ·/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send escalation' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Open the work order' })).toBeVisible()
  // someone who may not read notices is told who can
  await signInAs(page, 'Siti Aminah')
  await expect(page.getByText('The park manager and the township general manager see this.').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Draft escalation' })).toHaveCount(0)
})

test('AC83-3 the monthly report is drafted by a person and exported', async ({ page }) => {
  await openBoard(page)
  // the agent's draft needs the person's own Anthropic key, and says where to add it
  const agentDraft = page.getByRole('button', { name: 'Draft with the agent' })
  await expect(agentDraft).toBeDisabled()
  await expect(agentDraft).toHaveAccessibleDescription(/your own Anthropic key/)
  await page.getByRole('button', { name: 'Draft the report' }).click()
  await expect(page.getByRole('textbox', { name: 'Monthly report' })).toHaveValue(/47 edges/)
  await page.getByRole('textbox', { name: 'Monthly report' }).fill('   ')
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled()
  await expect(page.getByText('Write some text before saving.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Monthly report' }).fill('October: 47 edges.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(
    page.getByRole('article', { name: /^Monthly report/ }).getByText('Drafted by Farah Hashim · not sent')
  ).toBeVisible()
  const md = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Markdown' }).click()
  const mdFile = await md
  expect(mdFile.suggestedFilename()).toBe('monthly-report.md')
  const text = (await (await mdFile.createReadStream()).toArray()).join('')
  expect(text).toContain('Drafted by Farah Hashim')
  const js = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSON', exact: true }).click()
  const json = JSON.parse((await (await (await js).createReadStream()).toArray()).join(''))
  expect(json).toMatchObject({ kind: 'monthly_report', status: 'draft', simulated: true })
  // the printable page: only the report shows when printing
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { level: 1, name: /^Monthly report/, includeHidden: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()
  await expect(page.locator('.table-island')).toBeHidden()
  // paper is black on white even when the screen theme is dark
  const heading = page.getByRole('heading', { level: 1, name: /^Monthly report/, includeHidden: true })
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' })
  await expect(heading).toHaveCSS('color', 'rgb(0, 0, 0)')
  await page.emulateMedia({ media: 'screen' })
  await profile(page).click()
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.emulateMedia({ media: 'print' })
  await expect(heading).toHaveCSS('color', 'rgb(0, 0, 0)')
})

test('AC83-4 loading, error and the dark theme', async ({ page }) => {
  await page.evaluate(() => {
    const demo = (window as unknown as { safeEdgeDemo: { demo: any } }).safeEdgeDemo.demo
    const as = demo.as.bind(demo)
    ;(window as any).release = () => undefined
    ;(window as any).mode = 'slow'
    ;(window as any).realAs = as
    demo.as = (id: string) => ({
      ...as(id),
      listSegments: () =>
        (window as any).mode === 'slow'
          ? new Promise((r) => ((window as any).release = () => r(as(id).listSegments())))
          : (window as any).mode === 'fail'
            ? Promise.reject(new Error('The segment list is not available.'))
            : as(id).listSegments()
    })
  })
  await openBoard(page)
  await expect(page.getByRole('status')).toContainText('Loading every edge')
  await page.evaluate(() => {
    ;(window as any).mode = 'fail'
    ;(window as any).release()
  })
  // the slow read finishes with data first; sign in again to read with the failing client
  await expect(page.locator('.table-island')).toBeVisible()
  await signInAs(page, 'Rosli Ahmad')
  await expect(page.getByRole('alert')).toContainText('Could not load the pass list.')
  await expect(page.getByRole('alert')).toContainText('does not mean every edge is safe')
  await page.evaluate(() => ((window as any).mode = 'ok'))
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.table-island')).toBeVisible()
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('.table-island')).toBeVisible()
  await page.screenshot({ path: 'test-results/passes-dark.png' })
})

test('with both drafts open, only the composer opened last has the primary Save draft', async ({ page }) => {
  await confirmS1(page)
  await submitOverdueWorkOrder(page)
  await openBoard(page)
  const primary = page.locator('.board .btn.primary')
  await page.getByRole('button', { name: 'Draft escalation' }).click()
  await page.getByRole('textbox', { name: /Escalation for/ }).fill('Kept text')
  await page.getByRole('button', { name: 'Draft the report' }).click()
  await expect(primary).toHaveCount(1)
  await expect(
    page
      .locator('form.compose')
      .filter({ has: page.getByRole('textbox', { name: 'Monthly report' }) })
      .locator('.btn.primary')
  ).toHaveCount(1)
  await expect(page.getByRole('textbox', { name: /Escalation for/ })).toHaveValue('Kept text')
  await page.getByRole('button', { name: 'Cancel' }).last().click()
  await expect(primary).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Save draft' })).toHaveClass(/primary/)
})

test('Passes stays readable on desktop and phone in both themes', async ({ page }) => {
  await openBoard(page)
  await expect(s1Row(page)).toBeVisible()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      await expect(s1Row(page).getByRole('link')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const link = s1Row(page).getByRole('link')
      await link.focus()
      await expect(link).toBeFocused()
      const summary = page.locator('summary').first()
      expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await page.screenshot({ path: `test-results/passes-${width}-${colorScheme}.png`, fullPage: true })
    }
  }
})
