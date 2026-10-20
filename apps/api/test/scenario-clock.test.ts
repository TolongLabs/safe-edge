// #131: a scenario replayed against the dev API stamps records with the scenario clock, not the wall clock. Started
// with SAFE_EDGE_CLOCK=scenario, the API's clock is the one the scenario player sets before each event, through the
// audited setScenarioClock operation. Production refuses it.
import { afterAll, expect, test } from 'bun:test'
import { AuditEvent } from '@safe-edge/contracts'
import { verifyAuditChain } from '@safe-edge/core'
import { createSafeEdgeClient } from '@safe-edge/sdk'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureDevTokens } from '../src/dev-tokens.ts'
import { refusedStart, startApiProcess } from './process.ts'
import { S6, play, scenarioClockPlayer } from './s6.ts'
import { S1, seed, startApi } from './support.ts'

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
  const api = await startApiProcess({ ...env, SAFE_EDGE_CLOCK: 'scenario' }, 'dev')
  const player = scenarioClockPlayer(`${api.url}/v1`, (await ensureDevTokens(env)).tokenOf)
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

test("bun run dev starts on the scenario clock and says so: S1's pass opens valid on any day, and the seed's missed patrols fall due when the clock reaches them", async () => {
  // #147: the seed describes 20 October, with every segment last patrolled on 16 October and patrolled weekly. On the
  // wall clock, a dev API started from 23 October on would suspend every valid pass, S1's included, within a minute.
  const env = { XDG_STATE_HOME: await mkdtemp(join(tmpdir(), 'safe-edge-scenario-')) }
  afterAll(() => rm(env.XDG_STATE_HOME, { recursive: true }))
  const api = await startApiProcess(env, 'dev')
  expect(await api.printedLine('Clock: ')).toBe(
    "Clock: scenario: it starts at the seed's 2026-10-20T00:00:00.000Z (or where the last run left it) and moves " +
      'only when the system user sets it (POST /v1/scenario/clock). SAFE_EDGE_CLOCK=wall runs on the wall clock.'
  )
  const { tokenOf } = await ensureDevTokens(env)
  const as = (userId: string) =>
    createSafeEdgeClient({ transport: 'http', baseUrl: `${api.url}/v1`, token: tokenOf(userId) })
  const system = as('usr_system')
  const manager = as('usr_manager')
  const s1Pass = () => manager.getPass({ params: { id: `pass_${S1.segmentId.slice('seg_'.length)}` } })
  expect(await s1Pass()).toMatchObject({ state: 'valid', stateReason: null })

  // Moving the clock runs the scheduled pass. A moment before the patrol falls due, it finds nothing missed; the clock
  // it moved from was the seed's date, whatever today is.
  await system.setScenarioClock({ body: { now: '2026-10-23T00:59:59.999Z' } })
  expect(await s1Pass()).toMatchObject({ state: 'valid', stateReason: null })
  expect((await manager.listAudit({})).map(({ action, before }) => ({ action, before }))).toEqual([
    { action: 'setScenarioClock', before: { id: 'clock', now: seed.asOf } }
  ])

  // A week after the last patrol, it reports S1's missed patrol and suspends the pass.
  await system.setScenarioClock({ body: { now: '2026-10-23T01:00:00.000Z' } })
  const missed = (await manager.listCandidates({})).find(
    (c) => c.segmentId === S1.segmentId && c.class === 'missed_patrol'
  )
  expect(missed).toBeDefined()
  expect(await s1Pass()).toMatchObject({
    state: 'suspended',
    stateReason: `Missed patrol ${missed!.id} awaiting review`
  })
}, 30_000)

test('bun run dev runs on the wall clock with SAFE_EDGE_CLOCK=wall, and says so', async () => {
  const env = { XDG_STATE_HOME: await mkdtemp(join(tmpdir(), 'safe-edge-scenario-')) }
  afterAll(() => rm(env.XDG_STATE_HOME, { recursive: true }))
  const api = await startApiProcess({ ...env, SAFE_EDGE_CLOCK: 'wall' }, 'dev')
  expect(await api.printedLine('Clock: ')).toBe('Clock: wall.')
  const { tokenOf } = await ensureDevTokens(env)
  const system = createSafeEdgeClient({ transport: 'http', baseUrl: `${api.url}/v1`, token: tokenOf('usr_system') })
  await expect(system.setScenarioClock({ body: { now: '2026-10-23T01:00:00.000Z' } })).rejects.toMatchObject({
    status: 501,
    error: 'not_implemented'
  })
}, 30_000)

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
  const refused = await refusedStart({ ...production, SAFE_EDGE_CLOCK: 'scenario' })
  expect(refused.code).toBe(1)
  expect(refused.stderr).toContain('The API refuses the scenario clock in production')

  // Started without it, production runs on the wall clock, and the system user cannot set it.
  const api = await startApiProcess(production)
  const as = (token: string) => createSafeEdgeClient({ transport: 'http', baseUrl: `${api.url}/v1`, token })
  await expect(as('tok_system').setScenarioClock({ body: { now: S6.setup[0]!.at } })).rejects.toMatchObject({
    status: 501,
    error: 'not_implemented'
  })
  // Nothing moved, so the audit chain is still empty.
  expect(await as('tok_manager').listAudit({})).toEqual([])
})

test('the scenario clock moves forward only: an earlier time is refused, audited, and the clock stays put', async () => {
  const api = startApi()
  const set = (now: string) => api.request('post', '/scenario/clock', { token: 'tok_system', body: { now } })
  const later = '2026-10-21T00:00:00.000Z'
  const earlier = '2026-10-20T23:59:59.000Z'
  expect((await set(later)).status).toBe(200)

  const back = await set(earlier)
  expect(back.status).toBe(403)
  expect(await back.json()).toEqual({
    ok: false,
    rule: 'clock_backwards',
    message: `The scenario clock is at ${later}; it moves forward only, so it cannot go back to ${earlier}`
  })
  // Setting the time it already shows is not a move back.
  expect((await set(later)).status).toBe(200)

  const audit = AuditEvent.array().parse(await (await api.request('get', '/audit', { token: 'tok_gm' })).json())
  expect(audit.map((e) => [e.action, e.decision, e.rule, e.subjectId, e.at])).toEqual([
    ['setScenarioClock', 'allowed', null, 'clock', later],
    ['setScenarioClock', 'denied', 'clock_backwards', 'setScenarioClock', later],
    ['setScenarioClock', 'allowed', null, 'clock', later]
  ])
  expect(verifyAuditChain(audit)).toMatchObject({ ok: true })
})
