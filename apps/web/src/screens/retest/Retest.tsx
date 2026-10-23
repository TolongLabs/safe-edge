import { WarningCircle } from '@phosphor-icons/react'
import type { RepairJourney, WorkOrder } from '@safe-edge/contracts'
import { useEffect, useState } from 'react'
import { NotInSession, Screen } from '../../shell/Shell'
import { can, client, useSignedIn, useStore, type Snapshot } from '../../store'
import { must, plain } from '../fix-lens/lens'
import { StageTracker } from '../shared/StageTracker'
import { Checklist } from './Checklist'
import { Clearance } from './Clearance'
import { Held } from './Held'
import { Installer } from './Installer'
import { WaitingList } from './WaitingList'
import { useRepair } from './useRepair'
import './retest.css'

const fixedWhen = (iso: string) => {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${d.toDateString() === new Date().toDateString() ? 'today' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at ${time}`
}

function useJourney(candidateId: string | null, s: Snapshot) {
  const [state, setState] = useState<{ journey: RepairJourney; journeys: RepairJourney[] } | { error: Error } | null>(
    null
  )
  useEffect(() => {
    let live = true
    setState(null)
    if (!candidateId) return
    const historyIds = [
      ...new Set(
        s.workOrders
          .filter((w) => w.status === 'accepted')
          .flatMap((w) => s.findings.filter((f) => f.id === w.findingId).map((f) => f.candidateId))
      )
    ]
    Promise.all([
      client().getRepairJourney({ params: { id: candidateId } }),
      Promise.all(historyIds.map((id) => client().getRepairJourney({ params: { id } })))
    ]).then(
      ([journey, journeys]) => live && setState({ journey, journeys }),
      (error: unknown) => live && setState({ error: error instanceof Error ? error : new Error(String(error)) })
    )
    return () => {
      live = false
    }
  }, [candidateId, s])
  return state && 'journey' in state
    ? { journey: state.journey, journeys: state.journeys, error: null }
    : { journey: null, journeys: [], error: state && 'error' in state ? state.error : null }
}

function Detail({ workOrder }: { workOrder: WorkOrder }) {
  const s = useStore().snapshot!
  const { user } = useSignedIn()
  const { repair, error, retry } = useRepair(workOrder)
  const { journey, journeys, error: journeyError } = useJourney(repair?.finding.candidateId ?? null, s)
  const who = (id: string | null) =>
    plain(
      must(
        s.users.find((u) => u.id === id),
        `user ${id}`
      ).name
    )
  const frame = (context: string, body: React.ReactNode) => (
    <Screen title="Repair check" context={context}>
      <main className="detail island rt-main">{body}</main>
    </Screen>
  )
  if (error)
    return frame(
      workOrder.id,
      <div className="banner error" role="alert">
        <WarningCircle size={20} weight="bold" aria-hidden="true" />
        <span>
          <b>Could not load this repair.</b> {error.message}. Nothing was changed.
        </span>
        <button className="btn small" onClick={retry}>
          Try again
        </button>
      </div>
    )
  if (!repair)
    return frame(
      'Loading the repair',
      <div className="skeleton-rows" role="status">
        <p className="rt-help">Loading the repair…</p>
        <i />
        <i />
        <i />
      </div>
    )
  const { finding, segment, assetName, closure } = repair
  const meta = s.metas[finding.candidateId]
  const scene = meta?.scene ?? null
  const title = meta?.title ?? journey?.report?.description ?? 'Repair check'
  const remedy = closure.remedies[0]
  const status = workOrder.status
  const mine = user.id === workOrder.installerUserId
  const pass = s.passes.find((p) => p.segmentId === finding.segmentId)
  const card = (x: React.ReactNode) => <div className="rt-card">{x}</div>
  let body: React.ReactNode
  if (status === 'draft') {
    body = card(<p>This work order is still a draft. The park manager has not sent it yet.</p>)
  } else if (status === 'submitted' || status === 'in_progress') {
    body =
      can('startWorkOrder') && mine ? (
        <Installer workOrder={workOrder} remedy={remedy} closure={closure} finding={finding} scene={scene} />
      ) : (
        card(
          <p>
            {status === 'submitted' ? 'Waiting for' : 'In progress with'} {who(workOrder.installerUserId)} to do the
            repair.
            {can('startWorkOrder') && !mine && ' It is assigned to someone else.'}
          </p>
        )
      )
  } else if (status === 'completed') {
    body = can('recordRetest') ? (
      <Checklist
        workOrder={workOrder}
        finding={finding}
        segment={segment}
        closure={closure}
        meta={meta ?? null}
        installerName={who(workOrder.installerUserId)}
        fixedAt={fixedWhen(must(workOrder.completedAt ?? undefined, 'when the repair was completed'))}
      />
    ) : mine ? (
      card(
        <>
          <h2>A different person checks this repair</h2>
          <p>You installed it, so someone else signs it off. You cannot issue the pass.</p>
        </>
      )
    ) : (
      card(
        <p>
          Fixed by {who(workOrder.installerUserId)}{' '}
          {fixedWhen(must(workOrder.completedAt ?? undefined, 'completion time'))}. A reviewer checks it next; you can
          read it here.
        </p>
      )
    )
  } else if (status === 'accepted') {
    const issued = pass !== undefined && (pass.state === 'valid' || pass.state === 'expiring')
    body = card(
      <>
        <h2>Repair checked and accepted</h2>
        {issued ? (
          <a className="btn primary" href={`#/passes/${pass!.id}`}>
            Open the pass
          </a>
        ) : (
          <Held pass={pass} s={s} />
        )}
      </>
    )
  } else {
    body = card(
      <>
        <h2>Repair failed the check</h2>
        <p>This repair failed its check. The finding is open again. A manager chooses a new fix in Fix Lens.</p>
        <a className="btn" href={`#/fix-lens/${finding.id}`}>
          Open Fix Lens
        </a>
      </>
    )
  }
  return frame(
    title,
    <>
      <p className="rt-help">
        {segment.name.includes(assetName) ? segment.name : `${segment.name} · ${assetName}`} ·{' '}
        {status.replace('_', ' ')}
        {workOrder.dueAt &&
          ` · due ${new Date(workOrder.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`}
      </p>
      {journey?.report?.description && <p className="rt-help">{journey.report.description}</p>}
      {journeyError ? (
        <p className="rt-help" role="status">
          Could not load the repair stages: {journeyError.message}
        </p>
      ) : journey ? (
        <StageTracker journey={journey} journeys={journeys} users={s.users} />
      ) : (
        <p className="rt-help" role="status">
          Loading the repair stages…
        </p>
      )}
      {body}
    </>
  )
}

export function Retest({ workOrderId }: { workOrderId: string | null }) {
  const s = useStore().snapshot!
  if (!workOrderId) return <WaitingList />
  if (workOrderId.startsWith('cand_')) return <Clearance candidateId={workOrderId} />
  const workOrder = s.workOrders.find((w) => w.id === workOrderId)
  return workOrder ? <Detail workOrder={workOrder} /> : <NotInSession />
}
