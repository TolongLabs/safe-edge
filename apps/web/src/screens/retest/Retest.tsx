import { WarningCircle } from '@phosphor-icons/react'
import type { WorkOrder } from '@safe-edge/contracts'
import { NotInSession, Screen } from '../../shell/Shell'
import { can, useSignedIn, useStore } from '../../store'
import { must, plain } from '../fix-lens/lens'
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

function Detail({ workOrder }: { workOrder: WorkOrder }) {
  const s = useStore().snapshot!
  const { user } = useSignedIn()
  const { repair, error, retry } = useRepair(workOrder)
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
  const meta = must(s.metas[finding.candidateId], `sample details for ${finding.candidateId}`)
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
        <Installer workOrder={workOrder} remedy={remedy} closure={closure} finding={finding} scene={meta.scene} />
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
        meta={meta}
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
    // An expiring pass was issued too.
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
    meta.title,
    <>
      <p className="rt-help">
        {segment.name.includes(assetName) ? segment.name : `${segment.name} · ${assetName}`} ·{' '}
        {status.replace('_', ' ')}
        {workOrder.dueAt &&
          ` · due ${new Date(workOrder.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`}
      </p>
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
