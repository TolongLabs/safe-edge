import { expect, test, type Page } from '@playwright/test'

// The scene tells one story, S1 to S3, in four chapters: it opens on the problem, plays one caption at a time, holds
// each long enough to read, and ends on the proven pass. The old panel's controls live in a details menu.

const HEADLINE = 'A fence panel is missing. A child on the path can reach deep water.'
const SOLUTION = 'Safe Edge finds gaps like this, gets them fixed, and proves the fix before the edge counts as safe.'
const TAKEOFF = 'A dry morning. The drone takes off from the roof dock to photograph each edge.'

const story = (page: Page) => page.getByRole('region', { name: 'Story' })
const caption = (page: Page) => page.getByTestId('caption')
const current = (page: Page) => page.getByRole('list', { name: 'Chapters' }).locator('[aria-current="step"]')

async function open(page: Page, path = 'demo/') {
  await page.goto(path)
  await expect(page.locator('canvas')).toBeVisible({ timeout: 90_000 })
}

/** Plays the story from the first screen. */
async function play(page: Page) {
  await story(page)
    .getByRole('button', { name: /^Play the story/ })
    .click()
}

test('the first screen states the problem and the solution', async ({ page }) => {
  await open(page)
  await expect(page.getByRole('heading', { name: HEADLINE })).toBeVisible()
  await expect(page.getByText(SOLUTION)).toBeVisible()
  await expect(story(page).getByRole('button', { name: /^Play the story · about \d+ s$/ })).toBeVisible()
  await expect(story(page).getByRole('button', { name: 'Look around' })).toBeVisible()
})

test('the story reaches Prove and ends on the pass', async ({ page }) => {
  test.setTimeout(300_000)
  await open(page)
  await play(page)
  await expect(current(page)).toHaveText(/1\s*Spot/)
  await expect(current(page)).toHaveText(/4\s*Prove/, { timeout: 240_000 })
  await expect(story(page).getByText('Safety pass issued, valid to 22 Oct 2027')).toBeVisible({ timeout: 30_000 })
  await expect(story(page).getByRole('button', { name: 'Play again' })).toBeVisible()
  await expect(story(page).getByRole('button', { name: 'Look around' })).toBeVisible()
})

test('captions hold for at least 3 s', async ({ page }) => {
  test.setTimeout(300_000)
  await open(page)
  await play(page)
  await expect(caption(page)).toBeVisible()
  // Watch the whole story, to the end card: S2's captions are minutes apart in story time, so they would flash past
  // at the ground rate without their hold.
  const gaps = await caption(page).evaluate(
    (el, ms) =>
      new Promise<number[]>((done) => {
        const changes: number[] = []
        let text = el.textContent
        const observer = new MutationObserver(() => {
          if (el.textContent === text) return
          text = el.textContent
          changes.push(performance.now())
        })
        observer.observe(el, { childList: true, characterData: true, subtree: true })
        const finish = () => {
          observer.disconnect()
          clearInterval(watch)
          done(changes.slice(1).map((t, i) => t - changes[i]!))
        }
        const watch = setInterval(() => !el.isConnected && finish(), 250)
        setTimeout(finish, ms)
      }),
    240_000
  )
  // Eleven captions follow the first; the last gap ends at the end card, which removes the caption.
  expect(gaps.length).toBeGreaterThanOrEqual(9)
  for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(2_900)
})

test('Pause during a hold stays paused', async ({ page }) => {
  test.setTimeout(180_000)
  await open(page)
  await play(page)
  await expect(caption(page)).toHaveText(TAKEOFF, { timeout: 60_000 })
  await story(page).getByRole('button', { name: 'Pause' }).click()
  const clock = await story(page).locator('time').textContent()
  await page.waitForTimeout(5_000)
  await expect(caption(page)).toHaveText(TAKEOFF)
  await expect(story(page).locator('time')).toHaveText(clock!)
})

test('a hidden tab holds the caption', async ({ page }) => {
  test.setTimeout(180_000)
  await open(page)
  await play(page)
  await expect(caption(page)).toHaveText(TAKEOFF, { timeout: 60_000 })
  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { value, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }, hidden)
  await setHidden(true)
  await page.waitForTimeout(5_000)
  await expect(caption(page)).toHaveText(TAKEOFF)
  const shownAt = Date.now()
  await setHidden(false)
  await expect(caption(page)).not.toHaveText(TAKEOFF, { timeout: 60_000 })
  expect(Date.now() - shownAt).toBeGreaterThanOrEqual(2_900)
})

test('Look around hides the card and brings it back', async ({ page }) => {
  await open(page)
  await story(page).getByRole('button', { name: 'Look around' }).click()
  await expect(page.getByRole('heading', { name: HEADLINE })).toBeHidden()
  await page.getByRole('button', { name: /^Play the story/ }).click()
  await expect(page.getByRole('heading', { name: HEADLINE })).toBeVisible()
})

test('details hold the old controls', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Details' }).click()
  const details = page.getByRole('region', { name: 'Details' })
  await expect(details.getByRole('combobox', { name: 'Scenario' })).toBeVisible()
  await expect(details.getByRole('slider', { name: 'Scenario time' })).toBeVisible()
  await expect(details.getByRole('combobox', { name: 'Speed' })).toBeVisible()
  await expect(details.getByText(/Real reading/)).toBeVisible()
  await expect(details.getByRole('complementary', { name: 'Legend' })).toBeVisible()
  const options = await details.getByRole('combobox', { name: 'Scenario' }).locator('option').allTextContents()
  expect(options.filter((o) => /^S[1-6],/.test(o))).toHaveLength(6)
})

test('a segment link keeps the camera on that segment', async ({ page }) => {
  await open(page, 'demo/scene.html?segment=seg_866518980_5&distance=200')
  await expect(story(page).getByRole('button', { name: /^Play the story/ })).toBeEnabled({ timeout: 90_000 })
  await expect(page.locator('canvas[data-focus]')).toHaveAttribute('data-focus', 'seg_866518980_5')
})

test('a scenario link opens details, not the story', async ({ page }) => {
  await open(page, 'demo/scene.html?scenario=s4')
  const details = page.getByRole('region', { name: 'Details' })
  await expect(details.getByRole('combobox', { name: 'Scenario' })).toHaveValue('s4')
  await expect(story(page)).toHaveCount(0)
})

test('Play again starts over', async ({ page }) => {
  test.setTimeout(300_000)
  await open(page)
  await play(page)
  await story(page).getByRole('button', { name: 'Play again' }).click({ timeout: 240_000 })
  await expect(current(page)).toHaveText(/1\s*Spot/)
  await expect(page.getByText('Fence panel 4 missing')).toHaveCount(0)
})

test.describe('on a 320 px phone', () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true })

  test('the story card holds its longest caption, its chapters and the controls strip', async ({ page }) => {
    await open(page)
    await play(page)
    await story(page).getByRole('button', { name: 'Pause' }).click()
    // The schema's longest caption, 120 characters, with an unbroken 28-letter word in it.
    await caption(page).evaluate((el) => (el.textContent = `${'W'.repeat(28)} ${'a'.repeat(4)} `.padEnd(120, 'x')))
    const card = (await story(page).boundingBox())!
    const inside = async (box: { x: number; y: number; width: number; height: number } | null) => {
      expect(box!.x).toBeGreaterThanOrEqual(card.x - 0.5)
      expect(box!.x + box!.width).toBeLessThanOrEqual(card.x + card.width + 0.5)
    }
    await inside(await caption(page).boundingBox())
    expect(await caption(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    for (const chip of await page.getByRole('list', { name: 'Chapters' }).getByRole('listitem').all())
      await inside(await chip.boundingBox())
    const hint = (await page.getByText(/Drag to rotate/).boundingBox())!
    expect(hint.y).toBeGreaterThanOrEqual(card.y + card.height)
  })

  test('every control uses the design font', async ({ page }) => {
    await open(page)
    const fonts = await page
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((b) => getComputedStyle(b).fontFamily))
    for (const font of fonts) expect(font).toContain('Atkinson Hyperlegible Next')
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test("the story's controls are full-size touch targets", async ({ page }) => {
    await open(page)
    for (const control of await page.getByRole('button').all()) {
      if (!(await control.isVisible())) continue
      expect((await control.boundingBox())!.height, (await control.textContent()) ?? '').toBeGreaterThanOrEqual(44)
    }
  })

  test('the story fits a phone', async ({ page }) => {
    await open(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    const box = (await story(page).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    expect(box.y + box.height).toBeLessThanOrEqual(844)
  })
})
