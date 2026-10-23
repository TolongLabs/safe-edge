import type { DamageIssueType, EvidenceRef } from '@safe-edge/contracts'
import type { Page } from '@playwright/test'
import type { MemoryClient } from '@safe-edge/sdk'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './fixtures'
import { uploadRetestPhoto } from './repair-photo'

type Presenter = { demo: MemoryClient; refresh: () => Promise<void> }

test.use({ viewport: { width: 390, height: 844 }, actionTimeout: 10_000 })
const beforePhoto = `data:image/jpeg;base64,${readFileSync(join(__dirname, 'fixtures', 'report-no-exif.jpg')).toString('base64')}`
const description = 'Tracker report: a fence panel is missing beside the lake.'
const profile = (page: Page) => page.getByRole('banner').getByRole('button', { expanded: false })
async function signInAs(page: Page, name: string) {
  await profile(page).click()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await page.keyboard.press('Escape')
}
const stages = (page: Page) => page.getByRole('region', { name: 'Repair stages', exact: true }).first()

/** Real core operations set up the people and records; every assertion and progress edit uses the UI. */
async function repair(page: Page, submitted = true, issueType: DamageIssueType = 'fence_missing', assigned = true) {
  await page.goto('demo/')
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  return page.evaluate(
    async ({ submitted, issueType, beforePhoto, description, assigned }) => {
      const { demo: d, refresh } = (window as unknown as { safeEdgeDemo: Presenter }).safeEdgeDemo
      const crew = d.as('usr_crew'),
        manager = d.as('usr_manager'),
        engineer = d.as('usr_engineer')
      const segmentId = 'seg_866518980_11'
      const segment = (await d.listSegments()).find((s) => s.id === segmentId)!
      const viewpoint = segment.viewpoints[1]!
      for (const c of await manager.listCandidates()) {
        if (c.status === 'candidate' && c.tier !== 3)
          await manager.decideCandidate({
            params: { id: c.id },
            body: { decision: 'reject', reason: 'Reviewed separately before this repair test.' }
          })
      }
      const image = {
        id: 'evd_tracker_before',
        mediaType: 'image/jpeg',
        uri: beforePhoto,
        sha256: null,
        capturedAt: new Date().toISOString(),
        simulated: true,
        source: 'fixture'
      } satisfies EvidenceRef
      const obs = await crew.recordObservation({
        body: {
          patrolId: null,
          segmentId,
          viewpointId: viewpoint.id,
          captureSource: 'phone',
          image,
          pose: viewpoint.pose,
          capturedAt: image.capturedAt,
          quality: { sharpness: 0.9, alignmentResidualPx: 1.2, occlusion: 0.05 },
          privacyAction: 'none',
          simulated: true
        }
      })
      const candidate = await crew.reportDamage({
        body: {
          segmentId,
          observationIds: [obs.id],
          inventoryItemId: null,
          itemStatus: null,
          class: 'worn_path',
          rationale: description,
          simulated: true,
          report: {
            description,
            observedAt: image.capturedAt,
            issueType,
            urgency: 'high',
            viewpointId: viewpoint.id,
            where: null,
            timeSource: 'manual',
            issueTypeOther: null,
            action: null,
            actionNote: null,
            cause: 'weather'
          }
        }
      })
      if (!submitted) {
        await refresh()
        return { candidateId: candidate.id, findingId: '', workOrderId: '', dueAt: '' }
      }
      await manager.decideCandidate({ params: { id: candidate.id }, body: { decision: 'confirm', severity: 'high' } })
      const finding = (await manager.listFindings()).find((f) => f.candidateId === candidate.id)!
      const task = (await crew.listTasks()).find((t) => t.findingId === finding.id && t.kind === 'interim_protection')!
      await crew.completeTask({ params: { id: task.id } })
      const opening = await manager.createOpening({
        body: { segmentId, type: 'fence_gap', photoMarks: [{ evidenceId: image.id, x: 0.5, y: 0.5 }], measuredMm: 1200 }
      })
      await manager.createRoute({
        body: {
          segmentId,
          fromFeature: { kind: 'play_area', label: 'Reported fence approach' },
          openingIds: [opening.id],
          status: 'open'
        }
      })
      const remedy = await engineer.createRemedy({
        body: {
          segmentId,
          type: 'panel_replacement',
          label: 'Replace the reported panel',
          blocksOpeningIds: [opening.id],
          quantities: [{ item: 'Fence panel', amount: 1, unit: 'panel' }],
          acceptanceTest: 'No gap over 100 mm',
          quote: { amount: 500, currency: 'MYR', date: new Date().toISOString().slice(0, 10) }
        }
      })
      await engineer.approveRemedy({ params: { id: remedy.id } })
      const order = (await manager.listWorkOrders()).find((w) => w.findingId === finding.id)!
      await manager.updateWorkOrder({ params: { id: order.id }, body: { remedyId: remedy.id } })
      const dueAt = new Date(Date.now() + 3 * 86_400_000).toISOString()
      if (assigned)
        await manager.submitWorkOrder({ params: { id: order.id }, body: { installerUserId: 'usr_installer', dueAt } })
      await refresh()
      return { candidateId: candidate.id, findingId: finding.id, workOrderId: order.id, dueAt }
    },
    { submitted, issueType, beforePhoto, description, assigned }
  )
}

async function openReportedCard(page: Page, decided = true) {
  await page.goto('demo/#/inbox')
  await page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('list', { name: decided ? 'Decided' : 'Open', exact: true })
    .getByRole('button', { name: /Playground path, fence line/ })
    .last()
    .click()
}
async function openInstaller(page: Page, workOrderId: string) {
  await signInAs(page, 'Hafiz Rahman')
  await page.goto(`demo/#/retest/${workOrderId}`)
  await page.getByRole('button', { name: 'Start work', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Repair started' })).toBeVisible()
}

test('AC230 one assigned journey appears in Inbox, the work order and the walker’s My reports; folds use mouse and Enter', async ({
  page
}) => {
  const ids = await repair(page)
  await openReportedCard(page)
  await expect(stages(page)).toContainText('Now with the installer: Hafiz Rahman')
  await expect(stages(page).locator('.nowline')).toContainText('Assigned')
  const installer = stages(page)
    .locator('details')
    .filter({ has: page.locator('summary .nm', { hasText: /^Installer$/ }) })
  await expect(installer).toHaveAttribute('open', '')
  await installer.locator('summary').click()
  await expect(installer).not.toHaveAttribute('open')
  await installer.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(installer).toHaveAttribute('open', '')
  await expect(installer.getByText('Buying materials', { exact: true })).toBeVisible()
  await page.goto(`demo/#/retest/${ids.workOrderId}`)
  await expect(stages(page)).toContainText('Now with the installer: Hafiz Rahman')
  await signInAs(page, 'Siti Aminah')
  await page.goto('demo/#/capture')
  const reports = page.getByRole('region', { name: 'My reports', exact: true })
  await expect(reports).toContainText(description)
  await expect(reports).toContainText('Now with the installer: Hafiz Rahman')
  await expect(reports.locator('.nowline')).toContainText('Assigned')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/tracker-my-reports-phone.png', fullPage: true })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: 'test-results/tracker-my-reports-phone-dark.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/tracker-my-reports-desktop-dark.png', fullPage: true })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.screenshot({ path: 'test-results/tracker-my-reports-desktop.png', fullPage: true })
})

for (const decision of ['reject', 'recapture'] as const) {
  test(`AC230 a ${decision} report ends truthfully without a work order or forecast crash`, async ({ page }) => {
    await repair(page, false)
    await openReportedCard(page, false)
    if (decision === 'reject') {
      await page.getByRole('button', { name: 'Not a problem', exact: true }).click()
      await page.getByLabel('Reason for rejecting').fill('The panel was moved for planned maintenance.')
      await page.getByRole('button', { name: 'Submit rejection' }).click()
    } else await page.getByRole('button', { name: 'Look again', exact: true }).click()
    await expect(stages(page)).toContainText(decision === 'reject' ? 'Not a problem' : 'Look again')
    await expect(stages(page)).not.toContainText('Now with the installer')
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}

test('AC231 and AC232 installer progress, delivery and reasoned due-date changes reach the manager', async ({
  page
}) => {
  const ids = await repair(page)
  await openInstaller(page, ids.workOrderId)
  await page.getByRole('combobox', { name: 'Repair progress', exact: true }).selectOption('buying_materials')
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(stages(page).locator('.nowline')).toContainText('Buying materials')
  await page.getByRole('combobox', { name: 'Repair progress', exact: true }).selectOption('waiting_for_delivery')
  await page.getByLabel('Expected delivery date').fill('2026-10-31')
  await page.getByLabel('Shipment tracking number').fill('ABC123')
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(stages(page).locator('.nowline')).toContainText('tracking ABC123')
  await expect(stages(page).locator('.nowline')).toContainText('expected 31 Oct 2026')
  await page.getByLabel('The supplier gave no tracking number').check()
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(stages(page).locator('.nowline')).toContainText('supplier gave no tracking number')
  await page.getByRole('combobox', { name: 'Repair progress', exact: true }).selectOption('fixing')
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(stages(page).locator('.nowline')).toContainText('Fixing')
  await expect(page.getByRole('button', { name: 'Change finish date' })).toBeDisabled()
  await page.getByLabel('New finish date').fill('2026-11-06')
  await page.getByLabel('Reason for changing finish date').fill('Delivery needs seven more days.')
  await page.getByRole('button', { name: 'Change finish date' }).click()
  await signInAs(page, 'Farah Hashim')
  await expect(stages(page)).toContainText('6 Nov 2026')
  await expect(stages(page)).toContainText('Delivery needs seven more days.')
  await expect(stages(page)).toContainText('Hafiz Rahman')
  const old = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur'
  }).format(new Date(ids.dueAt))
  await expect(stages(page)).toContainText(`Finish date moved ${old} → 6 Nov 2026`)
})

test('AC233 sample fence history shows its range and median; sparse types show no forecast', async ({ page }) => {
  const draft = await repair(page, true, 'fence_missing', false)
  await page.goto(`demo/#/fix-lens/${draft.findingId}`)
  await expect(page.getByRole('img', { name: 'Reported finding', exact: true })).toBeVisible()
  await signInAs(page, 'Lim Wei Jie')
  await page.evaluate(() => (window as unknown as { safeEdgeDemo: Presenter }).safeEdgeDemo.refresh())
  await expect(page.getByRole('banner').getByRole('button', { name: /Lim Wei Jie, Engineer/ })).toBeVisible()
  const engineerPhoto = page.getByRole('img', { name: 'Reported finding', exact: true })
  await expect(engineerPhoto).toBeVisible()
  await expect
    .poll(() => engineerPhoto.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0)
  await expect(page.getByRole('banner')).toContainText('Elmina Central Park lake, segment 12')
  await signInAs(page, 'Farah Hashim')
  await page.getByRole('button', { name: 'Compare fixes', exact: true }).click()
  await expect(page.getByLabel('Repair forecast', { exact: true })).toContainText(
    'Usually 4–9 days (median 6), from 4 past jobs, includes sample data'
  )
  await expect(page.getByRole('img', { name: 'Reported finding', exact: true })).toHaveCount(0)
  await page.reload()
  const ids = await repair(page)
  await page.goto(`demo/#/retest/${ids.workOrderId}`)
  await expect(stages(page)).toContainText('Usually 4–9 days (median 6), from 4 past jobs, includes sample data')
  await page.reload()
  const sparse = await repair(page, true, 'path_broken')
  await page.goto(`demo/#/retest/${sparse.workOrderId}`)
  await expect(stages(page).locator('.nowline')).toContainText('Assigned')
  await expect(stages(page).locator('.fc')).toHaveCount(0)
})

test('AC234 and AC235 spending is explained; a new real photo is required and shown beside the original', async ({
  page
}) => {
  const ids = await repair(page)
  await openInstaller(page, ids.workOrderId)
  await page
    .getByRole('textbox', { name: 'Note for the person who checks it' })
    .fill('Panel replaced and the approach closed.')
  await page.getByLabel('Amount spent (RM)').fill('620')
  await expect(page.getByRole('button', { name: 'Mark work complete' })).toBeDisabled()
  await page.getByLabel('Reason for spending more').fill('The supplier charged for a stronger panel.')
  await page.getByRole('button', { name: 'Mark work complete' }).click()
  await expect(page.getByRole('heading', { name: 'A different person checks this repair' })).toBeVisible()
  await signInAs(page, 'Farah Hashim')
  await expect(stages(page)).toContainText('RM 500')
  await expect(stages(page)).toContainText('RM 620')
  await expect(stages(page)).toContainText('The supplier charged for a stronger panel.')
  await signInAs(page, 'Priya Nair')
  await expect(page.getByRole('heading', { name: 'A different person checks this repair' })).toBeVisible()
  const photoPass = page.getByRole('radiogroup', { name: 'Re-test photo result' }).getByRole('radio', { name: 'Pass' })
  await expect(photoPass).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Sign and issue the pass' })).toBeDisabled()
  for (const group of await page.getByRole('radiogroup').all()) {
    const name = (await group.getAttribute('aria-label'))!.replace(/ result$/, '')
    if (name === 'Re-test photo') continue
    await group.getByRole('radio', { name: 'Pass' }).check()
    await page.getByRole('textbox', { name: `Reason for ${name}`, exact: true }).fill('Seen closed on site.')
  }
  await expect(page.getByText('Take or upload a photo to pass the re-test photo check.')).toBeVisible()
  await uploadRetestPhoto(page)
  const before = page.getByRole('img', { name: 'Before repair', exact: true })
  const after = page.getByRole('img', { name: 'After repair', exact: true })
  await expect(before).toBeVisible()
  await expect(after).toBeVisible()
  const left = (await before.boundingBox())!,
    right = (await after.boundingBox())!
  expect(left.x + left.width).toBeLessThanOrEqual(right.x + 1)
  await photoPass.check()
  await page
    .getByRole('textbox', { name: 'Reason for Re-test photo', exact: true })
    .fill('The new photo shows the closed approach.')
  await uploadRetestPhoto(page)
  await expect(photoPass).not.toBeChecked()
  await photoPass.check()
  await page.screenshot({ path: 'test-results/tracker-photo-phone.png', fullPage: true })
  await page.getByRole('button', { name: 'Sign and issue the pass' }).click()
  await expect(page.getByRole('heading', { name: 'Safety pass issued' })).toBeVisible()
  const evidence = await page.evaluate(async (id) => {
    const { retest } = await (window as unknown as { safeEdgeDemo: Presenter }).safeEdgeDemo.demo.getRepairJourney({
      params: { id }
    })
    return retest!.evidence[0]!
  }, ids.candidateId)
  expect(evidence.uri).toMatch(/^local:\/\//)
  expect(evidence.simulated).toBe(false)
  expect(evidence.id).not.toMatch(/sample/)
})
