import type { ItemStatus } from '@safe-edge/contracts'
import { elminaSeed, type MemoryClient } from '@safe-edge/sdk'
import type { Box, Scene } from '../scenes'

/** What the contracts do not carry: the picture, the overlay and the display names of a sample card. */
export type SampleMeta = {
  title: string
  viewpointName: string
  scene: Scene
  /** Overlay rectangle in percent of the image; null where nothing was seen. */
  box: Box | null
  /** Sample text standing in for the agent's summary until the contracts carry one (#128). */
  summary: string
  /** The field-check task core opened when it raised a Tier 3 candidate (tasks name no candidate). */
  fieldTaskId?: string
}

const S1 = elminaSeed.story.s1
const SEGMENT = S1.segmentId
const VP_FENCE = S1.viewpointId
const VP_PATH = 'vp_866518980_11_1'
const quality = { sharpness: 0.9, alignmentResidualPx: 1.2, occlusion: 0.05 }

type Card = {
  meta: SampleMeta
  viewpointId: string
  capturedAt: string
  inventoryItemId: string | null
  itemStatus: ItemStatus | null
  class: 'inventory_item' | 'worn_path'
  score: number
  uncertainty: 'low' | 'medium' | 'high'
  gridCell: string
  rationale: string
}

const CARDS: Card[] = [
  {
    meta: {
      title: 'Fence panel 4 missing',
      viewpointName: 'Playground path, fence line',
      scene: 'fence',
      box: { x: 39, y: 33, w: 12, h: 40 },
      summary:
        'After the heavy-rain patrol, fence panel 4 by the playground path is no longer in view, leaving a gap towards the water.'
    },
    viewpointId: VP_FENCE,
    capturedAt: '2026-10-19T07:48:00.000Z',
    inventoryItemId: S1.inventoryItemId,
    itemStatus: 'missing',
    class: 'inventory_item',
    score: 0.82,
    uncertainty: 'low',
    gridCell: 'B3',
    rationale:
      'Panel 4 is in the baseline inventory and absent at the same viewpoint after the heavy-rain patrol; a gap now opens onto the pond bank.'
  },
  {
    meta: {
      title: 'Ring buoy moved',
      viewpointName: 'Playground path, ring buoy post',
      scene: 'buoy',
      box: { x: 44, y: 50, w: 44, h: 36 },
      summary: 'The ring buoy by the playground path is off its post and lying on the path.'
    },
    viewpointId: VP_FENCE,
    capturedAt: '2026-10-19T08:03:00.000Z',
    inventoryItemId: 'item_866518980_11_ring_buoy',
    itemStatus: 'changed',
    class: 'inventory_item',
    score: 0.71,
    uncertainty: 'medium',
    gridCell: 'C3',
    rationale: 'The ring buoy sits off its post and is no longer within reach of the water edge.'
  },
  {
    meta: {
      title: 'Worn path towards the water edge',
      viewpointName: 'Lake bank, grass slope',
      scene: 'path',
      box: { x: 40, y: 40, w: 26, h: 50 },
      summary: 'A bare strip has appeared through the grass towards the water edge.'
    },
    viewpointId: VP_PATH,
    capturedAt: '2026-10-19T08:20:00.000Z',
    inventoryItemId: null,
    itemStatus: null,
    class: 'worn_path',
    score: 0.58,
    uncertainty: 'medium',
    gridCell: 'D2',
    rationale: 'A bare strip has appeared through the grass towards the water. This is a general change flag.'
  },
  {
    meta: {
      title: 'Fence panel 3 not visible',
      viewpointName: 'Lake bank, fence line under tree cover',
      scene: 'canopy',
      box: null,
      summary: 'Tree cover hides fence panel 3, so nothing could be checked there.'
    },
    viewpointId: VP_PATH,
    capturedAt: '2026-10-19T08:41:00.000Z',
    inventoryItemId: 'item_866518980_11_fence_panel_3',
    itemStatus: 'not_visible',
    class: 'inventory_item',
    score: 0.3,
    uncertainty: 'high',
    gridCell: 'A1',
    rationale: 'Tree cover hides the fence panel.'
  }
]

/**
 * The Elmina seed holds no candidates, so the demo raises four as the simulated drone provider: every record is
 * core's, labelled simulated. Returns each candidate's display extras by candidate ID.
 */
export async function raiseSampleCandidates(demo: MemoryClient) {
  const drone = demo.as('usr_drone_sim')
  const pose = elminaSeed.segments.find((s) => s.id === SEGMENT)!.viewpoints[0]!.pose
  const metas: Record<string, SampleMeta> = {}
  for (const card of CARDS) {
    const observation = await drone.recordObservation({
      body: {
        patrolId: null,
        segmentId: SEGMENT,
        viewpointId: card.viewpointId,
        captureSource: 'drone',
        image: null,
        pose,
        capturedAt: card.capturedAt,
        quality,
        privacyAction: 'none',
        simulated: true
      }
    })
    const tasksBefore = new Set((await demo.listTasks()).map((t) => t.id))
    const candidate = await drone.raiseCandidate({
      body: {
        segmentId: SEGMENT,
        observationIds: [observation.id],
        inventoryItemId: card.inventoryItemId,
        itemStatus: card.itemStatus,
        class: card.class,
        score: card.score,
        uncertainty: card.uncertainty,
        gridCell: card.gridCell,
        rationale: card.rationale,
        model: null,
        simulated: true
      }
    })
    const opened = (await demo.listTasks()).filter((t) => !tasksBefore.has(t.id))
    metas[candidate.id] = opened[0] ? { ...card.meta, fieldTaskId: opened[0].id } : card.meta
  }
  return metas
}
