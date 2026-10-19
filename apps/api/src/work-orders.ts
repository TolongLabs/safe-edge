import type { Actor, CoreOperationId, DispatchResult, EdgeEvent, WorkOrderProvider } from '@safe-edge/contracts'
import type { Core } from '@safe-edge/core'

/** Who sends findings to the work-order system and records the link: the API itself, not a person. */
const SYSTEM: Actor = { type: 'system', id: 'api.work-orders', role: 'system', scopes: [] }

/**
 * Sends the finding behind each drafted work order, with its observations' photos, to the external work-order system,
 * and records the external record on the work order. A draft follows every confirmed candidate (and every new work
 * order for a reopened finding), so each work order gets its own external record. The link is stored as soon as the
 * record exists, before the photos go, so Safe Edge never loses track of a record it created. A failure is logged,
 * like a webhook delivery; nothing retries it.
 */
export function forwardWorkOrders({
  core,
  subscribe,
  provider
}: {
  core: Pick<Core, 'dispatch'>
  subscribe: (listener: (event: EdgeEvent) => void) => void
  provider: WorkOrderProvider
}): void {
  subscribe((event) => {
    if (event.type !== 'edge.work_order.drafted.v1') return
    const { workOrderId } = event.data
    forward(workOrderId).catch((error: unknown) =>
      console.error(`Work order ${workOrderId} did not reach the work-order system`, error)
    )
  })

  async function forward(workOrderId: string) {
    const workOrder = read(core.dispatch('getWorkOrder', SYSTEM, { params: { id: workOrderId } }))
    const finding = read(core.dispatch('getFinding', SYSTEM, { params: { id: workOrder.findingId } }))
    const evidence = read(core.dispatch('getCandidate', SYSTEM, { params: { id: finding.candidateId } }))
    const ref = await provider.createFinding(finding)
    read(
      core.dispatch('setWorkOrderExternalRef', SYSTEM, { params: { id: workOrderId }, body: { externalRef: ref.id } })
    )
    await provider.addEvidence(
      ref,
      evidence.observations.flatMap((observation) => (observation.image === null ? [] : [observation.image]))
    )
  }
}

function read<K extends CoreOperationId>(result: DispatchResult<K>) {
  if (!result.ok) throw new Error(result.message)
  return result.data
}
