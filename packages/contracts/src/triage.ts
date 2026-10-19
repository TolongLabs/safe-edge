import * as z from 'zod'
import { ItemStatus, OTHER_CHANGE_CLASSES, Uncertainty } from './entities.ts'
import { named } from './primitives.ts'

// The Claude vision triage output schema from the TRD "Claude calls" section. The core, not the model, assigns
// tiers; nothing here can change a pass. Text read from an image is reported as `text_in_image`, never obeyed.

/** A coarse 4 × 4 grid cell (columns A–D, rows 1–4); vision models mislocalise pixel boxes. */
export const GridCell = z.string().regex(/^[A-D][1-4]$/)

export const TriageItem = z.object({
  inventoryItemId: z.string(),
  status: ItemStatus,
  gridCell: GridCell,
  rationale: z.string(),
  uncertainty: Uncertainty
})
export type TriageItem = z.infer<typeof TriageItem>

export const TriageOtherChange = z.object({
  class: z.enum(OTHER_CHANGE_CLASSES),
  gridCell: GridCell,
  rationale: z.string(),
  uncertainty: Uncertainty
})
export type TriageOtherChange = z.infer<typeof TriageOtherChange>

export const TriageResult = named(
  'TriageResult',
  z.object({
    items: z.array(TriageItem),
    otherChanges: z.array(TriageOtherChange),
    notVisible: z.array(z.string())
  })
)
export type TriageResult = z.infer<typeof TriageResult>
