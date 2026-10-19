// No test run reaches the real Procore sandbox or any other live service: every process a test spawns gets its
// environment from testEnv, which drops the run's credentials and blanks the ones the product reads, so a .env file the
// child loads (bun run dev loads the repo's root .env) cannot fill them back in.
import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { testEnv } from './spawn.ts'

/** What the product reads to reach Procore and Claude: the sandbox wizard writes the first four to the root .env. */
const productCredentials = {
  PROCORE_CLIENT_ID: 'leaked-id',
  PROCORE_CLIENT_SECRET: 'leaked-secret',
  PROCORE_COMPANY_ID: '4281234',
  PROCORE_PROJECT_ID: '321',
  ANTHROPIC_API_KEY: 'sk-ant-leaked'
}
const credentials = {
  ...productCredentials,
  OPENAI_API_KEY: 'sk-leaked',
  X_AUTH_TOKEN: 'leaked',
  BSKY_APP_PASSWORD: 'leaked'
}

const restore = new Map(Object.keys(credentials).map((name) => [name, process.env[name]]))
const dirs: string[] = []
afterEach(() => {
  for (const [name, value] of restore) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true })
})

/** The environment a child spawned with testEnv sees, run in `cwd` and loading `envFile` too when given. */
function childEnv(cwd: string, envFile?: string): Record<string, string> {
  const child = Bun.spawnSync(
    ['bun', ...(envFile ? [`--env-file=${envFile}`] : []), '-e', 'console.log(JSON.stringify(process.env))'],
    { cwd, env: testEnv({ SAFE_EDGE_DATA_DIR: cwd }) }
  )
  if (child.exitCode !== 0) throw new Error(child.stderr.toString())
  return JSON.parse(child.stdout.toString())
}

test("a spawned process gets none of the test run's credentials", () => {
  Object.assign(process.env, credentials)
  const dir = mkdtempSync(join(tmpdir(), 'safe-edge-env-'))
  dirs.push(dir)

  const seen = childEnv(dir)
  expect(Object.keys(credentials).filter((name) => name in seen && seen[name] !== '')).toEqual([])
  // What the test asked for still arrives.
  expect(seen.SAFE_EDGE_DATA_DIR).toBe(dir)
})

test('a spawned process that loads a .env file still gets no Procore or Claude credential from it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'safe-edge-env-'))
  dirs.push(dir)
  const envFile = join(dir, '.env')
  writeFileSync(
    envFile,
    Object.entries(productCredentials)
      .map(([name, value]) => `${name}=${value}`)
      .join('\n')
  )

  // Bun loads the file both ways: from the working directory, and named by --env-file as bun run dev does.
  for (const seen of [childEnv(dir), childEnv(tmpdir(), envFile)]) {
    expect(Object.fromEntries(Object.keys(productCredentials).map((name) => [name, seen[name]]))).toEqual(
      Object.fromEntries(Object.keys(productCredentials).map((name) => [name, '']))
    )
  }
})
