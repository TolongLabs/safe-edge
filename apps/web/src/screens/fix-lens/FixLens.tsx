import { Info, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { NotInSession, Screen } from '../../shell/Shell'
import type { WorkOrder } from '@safe-edge/contracts'
import { useStore, type Snapshot } from '../../store'
import { Compare } from './Compare'
import { must, useLens } from './lens'
import { Mark } from './Mark'
import { Sent } from './Sent'
import './fix-lens.css'

type Finding = Snapshot['findings'][number]

const STEPS = ['Mark the openings', 'Compare fixes', 'Send the fix']

function List() {
  const s = useStore().snapshot!
  const open = s.findings.filter((f) => f.status !== 'closed')
  return (
    <Screen title="Fix Lens" context="Choose a fix for a confirmed finding">
      <main className="detail island">
        {open.length === 0 ? (
          <div className="empty-state left">
            <span className="icon-tile">
              <Info size={24} weight="bold" aria-hidden="true" />
            </span>
            <h2>No open findings in this session</h2>
            <p>
              This does not mean the lake edge is safe: nothing has been confirmed here yet. Confirm a flag in the Inbox
              first.
            </p>
            <a className="btn primary" href="#/inbox">
              Back to Inbox
            </a>
          </div>
        ) : (
          <>
            <h2 className="fl-question">Findings that need a fix</h2>
            <ul className="fl-findings">
              {open.map((f) => (
                <li key={f.id}>
                  <a href={`#/fix-lens/${f.id}`}>
                    {must(s.metas[f.candidateId], `sample details for ${f.candidateId}`).title}
                  </a>
                  <span className="fl-muted"> · {f.status.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </Screen>
  )
}

function Lens({ finding }: { finding: Finding }) {
  const s = useStore().snapshot!
  const meta = must(s.metas[finding.candidateId], `sample details for ${finding.candidateId}`)
  // The current order is the newest one a re-test has not rejected; a rejected one stays in the list as history.
  const newest = (orders: Snapshot['workOrders']) =>
    orders.reduce<WorkOrder | null>((a, w) => (a && a.createdAt > w.createdAt ? a : w), null)
  const orders = s.workOrders.filter((w) => w.findingId === finding.id)
  const workOrder = newest(orders.filter((w) => w.status !== 'rejected'))
  const failed = workOrder === null ? newest(orders) : null
  const sent = workOrder !== null && workOrder.status !== 'draft'
  const { lens, error, reload } = useLens(finding.segmentId, (workOrder ?? failed)?.remedyId ?? null)
  const [step, setStep] = useState(sent ? 3 : failed ? 2 : 1)
  const main = useRef<HTMLElement>(null)
  // A new step starts at its top: the island scrolls on a wide screen, the page on a phone.
  const go = (n: number) => {
    setStep(n)
    main.current?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }
  const [chosen, setChosen] = useState<string | null>(workOrder?.remedyId ?? null)
  // Nothing is chosen for the manager: sending waits until a fix is picked.
  const when = `Finding ${new Date(finding.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
  const body = error ? (
    <div className="banner error" role="alert">
      <WarningCircle size={20} weight="bold" aria-hidden="true" />
      <span>
        <b>Could not check which ways stay open.</b> {error.message}. Nothing was changed, and sending stays off until
        the check works.
      </span>
      <button className="btn small" onClick={reload}>
        Try again
      </button>
    </div>
  ) : !lens ? (
    <div className="fl-skel" role="status">
      <p className="fl-muted">Loading the photo and openings…</p>
      <i />
      <i />
      <i />
    </div>
  ) : step === 1 ? (
    <Mark finding={finding} scene={meta.scene} lens={lens} reload={reload} when={when} onNext={() => go(2)} />
  ) : step === 2 ? (
    <Compare
      finding={finding}
      lens={lens}
      reload={reload}
      workOrder={workOrder}
      failed={failed}
      chosen={chosen}
      setChosen={setChosen}
      onSent={() => go(3)}
    />
  ) : sent ? (
    <Sent finding={finding} workOrder={workOrder} scene={meta.scene} lens={lens} when={when} />
  ) : (
    <div className="empty-state left">
      <span className="icon-tile">
        <PaperPlaneTilt size={24} weight="bold" aria-hidden="true" />
      </span>
      <h2>No fix sent yet</h2>
      <p>Choose a fix in step 2. The work order shows here once the park manager has sent it.</p>
      <button className="btn" onClick={() => go(2)}>
        Compare fixes
      </button>
    </div>
  )
  return (
    <Screen title="Fix Lens" context={`${meta.title} · ${meta.viewpointName}`}>
      <main className="detail island" ref={main}>
        <ol className="fl-steps" aria-label="Steps">
          {STEPS.map((name, i) => (
            <li key={name}>
              <button aria-current={step === i + 1 ? 'step' : undefined} onClick={() => go(i + 1)}>
                <span className="fl-step-n" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="fl-step-name">{name}</span>
              </button>
            </li>
          ))}
        </ol>
        {body}
      </main>
    </Screen>
  )
}

export function FixLens({ findingId }: { findingId: string | null }) {
  const s = useStore().snapshot!
  if (!findingId) return <List />
  const finding = s.findings.find((f) => f.id === findingId)
  // A reset removes the finding; the page then shows the same words as a link to a record that never existed.
  return finding ? <Lens finding={finding} /> : <NotInSession />
}
