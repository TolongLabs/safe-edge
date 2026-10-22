import { ShieldCheck, WarningCircle } from '@phosphor-icons/react'
import { operations, type AuditEvent, type EdgePass, type RouteClosure, type Segment } from '@safe-edge/contracts'
import { useEffect, useState } from 'react'
import { Screen } from '../../../shell/Shell'
import { can, client, useStore, type Snapshot } from '../../../store'
import { ROLE_WORDS, must, plain } from '../../fix-lens/lens'
import { StateMark } from '../../inbox/Inbox'
import { actionWords, plainReason, useFlagNames } from '../../retest/names'
import './issued.css'

type Loaded = { pass: EdgePass; segment: Segment; assetName: string; closure: RouteClosure; audit: AuditEvent[] | null }
const date = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
// Today shows the time only; another day shows the date too.
const clock = (iso: string) => {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`
}

/** The records this pass came from: the flag, its finding, the remedy, the work order, the re-tests and the pass. */
function chain(pass: EdgePass, s: Snapshot): Set<string> {
  const workOrders = s.workOrders.filter(
    (w) => s.findings.find((f) => f.id === w.findingId)?.segmentId === pass.segmentId
  )
  const findings = s.findings.filter(
    (f) => f.segmentId === pass.segmentId && workOrders.some((w) => w.findingId === f.id)
  )
  return new Set([
    pass.id,
    ...pass.scope.retestIds,
    ...workOrders.flatMap((w) => [w.id, ...(w.remedyId ? [w.remedyId] : [])]),
    ...findings.flatMap((f) => [f.id, f.candidateId])
  ])
}

// One action writes several records and the log keeps one event for each; show a run of the same step once.
const steps = (audit: AuditEvent[], ids: Set<string>) =>
  audit
    .filter((e) => e.decision === 'allowed' && ids.has(e.subjectId) && e.action !== 'updateWorkOrder')
    .filter((e, i, all) => i === 0 || e.action !== all[i - 1]!.action || e.actor.id !== all[i - 1]!.actor.id)

export function PassIssued({ passId }: { passId: string }) {
  const s = useStore().snapshot!
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [version, setVersion] = useState(0)
  const reader = can('listAudit')
  const names = useFlagNames(data?.pass.stateReason ?? null, s)
  useEffect(() => {
    let live = true
    setError(null)
    client()
      .getPass({ params: { id: passId } })
      .then(async (pass) => {
        const [detail, closure, audit] = await Promise.all([
          client().getSegment({ params: { id: pass.segmentId } }),
          client().previewRouteClosure({ params: { id: pass.segmentId }, body: { remedyIds: [] } }),
          reader ? client().listAudit({}) : null
        ])
        return { pass, segment: detail.segment, assetName: detail.asset.name, closure, audit }
      })
      .then(
        (d) => live && setData(d),
        (e) => live && setError(e instanceof Error ? e : new Error(String(e)))
      )
    return () => {
      live = false
    }
  }, [passId, reader, version, s])
  const frame = (context: string, body: React.ReactNode) => (
    <Screen title="Pass issued" context={context}>
      <main className="detail island pi-main">{body}</main>
    </Screen>
  )
  if (error)
    return frame(
      'Could not load',
      <div className="banner error" role="alert">
        <WarningCircle size={20} weight="bold" aria-hidden="true" />
        <span>
          <b>Could not load this pass.</b> {error.message}. Nothing was changed.
        </span>
        <button className="btn small" onClick={() => setVersion(version + 1)}>
          Try again
        </button>
      </div>
    )
  if (!data)
    return frame(
      'Loading the pass',
      <div className="skeleton-rows" role="status">
        <p className="pi-help">Loading the pass…</p>
        <i />
        <i />
      </div>
    )
  const { pass, segment, assetName, closure, audit } = data
  const name = (id: string) =>
    plain(
      must(
        s.users.find((u) => u.id === id),
        `user ${id}`
      ).name
    )
  const covered = closure.routes.filter((r) => pass.scope.routeIds.includes(r.id))
  // Only claim a closure for the routes this pass names; a pass issued after a false-alarm check names none.
  const closedCovered = covered.filter((r) => r.status === 'closed')
  const ways =
    covered.length === 0
      ? 'No way to the water is named by this pass.'
      : closedCovered.length < covered.length
        ? `${closedCovered.length} of ${covered.length} ways to the water this pass covers are closed.`
        : covered.length === 1
          ? `The way to the water this pass covers at ${segment.name} is closed.`
          : covered.length === closure.routes.length
            ? `All ${covered.length} ways to the water at ${segment.name} are closed.`
            : `The ${covered.length} ways to the water this pass covers at ${segment.name} are closed.`
  const valid = pass.state === 'valid' || pass.state === 'expiring'
  const place = segment.name.includes(assetName) ? segment.name : `${segment.name} · ${assetName}`
  const badge =
    pass.validTo && valid
      ? `Valid to ${date(pass.validTo)}`
      : `Pass ${pass.state}${pass.validTo ? `, ended ${date(pass.validTo)}` : ''}`
  const timeline = audit ? steps(audit, chain(pass, s)) : null
  return frame(
    place,
    <div className="pi-grid">
      <div className="pi-hero">
        <span className={`pi-seal ${valid ? 'valid' : 'not-valid'}`}>
          <ShieldCheck size={40} weight="bold" aria-hidden="true" />
        </span>
        <h2 className="pi-title">{valid ? 'Safety pass issued' : `Safety pass ${pass.state}`}</h2>
        <p className="pi-place">{place}</p>
        <p className={`pi-badge ${pass.state}`}>
          <StateMark state={pass.state} />
          {badge}
        </p>
        {pass.stateReason && names && <p className="pi-help">{plainReason(pass.stateReason, s, names)}</p>}
        <p className="pi-ways">
          {ways}
          {/* core sets issuedBy to whoever recorded the accepting re-test (policy.ts movePass: issuedBy = tx.actor.id) */}
          {pass.issuedBy && ` Issued by ${name(pass.issuedBy)}, who signed the check.`}
        </p>
        {pass.simulated && <p className="pi-help">Simulated record</p>}
        <section aria-label="Routes covered">
          <h3>Routes this pass covers</h3>
          {covered.length === 0 ? (
            <p className="pi-help">No route is named by this pass.</p>
          ) : (
            <ul className="pi-routes">
              {covered.map((r) => (
                <li key={r.id}>{r.fromFeature.label}</li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Re-tests">
          <h3>Re-tests</h3>
          <ul className="pi-routes">
            {pass.scope.retestIds.map((id, i) => (
              <li key={id}>Re-test {i + 1} · accepted</li>
            ))}
          </ul>
        </section>
        <div className="pi-actions">
          <a className="btn" href="#/inbox">
            Back to Inbox
          </a>
        </div>
      </div>
      <section className="pi-timeline-card" aria-label="How it got here">
        <h3>How it got here</h3>
        {timeline ? (
          timeline.length === 0 ? (
            <p className="pi-help">The audit trail has no steps for this pass in this session.</p>
          ) : (
            <ol className="pi-timeline">
              {timeline.map((e, i) => (
                <li key={e.id}>
                  <span className="pi-time">{clock(e.at)}</span>
                  <span className={`pi-mark${i === timeline.length - 1 ? ' last' : ''}`} aria-hidden="true" />
                  <span>
                    <b>{actionWords(e.action)}</b>
                    <span className="pi-who">{name(e.actor.id)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )
        ) : (
          <p className="pi-help">
            Only the{' '}
            {(operations.listAudit.roles as readonly string[])
              .map((r) => ROLE_WORDS[r as keyof typeof ROLE_WORDS])
              .join(' and the ')}{' '}
            can read this timeline.
          </p>
        )}
      </section>
    </div>
  )
}
