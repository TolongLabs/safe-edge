// PLAN-7 over HTTP, on the seeded API: plans keep 50 m from the third parties the request reports and from the seed's
// S1 path crowd, and the separation holds they get wait for the pilot.
import { describe, expect, test } from 'bun:test'
import { PatrolPlan, type CreatePatrolPlanRequest, type ThirdParty } from '@safe-edge/contracts'
import { S1, seed, startApi } from './support.ts'

const NOT_BEFORE = '2026-10-24T23:30:00.000Z'
/** S1's path segment, beside the footway the crowd is on, and the bank across the lake from it. */
const PATH_SEGMENT = 'seg_866518980_9'
const FAR_BANK = 'seg_866518980_7'
const request = (segmentIds: string[], thirdParties?: ThirdParty[]): CreatePatrolPlanRequest => ({
  dockId: 'dock_elmina_roof',
  droneProfileId: 'drn_assumed',
  segmentIds,
  context: [],
  notBefore: NOT_BEFORE,
  altitudeCapM: 60,
  ...(thirdParties === undefined ? {} : { thirdParties })
})

describe('separation holds on API-served plans', () => {
  test('a create-plan request carrying a person on the edge gets a separation hold on that segment', async () => {
    const api = startApi()
    // Someone standing on S1's water edge (a vertex of its seed geometry), reported with the request: a labelled fixture.
    const onTheEdge: ThirdParty = {
      id: 'obs_person_s1',
      kind: 'person',
      label: 'person on the S1 edge',
      geometry: { type: 'Point', coordinates: [101.5124058, 3.1786474] },
      observedAt: '2026-10-24T23:00:00.000Z',
      simulated: true,
      source: 'fixture'
    }
    const created = await api.request('post', '/patrol-plans', {
      token: 'tok_manager',
      body: request([S1.segmentId], [onTheEdge])
    })
    expect(created.status).toBe(201)
    const plan = PatrolPlan.parse(await created.json())
    expect(plan.holds).toEqual([
      {
        kind: 'separation',
        segmentId: S1.segmentId,
        until: null,
        releasedBy: null,
        releasedAt: null,
        reason: expect.stringContaining(
          'within 50 m of "person on the S1 edge" (person, seen 2026-10-24T23:00:00.000Z)'
        )
      }
    ])

    // Without it, the same request plans no hold: the hold came from what the request reported.
    const unreported = PatrolPlan.parse(
      await (await api.request('post', '/patrol-plans', { token: 'tok_manager', body: request([S1.segmentId]) })).json()
    )
    expect(unreported.holds).toEqual([])
  })

  test("the seed's S1 path crowd makes the path segment wait for a clear path, and pushes the far bank out with zoom", async () => {
    const api = startApi()
    // S1: people on the lakeside footway. The request reports no one; the crowd comes from the seed.
    const [crowd] = seed.thirdParties
    expect(crowd).toMatchObject({ kind: 'person', simulated: true, source: 'fixture' })
    const created = await api.request('post', '/patrol-plans', {
      token: 'tok_manager',
      body: request([PATH_SEGMENT, FAR_BANK, S1.segmentId])
    })
    expect(created.status).toBe(201)
    const plan = PatrolPlan.parse(await created.json())

    expect(plan.holds.map((h) => [h.kind, h.segmentId, h.until, h.releasedBy])).toEqual([
      ['separation', PATH_SEGMENT, null, null]
    ])
    expect(plan.holds[0]!.reason).toContain(`within 50 m of "${crowd!.label}" (person, seen ${crowd!.observedAt})`)
    expect(plan.holds[0]!.reason).toContain('waits for the pilot or observer to confirm the path is clear')
    // Across the lake, the camera's 3× zoom lets the stations stand far enough off instead of waiting.
    const farBank = plan.tasks.find((t) => t.segmentId === FAR_BANK)!
    expect(farBank.stations.some((s) => s.zoom > 1)).toBe(true)
    const stations = plan.waypoints.filter((w) => w.segmentId === FAR_BANK)
    expect(stations.map((w) => w.zoom)).toEqual(farBank.stations.map((s) => s.zoom))
    expect(plan.tasks.map((t) => t.segmentId).toSorted()).toEqual([PATH_SEGMENT, FAR_BANK, S1.segmentId].toSorted())
    // The lake is in a park, a designated area (CAR 2016 reg. 143(3)): the plan names the authorisation it flies under,
    // an assumed one, since CAAM has issued none.
    expect(plan.authorisation).toEqual({
      ref: 'Assumed CAAM authorisation (fixture: none has been issued)',
      reason: expect.stringContaining('designated area "Elmina Valley Central Park (recreational)"'),
      simulated: true
    })
  })
})

describe('the take-off and landing hold on the dock', () => {
  test('a person within 30 m of the dock holds the launch until the pilot records the dock clear', async () => {
    const api = startApi()
    const [dock] = seed.docks
    // Someone 20 m south of the dock on its roof's building, reported with the request: a labelled fixture.
    const byTheDock: ThirdParty = {
      id: 'obs_person_dock',
      kind: 'person',
      label: 'person by the dock building',
      geometry: { type: 'Point', coordinates: [dock!.position.lon, dock!.position.lat - 20 / 111_320] },
      observedAt: '2026-10-24T23:00:00.000Z',
      simulated: true,
      source: 'fixture'
    }
    const json = async (response: Response, status: number) => {
      expect(response.status).toBe(status)
      return response.json()
    }
    const plan = PatrolPlan.parse(
      await json(
        await api.request('post', '/patrol-plans', {
          token: 'tok_manager',
          body: request([S1.segmentId], [byTheDock])
        }),
        201
      )
    )
    expect(plan.holds.map((h) => [h.kind, h.segmentId, h.until])).toEqual([['separation', null, null]])
    expect(plan.holds[0]!.reason).toEndWith('(CAR 2016 reg. 143(1)(g))')
    await json(await api.request('post', `/patrol-plans/${plan.id}/approve`, { token: 'tok_pilot' }), 200)

    api.setNow(plan.window.start)
    const start = () =>
      api.request('post', '/patrols', {
        token: 'tok_pilot',
        body: { planId: plan.id, provider: 'sim', droneId: 'sim-1' }
      })
    expect(await json(await start(), 403)).toEqual({
      ok: false,
      rule: 'separation_hold',
      message: `${plan.id} cannot take off yet: ${plan.holds[0]!.reason}`
    })

    // The pilot (never the manager or the agent) records the dock clear, by naming it as the hold's place.
    const release = (token: string) => api.request('post', `/patrol-plans/${plan.id}/holds/dock/release`, { token })
    expect(await json(await release('tok_manager'), 403)).toMatchObject({ rule: 'role_forbidden' })
    expect(await json(await release('tok_agent'), 403)).toMatchObject({ rule: 'agents_draft_only' })
    const released = PatrolPlan.parse(await json(await release('tok_pilot'), 200))
    expect(released.holds).toEqual([{ ...plan.holds[0]!, releasedBy: 'usr_pilot', releasedAt: plan.window.start }])
    expect(await json(await start(), 201)).toMatchObject({ planId: plan.id, status: 'in_flight' })
  })
})
