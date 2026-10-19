// #131: a scenario replayed against the dev API stamps records with the scenario clock, not the wall clock. Started
// with SAFE_EDGE_CLOCK=scenario, the API's clock is the one the scenario player sets before each event, through the
// audited setScenarioClock operation. Production refuses it.
import { afterAll, expect, test } from 'bun:test'
import { verifyAuditChain } from '@safe-edge/core'
import { createSafeEdgeClient } from '@safe-edge/sdk'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { testEnv } from '../../../test/spawn.ts'
import { ensureDevTokens } from '../src/dev-tokens.ts'
import { S6, play, scenarioClockPlayer } from './s6.ts'
import { seed } from './support.ts'

const apiDir = join(import.meta.dir, '..')

function freePort(): number {
  const server = Bun.serve({ port: 0, fetch: () => new Response() })
  const { port } = server
  server.stop(true)
  if (port === undefined) throw new Error('Bun.serve did not report a port')
  return port
}

/**
 * Runs an API entry (`src/dev.ts` or `src/index.ts`) as its own process, on a fresh data directory, and returns its
 * `/v1` URL once it answers.
 */
async function serve(entry: string, env: Record<string, string>): Promise<string> {
  const port = freePort()
  const dataDir = await mkdtemp(join(tmpdir(), 'safe-edge-scenario-api-'))
  const api = Bun.spawn(['bun', entry], {
    cwd: apiDir,
    env: testEnv({ SAFE_EDGE_DATA_DIR: dataDir, ...env, PORT: String(port) }),
    stdout: 'ignore',
    stderr: 'inherit'
  })
  afterAll(async () => {
    api.kill()
    await api.exited
    await rm(dataDir, { recursive: true })
  })
  const baseUrl = `http://localhost:${port}/v1`
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (api.exitCode !== null) throw new Error(`bun ${entry} exited with code ${api.exitCode}`)
    const health = await fetch(`${baseUrl}/health`).catch((error: Error) => {
      if (error.message.includes('Unable to connect')) return undefined
      throw error
    })
    if (health?.ok) return baseUrl
    await Bun.sleep(200)
  }
  throw new Error(`bun ${entry} did not answer within 20 s`)
}

/** ISO timestamps anywhere in a record's new state that its old state did not hold: the times a write stamped. */
function stampedTimes(before: unknown, after: unknown): string[] {
  const times = (value: unknown): string[] => {
    if (typeof value === 'string') return /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(value) ? [value] : []
    return typeof value === 'object' && value !== null ? Object.values(value).flatMap(times) : []
  }
  const held = new Set(times(before))
  return times(after).filter((time) => !held.has(time))
}

test("replayed against the dev API in scenario mode, S6's records and audit events carry each event's scenario time", async () => {
  // The dev entry (what bun run dev serves), with this run's own generated dev tokens.
  const env = { XDG_STATE_HOME: await mkdtemp(join(tmpdir(), 'safe-edge-scenario-')) }
  afterAll(() => rm(env.XDG_STATE_HOME, { recursive: true }))
  const baseUrl = await serve('src/dev.ts', { ...env, SAFE_EDGE_CLOCK: 'scenario' })
  const player = scenarioClockPlayer(baseUrl, (await ensureDevTokens(env)).tokenOf)
  const scenario = [...S6.setup, ...S6.events]
  await play(player, scenario)

  const manager = player.clientFor('usr_manager')
  const chain = await manager.listAudit({})
  expect(verifyAuditChain(chain)).toMatchObject({ ok: true })
  // The system user moved the clock before each event, from the seed's date to the event's time.
  expect(
    chain
      .filter((event) => event.action === 'setScenarioClock')
      .map(({ actor, before, after, at }) => ({ actor: actor.id, before, after, at }))
  ).toEqual(
    scenario.map((event, index) => ({
      actor: 'usr_system',
      before: { id: 'clock', now: index === 0 ? seed.asOf : scenario[index - 1]!.at },
      after: { id: 'clock', now: event.at },
      at: event.at
    }))
  )
  // Every write an event made, and the refusal one met, is on the chain at the time the clock was set to, and so is
  // every time that write stamped on its record.
  let now = seed.asOf
  const offClock: string[] = []
  for (const event of chain) {
    if (event.action === 'setScenarioClock') now = event.at
    for (const time of [event.at, ...stampedTimes(event.before, event.after)]) {
      if (time !== now) offClock.push(`${event.action} ${event.subjectId} at ${time}, not ${now}`)
    }
  }
  expect(offClock).toEqual([])

  // The records read back the fixture's times.
  const [setupRaise, setupConfirm, observe, raise] = scenario.map((event) => event.at)
  expect(await manager.listCandidates({})).toEqual([
    expect.objectContaining({ id: 'cand_1', raisedAt: setupRaise, decidedAt: setupConfirm }),
    expect.objectContaining({ id: 'cand_2', raisedAt: raise, decidedAt: null })
  ])
  expect((await manager.getCandidate({ params: { id: 'cand_2' } })).observations).toEqual([
    expect.objectContaining({ id: 'obs_1', capturedAt: observe })
  ])
  for (const records of [manager.listFindings({}), manager.listTasks({}), manager.listWorkOrders({})]) {
    expect(await records).toEqual([expect.objectContaining({ createdAt: setupConfirm })])
  }
})

test('production refuses the scenario clock: it will not start with one, and its wall clock cannot be set', async () => {
  const production = {
    NODE_ENV: 'production',
    SAFE_EDGE_DEV_TOKENS: JSON.stringify({
      tok_system: 'usr_system',
      tok_manager: 'usr_manager',
      tok_agent: 'usr_agent'
    }),
    SAFE_EDGE_AGENT_TOKEN: 'tok_agent'
  }
  const refused = Bun.spawn(['bun', 'src/index.ts'], {
    cwd: apiDir,
    env: testEnv({ ...production, SAFE_EDGE_CLOCK: 'scenario', PORT: String(freePort()) }),
    stdout: 'ignore',
    stderr: 'pipe'
  })
  expect(await refused.exited).toBe(1)
  expect(await new Response(refused.stderr).text()).toContain('The API refuses the scenario clock in production')

  // Started without it, production runs on the wall clock, and the system user cannot set it.
  const baseUrl = await serve('src/index.ts', production)
  const as = (token: string) => createSafeEdgeClient({ transport: 'http', baseUrl, token })
  await expect(as('tok_system').setScenarioClock({ body: { now: S6.setup[0]!.at } })).rejects.toMatchObject({
    status: 501,
    error: 'not_implemented'
  })
  // Nothing moved, so the audit chain is still empty.
  expect(await as('tok_manager').listAudit({})).toEqual([])
})
