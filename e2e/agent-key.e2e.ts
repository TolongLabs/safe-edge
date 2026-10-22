import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './fixtures'

// The agent runs in the page with the person's own Anthropic key (Settings). Claude is replaced at the network
// boundary: the key check passes or fails by `accept`, and Messages requests replay recordings of real answers
// (apps/api/test/fixtures/claude), one exchange per request, so these tests stay offline and need no key.

type Recording = { exchanges: { response: { status: number; body: string } }[] }
const recording = (name: string): Recording =>
  JSON.parse(readFileSync(join(__dirname, '../apps/api/test/fixtures/claude', `${name}.json`), 'utf8'))

// Anthropic's API answers the browser with CORS headers; the stand-in does the same, preflight included.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS'
}

async function claude(page: Page, { replay, take }: { replay?: string; take?: number } = {}) {
  const state = { accept: true }
  const exchanges = replay ? recording(replay).exchanges.slice(0, take) : []
  const unexpected: string[] = []
  await page.route('https://api.anthropic.com/**', async (route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    if (pathname === '/v1/models/claude-opus-5-5' && state.accept)
      return route.fulfill({
        headers: CORS,
        json: {
          type: 'model',
          id: 'claude-opus-5-5',
          display_name: 'Claude Opus 5.5',
          created_at: '2026-01-01T00:00:00Z'
        }
      })
    if (pathname.startsWith('/v1/models/'))
      return route.fulfill({
        status: 401,
        headers: CORS,
        json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }
      })
    const next = pathname === '/v1/messages' ? exchanges.shift() : undefined
    if (next)
      return route.fulfill({
        status: next.response.status,
        headers: { ...CORS, 'content-type': 'text/event-stream' },
        body: next.response.body
      })
    unexpected.push(`${request.method()} ${pathname}`)
    return route.fulfill({
      status: 500,
      headers: CORS,
      json: { type: 'error', error: { type: 'api_error', message: 'unexpected request' } }
    })
  })
  return {
    /** Whether the key check passes. */
    set accept(value: boolean) {
      state.accept = value
    },
    /** Every recorded answer was asked for, and nothing else was. */
    done: () => {
      expect(unexpected, 'requests the recording has no answer for').toEqual([])
      expect(exchanges, 'recorded answers never asked for').toHaveLength(0)
    }
  }
}

test('Settings checks an Anthropic key with Anthropic before saving it, and forgets it', async ({ page }) => {
  const anthropic = await claude(page)
  anthropic.accept = false
  await page.goto('demo/#/settings')
  const field = page.getByLabel('Anthropic API key')
  const save = page.getByRole('button', { name: 'Save key' })

  await save.click()
  await expect(page.getByRole('alert')).toHaveText('Paste a key first.')

  await field.fill('a-wrong-key')
  await save.click()
  await expect(page.getByRole('alert')).toContainText('Anthropic refused this key (401)')
  await expect(field).toHaveAttribute('aria-invalid', 'true')

  anthropic.accept = true
  await field.fill('a-good-key-1234')
  await save.click()
  await expect(
    page.getByText('Saved: the key ending in 1234. Anthropic confirmed it can use Claude Opus 5.5.')
  ).toBeVisible()
  await expect(page.getByLabel('Replace the key')).toHaveValue('')

  // Kept for the tab, across a reload, until the person forgets it.
  await page.reload()
  await expect(page.getByText('Saved: the key ending in 1234.')).toBeVisible()
  await page.getByRole('button', { name: 'Forget key' }).click()
  await expect(page.getByLabel('Anthropic API key')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('safeEdge.anthropicKey'))).toBeNull()
  anthropic.done()
})

test('the profile menu opens Settings', async ({ page }) => {
  await page.goto('demo/')
  await page.getByRole('banner').getByRole('button', { expanded: false }).click()
  await page.getByRole('group', { name: 'Profile menu' }).getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(page).toHaveTitle('Settings · Safe Edge')
})

// The recordings were made against the seed on 20 Oct 2026; the tools count days from the page's clock.
const RECORDED_DAY = new Date('2026-10-20T08:00:00+08:00')
const withKey = (page: Page) =>
  page.addInitScript(() => sessionStorage.setItem('safeEdge.anthropicKey', 'test-key-0000'))

test('without a key, each agent action is disabled and says where to add one', async ({ page }) => {
  await page.goto('demo/#/agent')
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toHaveAccessibleDescription(
    /your own Anthropic key/
  )
  await page.goto('demo/#/inbox')
  await expect(page.getByRole('button', { name: 'Summarise with the agent' })).toBeDisabled()
  await page.getByRole('link', { name: 'Add it in Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
})

test('Ask the agent streams an answer and names the records it read', async ({ page }) => {
  await page.clock.setFixedTime(RECORDED_DAY)
  await withKey(page)
  const anthropic = await claude(page, { replay: 'ask-expiring-passes' })
  await page.goto('demo/#/agent')
  await page.getByLabel('Your question').fill('Which passes expire in the next 30 days?')
  await page.getByLabel('Your question').press('Enter')
  const ask = page.getByRole('region', { name: 'Ask the agent' })
  await expect(
    ask.getByText(/^One pass expires in the next 30 days, counting from 2026-10-20:\s+- pass_866518980_5/)
  ).toBeVisible()
  await expect(ask.getByText('AI suggestion, unvalidated')).toBeVisible()
  await expect(ask.getByText(/sources pass_866518980_5/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeEnabled()
  anthropic.done()
})

test('the agent summarises an Inbox flag; the card shows its words as an AI suggestion', async ({ page }) => {
  await page.clock.setFixedTime(RECORDED_DAY)
  await withKey(page)
  // The first two exchanges of the recording: the pending candidate's summary.
  const anthropic = await claude(page, { replay: 'inbox-s1', take: 2 })
  await page.goto('demo/#/inbox')
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  await expect(page.getByText(/^Sample summary, not written by the agent/)).toBeVisible()
  await page.getByRole('button', { name: 'Summarise with the agent' }).click()
  await expect(page.getByText(/^Candidate cand_1 \(simulated, from provider usr_drone_sim\)/)).toBeVisible()
  await expect(page.getByText(/AI suggestion, unvalidated · written by the agent with claude-opus-5-5/)).toBeVisible()
  await expect(page.getByText(/^Sample summary, not written by the agent/)).toHaveCount(0)
  anthropic.done()
})

test('the agent drafts the monthly report; a person still sends it', async ({ page }) => {
  await page.clock.setFixedTime(RECORDED_DAY)
  await withKey(page)
  const anthropic = await claude(page, { replay: 'monthly-report' })
  await page.goto('demo/#/passes')
  await page.getByRole('button', { name: 'Draft with the agent' }).click()
  const notice = page.getByRole('region', { name: /^Monthly report/ }).getByRole('article')
  await expect(notice.getByText('Drafted by Safe Edge agent · not sent')).toBeVisible()
  await expect(notice.getByText(/AI suggestion, unvalidated · written by the agent with claude-opus-5-5/)).toBeVisible()
  anthropic.done()
})

test('Settings connects Try it to a live API with a token it checks first', async ({ page }) => {
  const api = 'http://127.0.0.1:3999/v1'
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
  // A stand-in for a running Safe Edge API that lists this page's origin in SAFE_EDGE_CORS_ORIGINS.
  await page.route(`${api}/**`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const token = route.request().headers().authorization
    if (token !== 'Bearer live-token')
      return route.fulfill({
        status: 401,
        headers: cors,
        json: { ok: false, error: 'unauthenticated', message: 'Unknown bearer token' }
      })
    return route.fulfill({
      headers: cors,
      json: { type: 'user', id: 'usr_manager', role: 'manager', scopes: ['edge.read'] }
    })
  })
  await page.goto('demo/#/settings')
  await page.getByLabel('API base URL').fill(`${api}/`)
  await page.getByLabel('API token').fill('wrong')
  await page.getByRole('button', { name: 'Connect' }).click()
  await expect(page.getByRole('alert')).toContainText('The API refused this token (401)')

  await page.getByLabel('API token').fill('live-token')
  await page.getByRole('button', { name: 'Connect' }).click()
  await expect(page.getByText(`Connected to ${api} as usr_manager (manager).`)).toBeVisible()

  await page.getByRole('link', { name: 'Try it' }).click()
  await expect(page.getByText(`Runs against the live API at ${api} as usr_manager (manager).`)).toBeVisible()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByText(`getMe as usr_manager (manager) · ${api}`)).toBeVisible()
})
