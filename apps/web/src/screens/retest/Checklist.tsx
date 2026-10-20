import type { Finding, RouteClosure, Segment, WorkOrder } from '@safe-edge/contracts'
import type { SampleMeta } from '../../sample'
import { client } from '../../store'
import { OPENING_LABEL } from '../fix-lens/lens'
import { CheckForm, type Item } from './CheckForm'
import { sampleEvidence } from './useRepair'

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
  meta: SampleMeta
  installerName: string
  fixedAt: string
}) {
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
    <CheckForm
      items={items}
      intro={`Fixed by ${installerName} ${fixedAt}. You did not install it, so you can check it.`}
      scene={meta.scene}
      simulated={finding.simulated}
      acceptance={remedy?.acceptanceTest}
      signLabel="Sign and issue the pass"
      failLabel="Fail this repair"
      record={(result, checklist, reason) =>
        client().recordRetest({
          body: {
            workOrderId: workOrder.id,
            checklist,
            evidence: [sampleEvidence(`evd_sample_${workOrder.id}_retest`)],
            result,
            reason
          }
        })
      }
      onDone={(out) => {
        if (out.pass) window.location.hash = `#/passes/${out.pass.id}`
      }}
    />
  )
}
