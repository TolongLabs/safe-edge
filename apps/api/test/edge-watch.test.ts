// Edge Watch over HTTP (#78): a check reports every item its viewpoint expects, and the board reads the flag budget.
import { expect, test } from 'bun:test'
import { FalseFlagReport, InventoryCheckList, InventoryCheckResult, Observation } from '@safe-edge/contracts'
import { S1, seed, startApi } from './support.ts'

test('a crew phone check reports every item at its viewpoint, raises a candidate for each item not present, and the board reads the budget', async () => {
  const api = startApi()
  const segment = seed.segments.find((s) => s.id === S1.segmentId)!
  const viewpoint = segment.viewpoints.find((v) => v.id === S1.viewpointId)!

  const observed = await api.request('post', '/observations', {
    token: 'tok_crew',
    body: {
      patrolId: null,
      segmentId: S1.segmentId,
      viewpointId: viewpoint.id,
      captureSource: 'phone',
      image: null,
      pose: viewpoint.pose,
      capturedAt: '2026-10-21T00:40:00.000Z',
      quality: { sharpness: 0.9, alignmentResidualPx: null, occlusion: 0 },
      privacyAction: 'none',
      simulated: true
    }
  })
  expect(observed.status).toBe(201)
  const observation = Observation.parse(await observed.json())

  const items = viewpoint.expectedItemIds.map((id) => ({
    inventoryItemId: id,
    status: id === S1.inventoryItemId ? ('missing' as const) : ('present' as const),
    score: 0.9,
    uncertainty: 'low' as const,
    gridCell: 'B3',
    rationale: id === S1.inventoryItemId ? 'Fence panel 4 is missing by the playground path' : 'In place'
  }))
  // Leaving an item out is refused by name, not taken as inspected.
  const partial = await api.request('post', '/inventory-checks', {
    token: 'tok_crew',
    body: { observationId: observation.id, items: items.slice(1), model: null }
  })
  expect(partial.status).toBe(403)
  expect(await partial.json()).toMatchObject({ ok: false, rule: 'every_item_reported' })

  const checked = await api.request('post', '/inventory-checks', {
    token: 'tok_crew',
    body: { observationId: observation.id, items, model: null }
  })
  expect(checked.status).toBe(201)
  const { check, candidates } = InventoryCheckResult.parse(await checked.json())
  expect(check.items.map((i) => i.status)).toEqual(['missing', 'present', 'present', 'present'])
  expect(candidates.map((c) => [c.inventoryItemId, c.tier])).toEqual([[S1.inventoryItemId, 2]])

  const listed = await api.request('get', `/inventory-checks?segmentId=${S1.segmentId}`, { token: 'tok_gm' })
  expect(InventoryCheckList.parse(await listed.json())).toEqual([check])

  // A phone capture outside a patrol counts against no patrol's budget.
  const board = await api.request('get', '/false-flags', { token: 'tok_gm' })
  expect(FalseFlagReport.parse(await board.json())).toEqual({ budgetPerPatrol: 10, patrols: [], overBudget: [] })
})
