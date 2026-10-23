import type { Locator, Page } from '@playwright/test'
import { join } from 'node:path'
import { expect, test } from '../../e2e/fixtures'
import { hold, recordTake } from './take'

test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 })

const FIXTURE = join(import.meta.dirname, 'fixtures', 'retest.png')
const REPAIR_CHECKS = [
  'Saved view 1',
  'Saved view 2',
  'Playground path, through the panel gap',
  'Playground path, around the fence end',
  'Panel gap gauge',
  'Fence end gauge',
  'Re-test photo'
]

const profile = (page: Page) => page.getByRole('banner').getByRole('button', { expanded: false })

async function signInAs(page: Page, name: string) {
  await profile(page).click()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await expect(profile(page)).toHaveAccessibleName(new RegExp(`^${name}`))
}

async function scrollSlowly(page: Page, target: Locator, steps = 4, amount = 160) {
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  if (box) await page.mouse.move(box.x + box.width / 2, Math.min(Math.max(box.y + 100, 120), 950))
  for (let step = 0; step < steps; step++) {
    await page.mouse.wheel(0, amount)
    await hold(page, 150)
  }
}

async function uploadedRetestPhoto(page: Page) {
  return page
    .getByRole('region', { name: 'Re-test photo', exact: true })
    .getByRole('img', { name: 'After repair', exact: true })
}

async function fillPass(page: Page, name: string) {
  await page
    .getByRole('radiogroup', { name: `${name} result` })
    .getByRole('radio', { name: 'Pass' })
    .check()
  await page.getByRole('textbox', { name: `Reason for ${name}`, exact: true }).fill('Seen on site')
}

test('@app D2 to D5 confirm, fix, prove and record', async ({ page }) => {
  await page.goto('demo/?as=manager#/inbox')
  const inboxRow = page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Playground path, fence line/ })
    .first()
  await expect(inboxRow).toBeVisible()
  await inboxRow.click()
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' }).first()).toBeVisible()

  await recordTake(page, 'D2', async (cue) => {
    await cue('d2-card', page.getByRole('heading', { name: 'Fence panel 4 missing' }).first())
    await hold(page, 2000)
    await cue(
      'd2-consequence',
      page.getByText('A new flag like this pauses a valid pass. Confirming it does not restore the pass.', {
        exact: true
      })
    )
    await hold(page, 1500)
    const confirm = page.getByRole('button', { name: 'Confirm: needs a fix', exact: true })
    await cue('d2-confirm', confirm)
    await hold(page, 1000)
    await confirm.click()
    await cue('d2-finding', page.getByRole('region', { name: /^Finding / }).first())
    await hold(page, 6000)
  })

  await signInAs(page, 'Siti Aminah')
  await page.getByRole('button', { name: 'Mark done' }).click()
  await expect(page.getByText('Marked done by Siti Aminah')).toBeVisible()
  await signInAs(page, 'Farah Hashim')

  await page.getByRole('link', { name: 'Choose a fix' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fix Lens' })).toBeVisible()

  await recordTake(page, 'D3', async (cue) => {
    await cue('d3-lens', page.getByRole('heading', { level: 1, name: 'Fix Lens' }))
    await hold(page, 2000)
    await page.getByRole('button', { name: 'Use the S2 sample markings' }).click()
    await cue('d3-marked', page.getByText('2 openings and 2 ways recorded.', { exact: true }))
    await hold(page, 3000)
    await page.getByRole('button', { name: 'Next: compare fixes' }).click()
    await page.getByRole('button', { name: 'Use the two sample fixes' }).click()
    await cue('d3-proposed', page.getByText(/proposed repair, not installed/i).first())
    await hold(page, 3500)
    await cue(
      'd3-fix-a-open',
      page.getByText('Leaves 1 way to the water open, Playground path, around the fence end', { exact: true })
    )
    await hold(page, 4500)
    await cue('d3-fix-b-closed', page.getByText('Closes all 2 ways to the water', { exact: true }))
    await hold(page, 4500)
    const fixB = page.getByRole('radio', { name: /^B ·/ })
    await fixB.check()
    await expect(fixB).toBeChecked()
    await cue('d3-pick-b', fixB)
    await hold(page, 6500)
  })

  await signInAs(page, 'Lim Wei Jie')
  await expect(page.getByRole('button', { name: 'Approve fix B as Lim Wei Jie' })).toBeEnabled()
  await recordTake(page, 'D3b-approve', async (cue) => {
    await page.getByRole('button', { name: 'Approve fix B as Lim Wei Jie' }).click()
    await cue('d3b-approved', page.getByText('Approved by Lim Wei Jie', { exact: true }))
    await hold(page, 2000)
  })

  await signInAs(page, 'Farah Hashim')
  const sendB = page.getByRole('button', { name: /^Send fix B to .+ crew$/ })
  await expect(sendB).toBeEnabled()
  await recordTake(page, 'D3b-send', async (cue) => {
    await hold(page, 500)
    await sendB.click()
    await cue('d3b-sent', page.getByRole('heading', { name: /^Fix B sent to .+ crew$/ }))
    await hold(page, 2000)
  })

  const repairHref = await page.getByRole('link', { name: 'Open the repair check' }).getAttribute('href')
  if (!repairHref) throw new Error('D3b-send did not leave the repair check address')

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Inbox' }).click()
  const buoyRow = page
    .getByRole('navigation', { name: 'Inbox list' })
    .getByRole('button', { name: /Playground path, ring buoy post/ })
    .first()
  await expect(buoyRow).toBeVisible()
  await buoyRow.click()
  await page.getByRole('button', { name: 'Not a problem', exact: true }).click()
  await page.getByLabel('Reason for rejecting').fill('The buoy was moved for the swim lesson')
  await page.getByRole('button', { name: 'Submit rejection' }).click()
  await expect(page.getByText('Rejected by Farah Hashim')).toBeVisible()

  await page.evaluate((href) => {
    window.location.hash = href
  }, repairHref)
  await expect(page.getByRole('heading', { level: 1, name: 'Repair check' })).toBeVisible()

  await signInAs(page, 'Hafiz Rahman')
  await page.getByRole('button', { name: 'Start work' }).click()
  await page
    .getByRole('textbox', { name: 'Note for the person who checks it' })
    .fill('Panel 4 replaced, fence extended')
  await page.getByRole('button', { name: 'Mark work complete' }).click()
  await expect(page.getByRole('heading', { name: 'A different person checks this repair' })).toBeVisible()

  await signInAs(page, 'Priya Nair')
  await page.setViewportSize({ width: 390, height: 844 })

  await recordTake(page, 'D4', async (cue) => {
    await cue('d4-heading', page.getByRole('heading', { name: 'A different person checks this repair' }))
    await cue('d4-count', page.getByRole('heading', { name: '7 checks at the fence' }))
    await hold(page, 1000)

    const first = REPAIR_CHECKS[2]!
    await page
      .getByRole('radiogroup', { name: `${first} result` })
      .getByRole('radio', { name: 'Pass' })
      .check()
    const firstReason = page.getByRole('textbox', { name: `Reason for ${first}`, exact: true })
    await firstReason.scrollIntoViewIfNeeded()
    await firstReason.click()
    await firstReason.pressSequentially('Seen on site', { delay: 40 })
    await cue('d4-first', firstReason)
    await hold(page, 3500)

    const second = REPAIR_CHECKS[3]!
    await page
      .getByRole('radiogroup', { name: `${second} result` })
      .getByRole('radio', { name: 'Pass' })
      .check()
    const secondReason = page.getByRole('textbox', { name: `Reason for ${second}`, exact: true })
    await secondReason.scrollIntoViewIfNeeded()
    await secondReason.click()
    await secondReason.pressSequentially('Seen on site', { delay: 40 })
    await hold(page, 500)

    for (const name of REPAIR_CHECKS.filter((item) => item !== first && item !== second && item !== 'Re-test photo'))
      await fillPass(page, name)

    const photoRegion = page.getByRole('region', { name: 'Re-test photo', exact: true })
    await photoRegion.scrollIntoViewIfNeeded()
    const upload = photoRegion.getByLabel('Upload from gallery', { exact: true })
    await upload.setInputFiles(FIXTURE)
    const photo = await uploadedRetestPhoto(page)
    await expect(photo).toBeVisible()
    await expect
      .poll(() => photo.evaluate((el) => el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0))
      .toBe(true)
    await cue('d4-photo', photo)
    await hold(page, 2500)

    await page.getByRole('radiogroup', { name: 'Re-test photo result' }).getByRole('radio', { name: 'Pass' }).check()
    await page.getByRole('textbox', { name: 'Reason for Re-test photo', exact: true }).fill('Photo matches')

    const sign = page.getByRole('button', { name: 'Sign and issue the pass' })
    await expect(sign).toBeEnabled()
    await sign.scrollIntoViewIfNeeded()
    await cue('d4-sign', sign)
    await hold(page, 1500)
    await sign.click()
    await cue('d4-issued', page.getByRole('heading', { name: 'Safety pass issued' }))
    await hold(page, 5000)
  })

  await page.setViewportSize({ width: 1920, height: 1080 })
  await signInAs(page, 'Farah Hashim')
  await expect(page.getByRole('heading', { name: 'Safety pass issued' })).toBeVisible()

  await recordTake(page, 'D5-pass', async (cue) => {
    await cue('d5-pass', page.getByRole('heading', { name: 'Safety pass issued' }))
    await cue('d5-signed', page.getByText(/who signed the check/i).first())
    const history = page.getByRole('region', { name: 'How it got here' })
    await cue('d5-timeline', history.getByText('Checked and signed', { exact: true }))
    await hold(page, 1000)
    await scrollSlowly(page, history)
    await hold(page, 11000)
  })

  await recordTake(page, 'D5-board', async (cue) => {
    await hold(page, 500)
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Passes' }).click()
    await cue('d5-board', page.getByRole('heading', { name: 'Action needed', exact: true }))
    await cue('d5-unknown', page.getByText(/Unknown is never shown as safe/i))
    await hold(page, 1500)
    await page.mouse.move(960, 760)
    for (let step = 0; step < 3; step++) {
      await page.mouse.wheel(0, 220)
      await hold(page, 180)
    }
    await hold(page, 3000)
  })
})

test('@app H2 landing hero', async ({ page }) => {
  await page.goto('/')
  const hero = page.getByRole('heading', { level: 1, name: 'Every water edge, closed and proven.' })
  await expect(hero).toBeVisible()

  await recordTake(
    page,
    'H2',
    async (cue) => {
      await cue('h2-hero', hero)
      await cue('h2-tag', page.getByText('Panel 4 missing', { exact: true }).first())
      await hold(page, 6000)
    },
    { labelled: false }
  )
})

test('@app D6 agent guardrail', async ({ page }) => {
  await page.goto('demo/?as=manager#/agent')
  const question = page.getByRole('heading', { name: 'Can the agent decide anything?' })
  await expect(question).toBeVisible()

  await recordTake(page, 'D6', async (cue) => {
    await cue('d6-question', question)
    await hold(page, 1000)
    await page.getByRole('button', { name: 'Ask core as the agent' }).click()
    await cue('d6-refused', page.getByText('Refused, as it must be.'))
    await cue('d6-rule', page.getByText('agents_draft_only', { exact: true }).first())
    await cue(
      'd6-audit',
      page.locator('section[aria-labelledby="ag-activity"]').getByText('Refused · agents_draft_only', { exact: true })
    )
    await hold(page, 11000)
  })
})

test('@app D7 developers quickstart', async ({ page }) => {
  await page.goto('demo/?as=manager#/developers')
  const quickstart = page.getByRole('heading', { name: 'Quickstart' })
  await expect(quickstart).toBeVisible()

  await recordTake(page, 'D7', async (cue) => {
    await hold(page, 500)
    await quickstart.scrollIntoViewIfNeeded()
    await cue('d7-quickstart', quickstart)
    await hold(page, 4000)
  })
})
