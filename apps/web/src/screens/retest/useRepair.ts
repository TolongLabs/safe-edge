import type { Finding, RouteClosure, Segment, WorkOrder } from '@safe-edge/contracts'
import { useEffect, useState } from 'react'
import { client } from '../../store'

export type Repair = { finding: Finding; segment: Segment; assetName: string; closure: RouteClosure }

/** The finding, its segment and what the work order's remedy does to the routes, all read back from core. */
export function useRepair(workOrder: WorkOrder) {
  const [repair, setRepair] = useState<Repair | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let live = true
    setError(null)
    client()
      .getFinding({ params: { id: workOrder.findingId } })
      .then(async (finding) => {
        const [segment, closure] = await Promise.all([
          client().getSegment({ params: { id: finding.segmentId } }),
          client().previewRouteClosure({
            params: { id: finding.segmentId },
            body: { remedyIds: workOrder.remedyId ? [workOrder.remedyId] : [] }
          })
        ])
        return { finding, segment: segment.segment, assetName: segment.asset.name, closure }
      })
      .then(
        (r) => live && setRepair(r),
        (e) => live && setError(e instanceof Error ? e : new Error(String(e)))
      )
    return () => {
      live = false
    }
  }, [workOrder.findingId, workOrder.remedyId, version])
  return { repair, error, retry: () => setVersion((v) => v + 1) }
}

/** A sample picture reference: the demo has no uploads, so the id says whose it is and the screen says it is a sample. */
export const sampleEvidence = (id: string) => ({
  id,
  mediaType: 'image/png' as const,
  uri: `sample://${id}`,
  sha256: null,
  capturedAt: null,
  simulated: true,
  source: 'user' as const
})
