import { afterAll, beforeAll, expect, test } from 'bun:test'
import type { Subprocess } from 'bun'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
// bun run dev generates this machine's dev tokens under $XDG_STATE_HOME on first start; this run gets its own.
const stateHome = await mkdtemp(join(tmpdir(), 'safe-edge-dev-'))
const tokenFile = join(stateHome, 'safe-edge/dev-tokens.json')

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
    env: {
      ...process.env,
      PORT: String(apiPort),
      WEB_PORT: String(webPort),
      XDG_STATE_HOME: stateHome,
      SAFE_EDGE_DATA_DIR: join(stateHome, 'api')
    },
    stdout: 'ignore',
    stderr: 'inherit',
    detached: true
  })
})

afterAll(async () => {
  // Signal the whole process group, as Ctrl-C in a terminal does; killing only the parent orphans Vite and the API.
  process.kill(-dev.pid, 'SIGINT')
  await dev.exited
  await rm(stateHome, { recursive: true })
})

test('bun run dev serves the API, with the seeded core behind generated dev tokens, and the web app', async () => {
  const health = await waitFor(`http://localhost:${apiPort}/v1/health`)
  expect(health.status).toBe(200)
  expect(await health.json()).toEqual({ status: 'ok' })

  // The first start generated a random token for each of the 11 seeded users, readable by this OS user only.
  const table: Record<string, string> = await Bun.file(tokenFile).json()
  expect(Object.values(table).toSorted()).toEqual([
    'usr_agent',
    'usr_crew',
    'usr_drone_sim',
    'usr_engineer',
    'usr_gm',
    'usr_installer',
    'usr_integrator',
    'usr_manager',
    'usr_pilot',
    'usr_reviewer',
    'usr_system'
  ])
  for (const token of Object.keys(table)) expect(token).toMatch(/^sedev_[\w-]{43}$/)
  expect((await stat(tokenFile)).mode & 0o777).toBe(0o600)
  const tokenOf = (userId: string) => Object.entries(table).find(([, id]) => id === userId)![0]
  const get = (path: string, token: string) =>
    fetch(`http://localhost:${apiPort}/v1${path}`, { headers: { authorization: `Bearer ${token}` } })

  const segments = await get('/segments', tokenOf('usr_manager'))
  expect(segments.status).toBe(200)
  expect(((await segments.json()) as unknown[]).length).toBe(47)

  // The tokens that used to be committed in data/elmina/fixtures/dev-tokens.json are gone and the API refuses them.
  expect(await Bun.file(join(root, 'data/elmina/fixtures/dev-tokens.json')).exists()).toBe(false)
  const oldTokens = ['manager', 'engineer', 'reviewer', 'installer', 'pilot', 'gm', 'crew', 'integrator', 'agent']
  for (const token of [...oldTokens, 'system', 'drone_sim'].map((name) => `dev_${name}`)) {
    expect((await get('/segments', token)).status).toBe(401)
  }

  // The agent's token, for the MCP server's environment, comes from bun run dev:token.
  const printed = Bun.spawnSync(['bun', 'run', '--silent', 'dev:token', 'usr_agent'], {
    cwd: root,
    env: { ...process.env, XDG_STATE_HOME: stateHome },
    stderr: 'inherit'
  })
  expect(printed.exitCode).toBe(0)
  const agentToken = printed.stdout.toString().trim()
  expect(agentToken).toBe(tokenOf('usr_agent'))
  expect(await (await get('/me', agentToken)).json()).toMatchObject({ type: 'agent', id: 'usr_agent' })

  const page = await waitFor(`http://localhost:${webPort}/`)
  expect(page.status).toBe(200)
  expect(await page.text()).toContain('<div id="root"></div>')

  const entry = await fetch(`http://localhost:${webPort}/src/main.tsx`)
  expect(entry.status).toBe(200)
}, 30_000)

test('the API refuses the generated dev token file in production', async () => {
  const env = { ...process.env, XDG_STATE_HOME: stateHome }
  const agentToken = Bun.spawnSync(['bun', 'run', '--silent', 'dev:token', 'usr_agent'], { cwd: root, env })
  expect(agentToken.exitCode).toBe(0)

  const api = Bun.spawn(['bun', 'apps/api/src/index.ts'], {
    cwd: root,
    env: {
      ...env,
      NODE_ENV: 'production',
      PORT: String(freePort()),
      SAFE_EDGE_DEV_TOKENS_FILE: tokenFile,
      SAFE_EDGE_AGENT_TOKEN: agentToken.stdout.toString().trim(),
      SAFE_EDGE_DATA_DIR: join(stateHome, 'api')
    },
    stdout: 'ignore',
    stderr: 'pipe'
  })
  expect(await api.exited).toBe(1)
  expect(await new Response(api.stderr).text()).toContain('The API refuses the dev token file in production')
}, 30_000)
