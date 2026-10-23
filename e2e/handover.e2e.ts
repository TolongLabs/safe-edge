import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const profile = (page: Page) => page.getByRole('banner').getByRole('button', { expanded: false })
async function signInAs(page: Page, name: string) {
  await profile(page).click()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
}
const openBoard = (page: Page) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Passes' }).click()

async function confirmS1(page: Page) {
  await page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Playground path, fence line/ })
    .click()
  await page.getByRole('button', { name: 'Confirm: needs a fix', exact: true }).click()
  await expect(page.getByRole('region', { name: /^Finding / })).toBeVisible()
}

async function setUpAcceptedRetest(page: Page) {
  return page.evaluate(async () => {
    const d = (window as unknown as { safeEdgeDemo: { demo: any } }).safeEdgeDemo.demo
    const cands = await d.listCandidates()
    const ring = cands.find((c: any) => c.inventoryItemId === 'item_866518980_11_ring_buoy' && c.status !== 'rejected')
    if (!ring) throw new Error('Missing ring buoy flag')
    await d.as('usr_manager').decideCandidate({
      params: { id: ring.id },
      body: { decision: 'reject', reason: 'Sample flag rejected for the handover test' }
    })
    const finding = (await d.listFindings())[0]
    if (!finding) throw new Error('Missing finding')
    const segmentId = finding.segmentId
    const segment = (await d.listSegments()).find((s: any) => s.id === segmentId)
    if (!segment) throw new Error('Missing segment')
    const interim = (await d.listTasks()).find((t: any) => t.kind === 'interim_protection' && t.status === 'open')
    if (!interim) throw new Error('Missing interim protection task')
    await d.as('usr_crew').completeTask({ params: { id: interim.id } })
    const gap = await d.as('usr_manager').createOpening({
      body: {
        segmentId,
        type: 'fence_gap',
        photoMarks: [{ evidenceId: 'evd_s1_photo', x: 0.45, y: 0.6 }],
        measuredMm: 1200
      }
    })
    const throughGap = await d.as('usr_manager').createRoute({
      body: {
        segmentId,
        fromFeature: { kind: 'play_area', label: 'Playground path, through the panel gap' },
        openingIds: [gap.id],
        status: 'open'
      }
    })
    const remedy = await d.as('usr_engineer').createRemedy({
      body: {
        segmentId,
        type: 'panel_replacement',
        label: 'Replace fence panel 4',
        blocksOpeningIds: [gap.id],
        quantities: [{ item: 'Fence panel 2.4 m', amount: 1, unit: 'panel' }],
        acceptanceTest: 'No gap over 100 mm',
        quote: 'quote_needed'
      }
    })
    await d.as('usr_engineer').approveRemedy({ params: { id: remedy.id } })
    const wo = (await d.listWorkOrders()).find((w: any) => w.findingId === finding.id)
    if (!wo) throw new Error('Missing work order')
    await d.as('usr_manager').updateWorkOrder({ params: { id: wo.id }, body: { remedyId: remedy.id } })
    await d.as('usr_manager').submitWorkOrder({
      params: { id: wo.id },
      body: { installerUserId: 'usr_installer', dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString() }
    })
    await d.as('usr_installer').startWorkOrder({ params: { id: wo.id } })
    await d.as('usr_installer').completeWorkOrder({
      params: { id: wo.id },
      body: { evidence: [], note: 'Panel replaced, fence extended to the headwall' }
    })
    const viewpointId = segment.viewpoints[0].id
    const outcome = await d.as('usr_reviewer').recordRetest({
      body: {
        workOrderId: wo.id,
        checklist: [
          { kind: 'saved_view', subjectId: viewpointId, result: 'pass', reason: 'Panel 4 in place', measuredMm: null },
          { kind: 'route_check', subjectId: throughGap.id, result: 'pass', reason: 'Gap closed', measuredMm: 40 }
        ],
        evidence: [],
        result: 'accepted',
        reason: 'Both observed approaches closed'
      }
    })
    await (window as any).safeEdgeDemo.refresh()
    const asset = (await d.listAssets()).find((a: any) => a.id === segment.assetId)
    if (!asset) throw new Error('Missing asset of the S1 segment')
    return { retestId: outcome.retest.id, segmentId, assetId: asset.id, assetName: asset.name }
  })
}

async function selectAsset(page: Page, assetId: string) {
  await page.getByRole('combobox', { name: 'Asset' }).selectOption(assetId)
}

test('AC84-1 the manager downloads the handover pack with the accepted re-test', async ({ page }) => {
  await page.goto('demo/')
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  await confirmS1(page)
  const { retestId, segmentId, assetId, assetName } = await setUpAcceptedRetest(page)
  await openBoard(page)
  await expect(page.getByRole('heading', { level: 2, name: 'Handover pack' })).toBeVisible()
  await selectAsset(page, assetId)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download JSON' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^handover-.+\.json$/)
  const json = JSON.parse(Buffer.concat(await (await file.createReadStream()).toArray()).toString('utf8'))

  expect(json.asset.id).toBe(assetId)
  expect(json.asset.name).toBe(assetName)
  const s1 = json.segments.find((s: any) => s.segment.id === segmentId)
  expect(s1).toBeDefined()
  expect(s1.pass.state).toBe('valid')
  expect(json.acceptedRetests.map((r: any) => r.id)).toContain(retestId)
  const accepted = json.acceptedRetests.find((r: any) => r.id === retestId)
  expect(typeof accepted.details).toBe('object')
  expect(typeof accepted.simulated).toBe('boolean')
  expect(accepted.labelsFrom).toBe('audit')
  expect(typeof accepted.source).toBe('string')
  expect(typeof accepted.details.at).toBe('string')
  expect(typeof accepted.details.actor).toBe('string')
  expect(Array.isArray(json.openFindings)).toBe(true)
  expect(typeof json.upkeepOwner.name).toBe('string')
  expect(json.upkeepOwner.name.length).toBeGreaterThan(0)

  for (const item of json.segments) {
    expect(item.passLabel).toBe(!item.pass || item.pass.state === 'none' ? 'No pass yet: unknown' : item.pass.state)
    expect(typeof item.segment.simulated).toBe('boolean')
    if (item.pass) {
      expect(typeof item.pass.simulated).toBe('boolean')
    }
  }
  for (const item of json.openFindings) {
    expect(typeof item.simulated).toBe('boolean')
  }
})

test('AC84-2 someone who may not read the audit trail sees that the re-test details need a manager', async ({
  page
}) => {
  await page.goto('demo/')
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  await confirmS1(page)
  const { retestId, assetId } = await setUpAcceptedRetest(page)
  await signInAs(page, 'Lim Wei Jie')
  await openBoard(page)
  await selectAsset(page, assetId)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download JSON' }).click()
  const file = await download
  const json = JSON.parse(Buffer.concat(await (await file.createReadStream()).toArray()).toString('utf8'))
  const accepted = json.acceptedRetests.find((r: any) => r.id === retestId)
  expect(accepted.details).toBe('needs a manager or general manager')
  expect(accepted.labelsFrom).toBe('pass')
  expect(typeof accepted.simulated).toBe('boolean')
  expect(typeof accepted.source).toBe('string')
})

test('AC84-3 the printable page prints black on white even in the dark theme', async ({ page }) => {
  await page.goto('demo/')
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  await confirmS1(page)
  const { assetId } = await setUpAcceptedRetest(page)
  await openBoard(page)
  await selectAsset(page, assetId)
  await page.getByRole('button', { name: 'Printable page' }).click()
  const heading = page.getByRole('heading', { level: 1, name: /^Handover pack for/ })
  await expect(heading).toBeVisible()
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' })
  await expect(heading).toHaveCSS('color', 'rgb(0, 0, 0)')
  expect(await page.getByRole('cell', { name: /No pass yet: unknown/ }).count()).toBeGreaterThan(0)
  expect(await page.getByRole('cell', { name: /^none/ }).count()).toBe(0)
  await page.emulateMedia({ media: 'screen' })
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(heading).toBeHidden()
})
