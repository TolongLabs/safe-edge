import { expect, test, type APIRequestContext } from '@playwright/test'

// The browser tests run against the prebuilt site that deploys to Vercel (#58): the landing page at /, the web app
// at /demo/.

test('the demo site serves the landing page, the app and the scene', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Safe Edge · every water edge, closed and proven')
  await page.goto('demo/')
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Map' }).click()
  await expect(page).toHaveURL(/\/demo\/scene\.html$/)
  await expect(page.locator('canvas')).toBeVisible({ timeout: 90_000 })
})

/** The scripts a page's HTML loads: its module entry and the chunks it preloads. */
async function scriptsOf(request: APIRequestContext, path: string) {
  const html = await (await request.get(path)).text()
  const urls = [...html.matchAll(/<(?:script[^>]*\ssrc|link rel="modulepreload"[^>]*\shref)="([^"]+)"/g)].map(
    (match) => match[1]!
  )
  expect(urls.length).toBeGreaterThan(0)
  return (await Promise.all(urls.map(async (url) => (await request.get(url)).text()))).join('\n')
}

/** A licences.md file's sections by package name, each with the licence text under its heading. */
function licenceTexts(markdown: string) {
  return new Map(
    markdown
      .split('\n## ')
      .slice(1)
      .map((section) => {
        const [heading, ...text] = section.split('\n')
        return [heading!.split(' - ')[0]!, text.join('\n').trim()]
      })
  )
}

test('the licence notices ship with the code (#245)', async ({ request }) => {
  // GSAP's licence forbids removing its notice; React's names its MIT licence.
  const site = await scriptsOf(request, '/')
  expect(site.includes('Subject to the terms at https://gsap.com/standard-license')).toBe(true)
  const web = await scriptsOf(request, 'demo/')
  expect(web.includes('@license React')).toBe(true)

  // Each app's licences.md carries the licence text its dependencies ship, not only their names.
  for (const [path, names] of [
    ['licences.md', ['lenis', '@fontsource/atkinson-hyperlegible-next']],
    ['demo/licences.md', ['react', 'three', 'zod']]
  ] as const) {
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    const texts = licenceTexts(await response.text())
    for (const name of names) expect(texts.get(name), `${path}: ${name}`).toMatch(/Copyright/)
  }
})
