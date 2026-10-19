import type {
  Actor,
  CoreOperationId,
  DispatchResult,
  EdgeEvent,
  ExternalWorkStatus,
  WorkOrderExternalError,
  WorkOrderProvider,
  WorkOrderStatus
} from '@safe-edge/contracts'
import type { Core } from '@safe-edge/core'

/** Who sends findings to the work-order system and records the link: the API itself, not a person. */
const SYSTEM: Actor = { type: 'system', id: 'api.work-orders', role: 'system', scopes: [] }

type Step = WorkOrderExternalError['step']

/**
 * The external status each work order status calls for (Procore Observations: the assignee marks the work
 * `ready_for_review`, the reviewer closes it or sends it back). A submitted work order's record is new and open.
 */
const EXTERNAL_STATUS: Partial<Record<WorkOrderStatus, ExternalWorkStatus>> = {
  completed: 'ready_for_review',
  accepted: 'closed',
  rejected: 'rejected'
}

/**
 * Keeps the external work-order system in step with each submitted work order. On submit it files the finding with
 * its observations' photos and records the external record on the work order. Only a person submits (INBOX-4), so no
 * draft, the agent's or the one confirming drafts, leaves Safe Edge; a reopened finding's new work order gets its own
 * record. The link is stored as soon as the record exists, before the photos go, so Safe Edge never loses track of a
 * record it created. Repair completion moves the record to ready for review, and the re-test to closed or rejected.
 *
 * Each work order's jobs run one after another, so a status change waits for the record to exist. A failure is
 * recorded on the work order (`externalError`, with the step that failed, audited) and logged; later status changes
 * wait until a manager or engineer retries it (`retryWorkOrderHandOff`), and `retry` resumes from that step and
 * brings the status up to date.
 */
export function forwardWorkOrders({
  core,
  subscribe,
  provider
}: {
  core: Pick<Core, 'dispatch'>
  subscribe: (listener: (event: EdgeEvent) => void) => void
  provider: WorkOrderProvider
}) {
  const queues = new Map<string, Promise<void>>()
  const enqueue = (workOrderId: string, job: () => Promise<void>) =>
    queues.set(workOrderId, (queues.get(workOrderId) ?? Promise.resolve()).then(job))

  subscribe((event) => {
    if (event.type === 'edge.work_order.submitted.v1') {
      const { workOrderId } = event.data
      enqueue(workOrderId, () => handOff(workOrderId, 'createFinding'))
    } else if (event.type === 'edge.repair.completed.v1') {
      const { workOrderId } = event.data
      enqueue(workOrderId, () => handOff(workOrderId, 'updateStatus', 'ready_for_review'))
    } else if (event.type === 'edge.retest.recorded.v1' && event.data.workOrderId !== null) {
      const { workOrderId, result } = event.data
      const status = result === 'accepted' ? 'closed' : 'rejected'
      enqueue(workOrderId, () => handOff(workOrderId, 'updateStatus', status))
    }
  })

  /**
   * Runs the hand-off from `from`. A status change names its `status`; a hand-off or a retry syncs the status the
   * work order has reached.
   */
  async function handOff(workOrderId: string, from: Step, status?: ExternalWorkStatus): Promise<void> {
    let step = from
    try {
      const workOrder = read(core.dispatch('getWorkOrder', SYSTEM, { params: { id: workOrderId } }))
      if (status !== undefined) {
        // An earlier failure waits for a person; their retry brings the status up to date.
        if (workOrder.externalError !== null) return
        if (workOrder.externalRef === null) {
          step = 'createFinding'
          throw new Error(`${workOrderId} has no external record to move: its hand-off never finished`)
        }
      }
      let ref = workOrder.externalRef
      if (step === 'createFinding') {
        const finding = read(core.dispatch('getFinding', SYSTEM, { params: { id: workOrder.findingId } }))
        ref = (await provider.createFinding(finding)).id
        read(
          core.dispatch('setWorkOrderExternalRef', SYSTEM, { params: { id: workOrderId }, body: { externalRef: ref } })
        )
        step = 'addEvidence'
      }
      if (ref === null) throw new Error(`${workOrderId} has no external record to resume ${step} on`)
      if (step === 'addEvidence') {
        const finding = read(core.dispatch('getFinding', SYSTEM, { params: { id: workOrder.findingId } }))
        const { observations } = read(core.dispatch('getCandidate', SYSTEM, { params: { id: finding.candidateId } }))
        await provider.addEvidence(
          { id: ref },
          observations.flatMap((observation) => (observation.image === null ? [] : [observation.image]))
        )
        step = 'updateStatus'
      }
      const target = status ?? EXTERNAL_STATUS[workOrder.status]
      if (target !== undefined) await provider.updateStatus({ id: ref }, target)
    } catch (error) {
      console.error(`Work order ${workOrderId}: ${step} failed in the work-order system`, error)
      // The failure goes on the work order and the audit chain; if even that is refused, it throws.
      const message = error instanceof Error ? error.message : String(error)
      read(
        core.dispatch('recordWorkOrderExternalError', SYSTEM, { params: { id: workOrderId }, body: { step, message } })
      )
    }
  }

  return {
    /** Resumes a hand-off a person retried, from the step that failed. */
    retry(workOrderId: string, step: Step): void {
      enqueue(workOrderId, () => handOff(workOrderId, step))
    }
  }
}

function read<K extends CoreOperationId>(result: DispatchResult<K>) {
  if (!result.ok) throw new Error(result.message)
  return result.data
}
