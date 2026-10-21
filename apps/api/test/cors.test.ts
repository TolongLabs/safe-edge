// A page on another origin, such as the web demo's Developers page with a person's own token, may call the API only
// when SAFE_EDGE_CORS_ORIGINS lists that exact origin. Unset, the API sends no CORS headers and browsers refuse it.
import { afterAll, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { freePort } from '../../../test/spawn.ts'
import { refusedStart, startApiProcess } from './process.ts'
import { startApi } from './support.ts'

const WEB = 'http://localhost:5199'
const OTHER = 'https://elsewhere.example'
const allowed = startApi({ corsOrigins: [WEB, 'https://demo.sdp.example'] })
const closed = startApi()

/** The preflight a browser sends before the SDK's POST, with its Authorization, Content-Type and Idempotency-Key. */
const preflight = (api: typeof allowed, origin: string) =>
  api.request('options', '/candidates', {
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'authorization,content-type,idempotency-key'
    }
  })
const getMe = (api: typeof allowed, origin: string) =>
  api.request('get', '/me', { token: 'tok_manager', headers: { origin } })

test('a listed origin passes the preflight for the methods and headers the SDK sends, then reads', async () => {
  const pre = await preflight(allowed, WEB)
  expect(pre.status).toBe(204)
  expect(pre.headers.get('access-control-allow-origin')).toBe(WEB)
  expect(pre.headers.get('access-control-allow-methods')?.split(',').toSorted()).toEqual(['GET', 'PATCH', 'POST'])
  expect(pre.headers.get('access-control-allow-headers')).toBe('Authorization,Content-Type,Idempotency-Key')
  // Tokens travel in Authorization, so the browser never sends cookies.
  expect(pre.headers.get('access-control-allow-credentials')).toBeNull()

  const me = await getMe(allowed, WEB)
  expect(me.status).toBe(200)
  expect(me.headers.get('access-control-allow-origin')).toBe(WEB)
  expect(me.headers.get('vary')).toContain('Origin')
  expect(await me.json()).toMatchObject({ id: 'usr_manager' })

  // The event stream too; cancelling its body hangs up.
  const events = await allowed.request('get', '/events', {
    token: 'tok_manager',
    headers: { origin: WEB, accept: 'text/event-stream' }
  })
  expect(events.headers.get('content-type')).toStartWith('text/event-stream')
  expect(events.headers.get('access-control-allow-origin')).toBe(WEB)
  await events.body?.cancel()
})

test('an origin not on the list gets no CORS headers, so its browser refuses the answer', async () => {
  const pre = await preflight(allowed, OTHER)
  expect(pre.headers.get('access-control-allow-origin')).toBeNull()
  const me = await getMe(allowed, OTHER)
  expect(me.status).toBe(200)
  expect(me.headers.get('access-control-allow-origin')).toBeNull()
})

test('without the option the API sends no CORS headers at all', async () => {
  const pre = await preflight(closed, WEB)
  expect(pre.headers.get('access-control-allow-origin')).toBeNull()
  expect(pre.headers.get('access-control-allow-methods')).toBeNull()
  const me = await getMe(closed, WEB)
  expect(me.headers.get('access-control-allow-origin')).toBeNull()
})

test('the entry reads SAFE_EDGE_CORS_ORIGINS, refuses an entry that is not an origin, and bun run dev allows the web app', async () => {
  const listed = await startApiProcess({ SAFE_EDGE_CORS_ORIGINS: `${WEB}, https://demo.sdp.example` })
  const read = (url: string, origin: string) =>
    fetch(`${url}/v1/me`, { headers: { authorization: 'Bearer tok_manager', origin } })
  expect((await read(listed.url, WEB)).headers.get('access-control-allow-origin')).toBe(WEB)
  expect((await read(listed.url, 'https://demo.sdp.example')).headers.get('access-control-allow-origin')).toBe(
    'https://demo.sdp.example'
  )
  expect((await read(listed.url, OTHER)).headers.get('access-control-allow-origin')).toBeNull()

  const unset = await startApiProcess({})
  expect((await read(unset.url, WEB)).headers.get('access-control-allow-origin')).toBeNull()

  const notOrigin = await refusedStart({ SAFE_EDGE_CORS_ORIGINS: `${WEB}/#/settings` })
  expect(notOrigin.code).toBe(1)
  expect(notOrigin.stderr).toContain(
    'SAFE_EDGE_CORS_ORIGINS lists exact origins such as http://localhost:5173, not "http://localhost:5199/#/settings"'
  )

  // bun run dev allows the web app's dev server on WEB_PORT (5173 unless set), with this run's own dev tokens.
  const stateHome = await mkdtemp(join(tmpdir(), 'safe-edge-cors-'))
  afterAll(() => rm(stateHome, { recursive: true }))
  const webPort = freePort()
  const dev = await startApiProcess({ XDG_STATE_HOME: stateHome, WEB_PORT: String(webPort) }, 'dev')
  const health = await fetch(`${dev.url}/v1/health`, { headers: { origin: `http://localhost:${webPort}` } })
  expect(health.headers.get('access-control-allow-origin')).toBe(`http://localhost:${webPort}`)
}, 60_000)
