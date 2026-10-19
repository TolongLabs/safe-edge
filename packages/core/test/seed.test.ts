import { describe, expect, test } from 'bun:test'
import { Role } from '@safe-edge/contracts'
import { buildSeed, formatSeed } from '../scripts/generate-seed.ts'
import { S1, seed, seedPath, startCore } from './support.ts'

describe('the labelled Elmina seed', () => {
  test('is exactly what the generator builds from the planner, so segment IDs never drift', async () => {
    // Fails after the planner's split or the OSM layers change: run `bun run generate:seed` and commit.
    expect(await Bun.file(seedPath).text()).toBe(await formatSeed(await buildSeed()))
  })

  test('labels every record as a simulated fixture', () => {
    const records = [
      ...seed.users,
      ...seed.assets,
      ...seed.segments,
      ...seed.baselines,
      ...seed.passes,
      ...seed.docks,
      ...seed.droneProfiles,
      ...seed.thirdParties
    ]
    expect(records.length).toBeGreaterThan(60)
    for (const record of records)
      expect({ simulated: record.simulated, source: record.source }).toEqual({ simulated: true, source: 'fixture' })
  })

  test('has a user for every role, with a distinct installer, reviewer and confirming manager', () => {
    expect(seed.users.map((u) => u.role).toSorted()).toEqual([...Role.options].toSorted())
    const installer = seed.users.find((u) => u.role === 'installer')!.id
    const reviewer = seed.users.find((u) => u.role === 'reviewer')!.id
    const manager = seed.users.find((u) => u.role === 'manager')!.id
    expect(new Set([installer, reviewer, manager]).size).toBe(3)
  })

  test("names segments seg_<osmId>_<index> after #70's split: 21 on the lake, then 11, 7 and 8 on the ponds", () => {
    const counts: Record<string, number> = {}
    for (const s of seed.segments) counts[s.id.split('_')[1]!] = (counts[s.id.split('_')[1]!] ?? 0) + 1
    expect(counts).toEqual({ '866518980': 21, '383055739': 11, '383055740': 7, '404002712': 8 })
    for (const s of seed.segments) expect(s.id).toMatch(/^seg_\d+_\d+$/)
  })

  test("readies S1's segment: fence panel 4 is safety-critical, seen from a viewpoint, under a valid pass", () => {
    const h = startCore()
    const { segment, pass, baseline } = h.segment(S1.segmentId)
    const panel = segment.expectedInventory.find((i) => i.id === S1.inventoryItemId)!
    expect(panel).toMatchObject({ type: 'fence_panel', label: 'Fence panel 4', safetyCritical: true })
    expect(segment.viewpoints.find((v) => v.id === S1.viewpointId)!.expectedItemIds).toContain(panel.id)
    expect(pass).toMatchObject({ state: 'valid', validTo: '2027-04-15T02:00:00.000Z' })
    expect(baseline!.inventorySnapshot.find((i) => i.itemId === panel.id)!.status).toBe('present')
  })
})
