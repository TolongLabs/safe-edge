import {
  Asset,
  Baseline,
  Dock,
  DroneProfile,
  EdgePass,
  InventoryItemId,
  SegmentId,
  Segment,
  Timestamp,
  TownshipId,
  User,
  ViewpointId
} from '@safe-edge/contracts'
import * as z from 'zod'

/**
 * The labelled fixtures a core starts from (`data/elmina/fixtures/seed.json`, built by
 * `packages/core/scripts/generate-seed.ts`). Every record is `simulated: true, source: 'fixture'`.
 */
export const Seed = z.object({
  /** The date the fixtures describe; pass dates are relative to it. */
  asOf: Timestamp,
  townshipId: TownshipId,
  /** Records the scripted scenarios start from. */
  story: z.object({
    /** S1: fence panel 4 by the playground path, seen from this viewpoint. */
    s1: z.object({ segmentId: SegmentId, viewpointId: ViewpointId, inventoryItemId: InventoryItemId })
  }),
  users: z.array(User),
  assets: z.array(Asset),
  segments: z.array(Segment),
  baselines: z.array(Baseline),
  passes: z.array(EdgePass),
  docks: z.array(Dock),
  droneProfiles: z.array(DroneProfile)
})
export type Seed = z.infer<typeof Seed>
