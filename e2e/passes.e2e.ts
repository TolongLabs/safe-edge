import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const profile = (page: Page) => page.getByRole('banner').getByRole('button', { expanded: false })
async function signInAs(page: Page, name: string) {
  await profile(page).click()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
}
const openBoard = (page: Page) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Passes' }).click()
const s1Row = (page: Page) => page.getByRole('row', { name: /Elmina Central Park lake S12/ })

async function confirmS1(page: Page) {
  await page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Fence panel 4/ })
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

test('AC83-1 the township view lists every edge, worst first, with S1 suspended', async ({ page }) => {
  await confirmS1(page)
  await signInAs(page, 'Rosli Ahmad')
  await openBoard(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(48) // header + 47 edges
  // worst first: S1's suspended row sits above every no-pass row
  const none = page.getByRole('row', { name: /lake S1 No pass yet: unknown/ })
  const above = (await s1Row(page).boundingBox())!.y < (await none.boundingBox())!.y
  expect(above).toBe(true)
  const s1 = s1Row(page)
  await expect(s1).toContainText(/Suspended · valid to \d+ \w+ \d{4}/)
  await expect(s1.getByRole('cell', { name: 'Farah Hashim' })).toBeVisible() // owner
  await expect(s1.getByRole('cell', { name: '1', exact: true })).toBeVisible() // one open flag
  await expect(s1.getByRole('cell', { name: 'None', exact: true })).toBeVisible() // no overdue work
  await expect(s1.getByRole('cell', { name: 'Part, length not recorded' })).toBeVisible() // open field check, no length
  // the top bar's Simulation label covers the table, so neither it nor a row repeats it
  await expect(page.getByText('Every pass in this table is simulated.')).toHaveCount(0)
  await expect(s1).not.toContainText('simulated')
  await expect(s1).not.toContainText('cand_') // flags are named in words, never by id
  // expired and expiring passes show their date
  await expect(page.getByText(/^Expired \d+ \w+ \d{4}$/)).toBeVisible()
  await expect(page.getByText(/^Expiring: valid to \d+ \w+ \d{4}$/)).toBeVisible()
  // unknown is never a pass
  await expect(none).toBeVisible()
  await expect(none).not.toContainText('Valid')
  await expect(none).toContainText('0% of the edge')
  await expect(page.getByText(/edges have no pass yet\. Unknown is never shown as safe\./)).toBeVisible()
  const map = page.getByRole('link', { name: 'Open the Map' })
  await expect(map).toHaveAttribute('href', 'scene.html')
  await expect(page.getByText(/shows the demo's starting data and the scenario player/)).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Asset' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download JSON' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Printable page' })).toBeDisabled()
})

test('AC83-2 overdue work is escalated by the manager and read by the general manager', async ({ page }) => {
  await confirmS1(page)
  await submitOverdueWorkOrder(page)
  await openBoard(page)
  await expect(s1Row(page)).toContainText('1 work order, 3 days')
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
  await expect(page.getByRole('table')).toBeHidden()
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
  await expect(page.getByRole('table')).toBeVisible()
  await signInAs(page, 'Rosli Ahmad')
  await expect(page.getByRole('alert')).toContainText('Could not load the pass list.')
  await expect(page.getByRole('alert')).toContainText('does not mean every edge is safe')
  await page.evaluate(() => ((window as any).mode = 'ok'))
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.getByRole('table')).toBeVisible()
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
