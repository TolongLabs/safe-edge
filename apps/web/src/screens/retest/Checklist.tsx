import type { EvidenceRef, Finding, RouteClosure, Segment, WorkOrder } from '@safe-edge/contracts'
import { useEffect, useState } from 'react'
import type { SampleMeta } from '../../sample'
import { can, client } from '../../store'
import { OPENING_LABEL } from '../fix-lens/lens'
import { CheckForm, type Item } from './CheckForm'

/** The reviewer's checks: a result and a reason for every one, then the pinned action bar. */
export function Checklist({
  workOrder,
  finding,
  segment,
  closure,
  meta,
  installerName,
  fixedAt
}: {
  workOrder: WorkOrder
  finding: Finding
  segment: Segment
  closure: RouteClosure
  meta: SampleMeta | null
  installerName: string
  fixedAt: string
}) {
  const [beforeImage, setBeforeImage] = useState<EvidenceRef | null>(null)
  const [beforeError, setBeforeError] = useState<string | null>(null)
  const readable = can('getCandidate')

  useEffect(() => {
    setBeforeImage(null)
    setBeforeError(null)
    if (!readable) return
    let live = true
    client()
      .getCandidate({ params: { id: finding.candidateId } })
      .then(
        (card) => {
          if (!live) return
          const firstObs = card.observations?.find((o) => o.image)?.image ?? card.observations?.[0]?.image ?? null
          setBeforeImage(firstObs)
        },
        (error: unknown) => {
          if (!live) return
          setBeforeError(error instanceof Error ? error.message : String(error))
        }
      )
    return () => {
      live = false
    }
  }, [finding.candidateId, readable])

  const remedy = closure.remedies[0]
  const gauged = closure.openings.filter((o) => remedy?.blocksOpeningIds.includes(o.id))
  const items: Item[] = [
    ...segment.viewpoints.map((v, i) => ({
      key: `vp:${v.id}`,
      kind: 'saved_view' as const,
      subjectId: v.id,
      title: `Saved view ${i + 1}`
    })),
    ...closure.routes.map((r) => ({
      key: `rt:${r.id}`,
      kind: 'route_check' as const,
      subjectId: r.id,
      title: r.fromFeature.label
    })),
    ...gauged.map((o) => ({
      key: `op:${o.id}`,
      kind: 'gauge_reading' as const,
      subjectId: o.id,
      title: `${OPENING_LABEL[o.type]} gauge`,
      opening: o
    })),
    { key: 'photo', kind: 'photo' as const, subjectId: null, title: 'Re-test photo' }
  ]
  return (
    <>
      <h2>A different person checks this repair</h2>
      {beforeError && (
        <p className="banner error" role="alert">
          Could not load the before photo: {beforeError}
        </p>
      )}
      <CheckForm
        items={items}
        intro={`Fixed by ${installerName} ${fixedAt}. You did not install it, so you can check it.`}
        scene={meta?.scene ?? null}
        beforeImage={beforeImage}
        acceptance={remedy?.acceptanceTest}
        signLabel="Sign and issue the pass"
        failLabel="Fail this repair"
        record={(result, checklist, reason, evidence) =>
          client().recordRetest({
            body: {
              workOrderId: workOrder.id,
              checklist,
              evidence,
              result,
              reason
            }
          })
        }
        onDone={(out) => {
          if (out.pass) window.location.hash = `#/passes/${out.pass.id}`
        }}
      />
    </>
  )
}
