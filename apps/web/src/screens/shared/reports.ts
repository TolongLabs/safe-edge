import type {
  Candidate,
  CandidateEvidence,
  DamageAction,
  DamageCause,
  DamageIssueType,
  DamagePrevention,
  DamageReport,
  DamageReportWhere,
  PreventionStep
} from '@safe-edge/contracts'
import { elminaSeed } from '@safe-edge/sdk'
import type { Box, Scene } from '../../scenes'
import type { Snapshot } from '../../store'
import { describeViewpoint } from '../../viewpoints'

export type {
  DamageAction,
  DamageCause,
  DamageIssueType,
  DamagePrevention,
  DamageReport,
  DamageReportWhere,
  PreventionStep
}

export const ISSUE_LABELS: Record<DamageIssueType, string> = {
  fence_missing: 'Fence or barrier missing',
  fence_damaged: 'Fence or barrier damaged',
  path_broken: 'Path broken',
  path_worn: 'Worn path',
  sign_missing: 'Sign down or missing',
  ring_buoy_missing: 'Ring buoy missing',
  cover_moved: 'Cover moved',
  grating_blocked: 'Grating blocked',
  debris: 'Debris',
  other: 'Other'
}

export const ACTION_LABELS: Record<DamageAction, string> = {
  replace: 'Replace a part',
  repair: 'Repair',
  clear: 'Clear or remove',
  cordon: 'Cordon off now',
  not_sure: 'Not sure'
}

export const CAUSE_LABELS: Record<DamageCause, string> = {
  stolen: 'Stolen',
  vandalism: 'Vandalism',
  weather: 'Weather',
  wear: 'Wear and tear',
  accident: 'Accident',
  unknown: 'Unknown'
}

export const PREVENTION_STEP_LABELS: Record<PreventionStep, string> = {
  cctv: 'CCTV',
  guard: 'Security guard',
  patrols: 'More frequent patrols',
  material: 'Stronger material',
  other: 'Other'
}

const SEED_FENCE_PANELS = new Set(
  elminaSeed.segments.flatMap((s) => s.expectedInventory.filter((i) => i.type === 'fence_panel').map((i) => i.id))
)

const SEED_RING_BUOYS = new Set(
  elminaSeed.segments.flatMap((s) => s.expectedInventory.filter((i) => i.type === 'ring_buoy').map((i) => i.id))
)

const SEED_SIGNS = new Set(
  elminaSeed.segments.flatMap((s) => s.expectedInventory.filter((i) => i.type === 'sign').map((i) => i.id))
)

/**
 * Maps a candidate or report to a canonical DamageIssueType without AI or rationale text guessing.
 * Deterministic mapping:
 * - Current DamageReport.issueType when present.
 * - Seed fence missing -> fence_missing, changed -> fence_damaged.
 * - Seed ring buoy missing -> ring_buoy_missing.
 * - Seed sign missing -> sign_missing.
 * - Actual candidate class worn_path -> path_worn.
 * - Actual candidate class floating_debris -> debris.
 */
export function issueTypeOf(candidate: Candidate, report: DamageReport | null): DamageReport['issueType'] {
  if (report?.issueType !== null && report?.issueType !== undefined) {
    return report.issueType
  }

  const s1ItemId = elminaSeed.story.s1.inventoryItemId
  if (candidate.inventoryItemId) {
    if (candidate.inventoryItemId === s1ItemId || SEED_FENCE_PANELS.has(candidate.inventoryItemId)) {
      if (candidate.itemStatus === 'missing') return 'fence_missing'
      if (candidate.itemStatus === 'changed') return 'fence_damaged'
    }
    if (SEED_RING_BUOYS.has(candidate.inventoryItemId)) {
      if (candidate.itemStatus === 'missing') return 'ring_buoy_missing'
    }
    if (SEED_SIGNS.has(candidate.inventoryItemId)) {
      if (candidate.itemStatus === 'missing') return 'sign_missing'
    }
  }

  if (candidate.class === 'worn_path') {
    return 'path_worn'
  }

  if (candidate.class === 'floating_debris') {
    return 'debris'
  }

  return null
}

/** Lightweight display metadata compatible with SampleMeta, allowing nullable scene when not a sample card. */
export type CandidateDisplayMeta = {
  title: string
  viewpointName: string
  scene: Scene | null
  box: Box | null
  summary: string | null
  fieldTaskId?: string
}

/**
 * Returns display metadata for candidate evidence.
 * Uses existing sample meta if present, or deterministic fallback with actual segment and viewpoint names.
 * Never fabricates AI summary, bounding box, or fake scene.
 */
export function candidateMeta(e: CandidateEvidence, s: Snapshot): CandidateDisplayMeta {
  const sample = s.metas[e.candidate.id]
  if (sample) return sample

  const vpId = e.observations[0]?.viewpointId ?? null
  const vpDesc = vpId ? describeViewpoint(vpId) : null
  const viewpointName = vpDesc?.name ?? e.segment.name
  const issue = issueTypeOf(e.candidate, null)
  const title = issue ? ISSUE_LABELS[issue] : viewpointName

  return {
    title,
    viewpointName,
    scene: vpDesc?.scene ?? null,
    box: null,
    summary: null
  }
}
