import { ShieldCheck, WarningCircle } from '@phosphor-icons/react'
import { operations, type AuditEvent, type EdgePass, type RouteClosure, type Segment } from '@safe-edge/contracts'
import { useEffect, useState } from 'react'
import { Screen } from '../../../shell/Shell'
import { can, client, useStore, type Snapshot } from '../../../store'
import { ROLE_WORDS, must, plain } from '../../fix-lens/lens'
import { StateMark } from '../../inbox/Inbox'
import { actionWords, plainReason as certificateReason, useFlagNames, type FlagNames } from '../../retest/names'
import './issued.css'

type Loaded = {
  pass: EdgePass | null
  segment: Segment
  assetName: string
  owner: string
  closure: RouteClosure | null
  audit: AuditEvent[] | null
}
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

const stateWord = (state: string) => state.charAt(0).toUpperCase() + state.slice(1)

const personName = (s: Snapshot, id: string) =>
  plain(
    must(
      s.users.find((u) => u.id === id),
      `user ${id}`
    ).name
  )

const flagIdIn = (text: string | null) => text?.match(/\b(?:cand|fnd)_\w+/)?.[0] ?? null

const flagTitle = (id: string, s: Snapshot, names: FlagNames) => {
  const candidateId = id.startsWith('fnd_') ? s.findings.find((f) => f.id === id)?.candidateId : id
  return (candidateId === undefined ? undefined : s.metas[candidateId]?.title) ?? names[id] ?? 'Another flag'
}

/** Core's own words name flags by id and tier; this page names them in plain words and never shows a tier. */
function plainStateReason(text: string, s: Snapshot, names: FlagNames) {
  return text
    .replace(
      /Tier\s+2\s+candidate\s+((?:cand|fnd)_\w+)\s+awaiting review/gi,
      (_, id: string) => `Flag "${flagTitle(id, s, names)}" awaiting review`
    )
    .replace(/Tier\s+\d+\s+candidate\s+((?:cand|fnd)_\w+)/gi, (_, id: string) => `Flag "${flagTitle(id, s, names)}"`)
    .replace(/validTo reached/gi, 'Past its valid-to date')
    .replace(/(?:cand|fnd)_\w+/g, (id) => `"${flagTitle(id, s, names)}"`)
    .replace(/\bseg_\w+/g, 'this edge')
    .replace(/\b(?:rt|wo|pass)_\w+/g, 'this record')
    .replace(/Tier\s+\d+\s+candidate/gi, 'Flag')
    .replace(/candidate/gi, 'flag')
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
  const names = useFlagNames(data?.pass?.stateReason ?? null, s)
  useEffect(() => {
    let live = true
    setData(null)
    setError(null)
    const load = async (): Promise<Loaded> => {
      let context
      let pass: EdgePass
      if (passId.startsWith('seg_')) {
        context = await client().getSegment({ params: { id: passId } })
        if (context.segment.passId === null)
          return {
            pass: null,
            segment: context.segment,
            assetName: context.asset.name,
            owner: personName(s, context.asset.custodianUserId),
            closure: null,
            audit: null
          }
        pass = await client().getPass({ params: { id: context.segment.passId } })
      } else {
        pass = await client().getPass({ params: { id: passId } })
        context = await client().getSegment({ params: { id: pass.segmentId } })
      }
      const base = {
        segment: context.segment,
        assetName: context.asset.name,
        owner: personName(s, context.asset.custodianUserId)
      }
      // An explicit `none` record is still no pass: say so instead of inventing a certificate.
      if (pass.state === 'none') return { ...base, pass, closure: null, audit: null }
      // A closure only belongs on a certificate that is still in force.
      const certificate = pass.state === 'valid' || pass.state === 'expiring'
      const [closure, audit] = await Promise.all([
        certificate ? client().previewRouteClosure({ params: { id: pass.segmentId }, body: { remedyIds: [] } }) : null,
        reader ? client().listAudit({}) : null
      ])
      return { ...base, pass, closure, audit }
    }
    load().then(
      (d) => live && setData(d),
      (e) => live && setError(e instanceof Error ? e : new Error(String(e)))
    )
    return () => {
      live = false
    }
  }, [passId, reader, version, s])
  const frame = (context: string, body: React.ReactNode) => (
    <Screen
      title={data?.pass?.state === 'valid' || data?.pass?.state === 'expiring' ? 'Pass issued' : 'Pass details'}
      context={context}
    >
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
        <a className="btn small" href="#/passes">
          Back to Passes
        </a>
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
  const { pass, segment, assetName, owner, closure, audit } = data
  const name = (id: string) => personName(s, id)
  const place = segment.name.includes(assetName) ? segment.name : `${segment.name} · ${assetName}`
  if (!pass || pass.state === 'none') {
    return frame(
      place,
      <div className="pi-grid pi-single">
        <div className="pi-hero">
          <span className="pi-seal not-valid">
            <WarningCircle size={40} weight="bold" aria-hidden="true" />
          </span>
          <h2 className="pi-title">No pass yet</h2>
          <p className="pi-place">{place}</p>
          <p className="pi-badge none">
            <StateMark state="none" />
            No pass yet: unknown
          </p>
          <p className="pi-ways">No safety pass has been issued for this edge. Its state is unknown, never safe.</p>
          <p className="pi-next">
            <b>Next:</b> Send the walk crew to patrol this edge; a pass can be issued after the check passes.
          </p>
          <p className="pi-help">Owner: {owner}</p>
          <div className="pi-actions">
            <a className="btn" href="#/passes">
              Back to Passes
            </a>
          </div>
        </div>
      </div>
    )
  }
  const valid = pass.state === 'valid' || pass.state === 'expiring'
  if (!valid) {
    const flagId = flagIdIn(pass.stateReason)
    const title = flagId === null || names === null ? null : flagTitle(flagId, s, names)
    const next =
      pass.state === 'suspended'
        ? title
          ? `Confirm the flag "${title}" in the Inbox.`
          : 'Review the flag holding this pass in the Inbox.'
        : 'Send the walk crew to check this edge again, then record a new re-test.'
    const timeline = audit ? steps(audit, chain(pass, s)) : null
    return frame(
      place,
      <div className="pi-grid">
        <div className="pi-hero">
          <span className={`pi-seal ${pass.state}`}>
            <WarningCircle size={40} weight="bold" aria-hidden="true" />
          </span>
          <h2 className="pi-title">{stateWord(pass.state)}</h2>
          <p className="pi-place">{place}</p>
          <p className={`pi-badge ${pass.state}`}>
            <StateMark state={pass.state} />
            {stateWord(pass.state)}
            {pass.validTo ? ` · valid to ${date(pass.validTo)}` : ''}
          </p>
          {pass.stateReason && names && <p className="pi-help">{plainStateReason(pass.stateReason, s, names)}</p>}
          <p className="pi-next">
            <b>Next:</b> {next}
          </p>
          <p className="pi-help">Owner: {owner}</p>
          <div className="pi-actions">
            <a className="btn" href="#/passes">
              Back to Passes
            </a>
            <a className="btn" href="#/inbox">
              Back to Inbox
            </a>
          </div>
        </div>
        <Timeline timeline={timeline} name={name} />
      </div>
    )
  }
  const routes = must(closure ?? undefined, 'route coverage of a current pass').routes
  const covered = routes.filter((r) => pass.scope.routeIds.includes(r.id))
  // Only claim a closure for the routes this pass names; a pass issued after a false-alarm check names none.
  const closedCovered = covered.filter((r) => r.status === 'closed')
  const ways =
    covered.length === 0
      ? 'No way to the water is named by this pass.'
      : closedCovered.length < covered.length
        ? `${closedCovered.length} of ${covered.length} ways to the water this pass covers are closed.`
        : covered.length === 1
          ? `The way to the water this pass covers at ${segment.name} is closed.`
          : covered.length === routes.length
            ? `All ${covered.length} ways to the water at ${segment.name} are closed.`
            : `The ${covered.length} ways to the water this pass covers at ${segment.name} are closed.`
  const badge = pass.validTo ? `Valid to ${date(pass.validTo)}` : `Pass ${pass.state}`
  const timeline = audit ? steps(audit, chain(pass, s)) : null
  return frame(
    place,
    <div className="pi-grid">
      <div className="pi-hero">
        <span className="pi-seal valid">
          <ShieldCheck size={40} weight="bold" aria-hidden="true" />
        </span>
        <h2 className="pi-title">Safety pass issued</h2>
        <p className="pi-place">{place}</p>
        <p className={`pi-badge ${pass.state}`}>
          <StateMark state={pass.state} />
          {badge}
        </p>
        {pass.stateReason && names && <p className="pi-help">{certificateReason(pass.stateReason, s, names)}</p>}
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
          <a className="btn" href="#/passes">
            Back to Passes
          </a>
        </div>
      </div>
      <Timeline timeline={timeline} name={name} />
    </div>
  )
}

/** The audit trail card, shared by every pass state so the history does not vanish when a pass changes state. */
function Timeline({ timeline, name }: { timeline: AuditEvent[] | null; name: (id: string) => string }) {
  return (
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
  )
}
