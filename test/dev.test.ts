import { afterAll, beforeAll, expect, test } from 'bun:test'
import type { Subprocess } from 'bun'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')

function freePort(): number {
  const server = Bun.serve({ port: 0, fetch: () => new Response() })
  const { port } = server
  server.stop(true)
  if (port === undefined) throw new Error('Bun.serve did not report a port')
  return port
}

const apiPort = freePort()
const webPort = freePort()
let dev: Subprocess

async function waitFor(url: string): Promise<Response> {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (dev.exitCode !== null) throw new Error(`bun run dev exited with code ${dev.exitCode}`)
    const response = await fetch(url).catch((error: Error) => {
      if (error.message.includes('Unable to connect')) return undefined
      throw error
    })
    if (response) return response
    await Bun.sleep(200)
  }
  throw new Error(`${url} did not respond within 20 s`)
}

beforeAll(() => {
  dev = Bun.spawn(['bun', 'run', 'dev'], {
    cwd: root,
    env: { ...process.env, PORT: String(apiPort), WEB_PORT: String(webPort) },
    stdout: 'ignore',
    stderr: 'inherit',
    detached: true
  })
})

afterAll(async () => {
  // Signal the whole process group, as Ctrl-C in a terminal does; killing only the parent orphans Vite and the API.
  process.kill(-dev.pid, 'SIGINT')
  await dev.exited
})

test('bun run dev serves the API, with the seeded core behind the dev tokens, and the web app', async () => {
  const health = await waitFor(`http://localhost:${apiPort}/v1/health`)
  expect(health.status).toBe(200)
  expect(await health.json()).toEqual({ status: 'ok' })

  // The API serves the seeded core to the dev tokens in data/elmina/fixtures/dev-tokens.json.
  const segments = await fetch(`http://localhost:${apiPort}/v1/segments`, {
    headers: { authorization: 'Bearer dev_manager' }
  })
  expect(segments.status).toBe(200)
  expect(((await segments.json()) as unknown[]).length).toBe(47)

  const page = await waitFor(`http://localhost:${webPort}/`)
  expect(page.status).toBe(200)
  expect(await page.text()).toContain('<div id="root"></div>')

  const entry = await fetch(`http://localhost:${webPort}/src/main.tsx`)
  expect(entry.status).toBe(200)
}, 30_000)
