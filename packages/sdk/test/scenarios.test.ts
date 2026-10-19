import { beforeAll, describe, expect, test } from 'bun:test'
import type { PatrolPlanner } from '@safe-edge/core'
import { join } from 'node:path'
import {
  createElminaPlanner,
  createScenarioPlayer,
  elminaScenarios,
  type Played,
  type Scenario,
  type ScenarioPlayer
} from '../src/index.ts'

const S1_SEGMENT = 'seg_866518980_11'
let planner: PatrolPlanner

beforeAll(async () => {
  const repoRoot = join(import.meta.dir, '../../..')
  planner = await createElminaPlanner((path) => Bun.file(join(repoRoot, path)).json(), { thirdParties: [] })
})

/** A player whose real-time playback never starts on its own: the test drives it with seeks. */
const playerFor = (id: Scenario['id']) =>
  createScenarioPlayer({ scenarios: elminaScenarios, id, planner, frames: () => () => {} })

const scenario = (id: Scenario['id']) => elminaScenarios.find((s) => s.id === id)!

/** What a run did and left: every call's outcome and result, the audit chain and the board. */
async function record(player: ScenarioPlayer) {
  const { client } = player
  return JSON.stringify({
    played: player.played.map((p: Played) => ({ ...p, event: `${p.event.at} ${p.event.operationId}` })),
    audit: await client.listAudit({}),
    passes: await client.listPasses({}),
    findings: await client.listFindings({}),
    workOrders: await client.listWorkOrders({}),
    patrols: await client.listPatrols()
  })
}

/** The outcomes of a scenario's own events, in order. */
const outcomes = (player: ScenarioPlayer, id: Scenario['id']) => {
  const own = scenario(id)
  return player.played.slice(-(own.setup.length + own.events.length)).map((p) => `${p.event.operationId}:${p.outcome}`)
}

describe('SIM-5: the scenario player plays S1 to S6 on the memory transport', () => {
  test('S1: the dock holds for the weather, flies once the pilot clears the paths, and the confirmed flag suspends the pass', async () => {
    const player = await playerFor('s1')
    await player.seek(scenario('s1').end)
    expect(outcomes(player, 's1').every((o) => o.endsWith(':done'))).toBe(true)
    const [patrol] = await player.client.listPatrols()
    expect(patrol).toMatchObject({ id: 'ptl_1', status: 'completed', startedAt: '2026-10-21T22:36:30.000Z' })
    const pass = (await player.client.listPasses({})).find((p) => p.segmentId === S1_SEGMENT)
    expect(pass?.state).toBe('suspended')
    expect(await player.client.listFindings({})).toMatchObject([{ id: 'fnd_1', segmentId: S1_SEGMENT }])
  })

  test('S2: Fix Lens shows fix A leaves the way around the fence end open and fix B closes both routes', async () => {
    const player = await playerFor('s2')
    await player.seek(scenario('s2').end)
    const previews = player.played
      .filter((p) => p.event.operationId === 'previewRouteClosure' && p.outcome === 'done')
      .map((p) => (p as { result: { routes: Array<{ id: string; projectedStatus: string }> } }).result.routes)
    expect(previews.map((routes) => routes.map((r) => [r.id, r.projectedStatus]))).toEqual([
      [
        ['rte_1', 'closed'],
        ['rte_2', 'open']
      ],
      [
        ['rte_1', 'closed'],
        ['rte_2', 'closed']
      ]
    ])
  })

  test('S3: a different reviewer accepts the repair and the pass returns with an expiry date', async () => {
    const player = await playerFor('s3')
    await player.seek(scenario('s3').end)
    const pass = (await player.client.listPasses({})).find((p) => p.segmentId === S1_SEGMENT)
    expect(pass).toMatchObject({ state: 'valid', validTo: '2027-10-22T08:05:00.000Z' })
  })

  test("S4 and S5: the agent's report needs the API; the agent reads with IDs and is refused an acceptance", async () => {
    const s4 = await playerFor('s4')
    await s4.seek(scenario('s4').end)
    expect(outcomes(s4, 's4')).toEqual(['listPasses:done', 'listWorkOrders:done', 'draftMonthlyReport:needs_api'])
    const s5 = await playerFor('s5')
    await s5.seek(scenario('s5').end)
    expect(outcomes(s5, 's5')).toEqual(['listPasses:done', 'recordRetest:refused'])
    expect(s5.played.at(-1)).toMatchObject({ outcome: 'refused', rule: 'agents_draft_only' })
  })

  test('S6: text in an image changes nothing, and acting on it is refused', async () => {
    const player = await playerFor('s6')
    await player.seek(scenario('s6').end)
    expect(player.played.at(-1)).toMatchObject({ outcome: 'refused', rule: 'agents_draft_only' })
    const pass = (await player.client.listPasses({})).find((p) => p.segmentId === S1_SEGMENT)
    expect(pass?.state).toBe('suspended')
  })
})

describe('SIM-5: two runs give identical results', () => {
  test('each scenario played twice records the same calls, audit chain and board', async () => {
    for (const { id, end } of elminaScenarios) {
      const runs = []
      for (let i = 0; i < 2; i++) {
        const player = await playerFor(id)
        await player.seek(end)
        runs.push(await record(player))
      }
      expect(runs[1], id).toBe(runs[0]!)
    }
  }, 60_000)

  test('the fixed-step clock makes S1 the same however playback is chunked, scrubbed or reset', async () => {
    const { start, end } = scenario('s1')
    const once = await playerFor('s1')
    await once.seek(end)
    const expected = await record(once)

    // Frame-sized seeks through the flight, as real-time play makes them, after one jump over the weather hold.
    const chunked = await playerFor('s1')
    await chunked.seek('2026-10-21T22:36:00.000Z')
    for (let t = Date.parse('2026-10-21T22:36:00.000Z'); t < Date.parse(end); t += 1_337) {
      await chunked.seek(new Date(t).toISOString())
    }
    await chunked.seek(end)
    expect(await record(chunked)).toBe(expected)

    // A scrub back to mid-flight replays from the start; playing on reaches the same end.
    await chunked.seek('2026-10-21T22:39:00.000Z')
    expect(chunked.now).toBe('2026-10-21T22:39:00.000Z')
    await chunked.seek(end)
    expect(await record(chunked)).toBe(expected)

    await chunked.reset()
    expect(chunked.now).toBe(start)
    await chunked.seek(end)
    expect(await record(chunked)).toBe(expected)
  }, 60_000)
})
