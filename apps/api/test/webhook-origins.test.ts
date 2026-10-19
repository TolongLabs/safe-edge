// The webhook allowlist comes from SAFE_EDGE_WEBHOOK_ORIGINS, read by the API's entry. Loopback is allowed only in
// development and test, so a deployment that forgets NODE_ENV fails closed.
import { expect, test } from 'bun:test'
import { refusedStart, startApiProcess } from './process.ts'

const register = (api: Awaited<ReturnType<typeof startApiProcess>>, url: string) =>
  api.request('post', '/webhooks', 'tok_integrator', { url, eventTypes: ['edge.pass.issued.v1'] })

test('the entry refuses an allowlist entry that is not an origin, and a loopback entry in production', async () => {
  const notOrigin = await refusedStart({ NODE_ENV: 'test', SAFE_EDGE_WEBHOOK_ORIGINS: 'https://hooks.sdp.example/in' })
  expect(notOrigin.code).toBe(1)
  expect(notOrigin.stderr).toContain(
    'SAFE_EDGE_WEBHOOK_ORIGINS: "https://hooks.sdp.example/in" is not an origin such as https://hooks.example.org'
  )
  const loopback = await refusedStart({ NODE_ENV: 'production', SAFE_EDGE_WEBHOOK_ORIGINS: 'http://localhost:9000' })
  expect(loopback.code).toBe(1)
  expect(loopback.stderr).toContain(
    'SAFE_EDGE_WEBHOOK_ORIGINS: http://localhost:9000 is loopback, which only development and test allow'
  )
}, 30_000)

test('without NODE_ENV only the listed origins register; in development loopback does too', async () => {
  const deployed = await startApiProcess({
    SAFE_EDGE_WEBHOOK_ORIGINS: 'https://hooks.sdp.example, https://ops.sdp.example'
  })
  expect((await register(deployed, 'https://hooks.sdp.example/safe-edge')).status).toBe(201)
  expect((await register(deployed, 'https://ops.sdp.example/safe-edge')).status).toBe(201)
  expect((await register(deployed, 'http://localhost:8080/hooks')).status).toBe(400)

  const dev = await startApiProcess({ NODE_ENV: 'development' })
  expect((await register(dev, 'http://localhost:8080/hooks')).status).toBe(201)
  expect((await register(dev, 'https://hooks.sdp.example/safe-edge')).status).toBe(400)
}, 30_000)
