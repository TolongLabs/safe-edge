import type { Candidate, CandidateEvidence, EdgePass, ItemStatus, Severity } from '@safe-edge/contracts'
import { SafeEdgeDeniedError } from '@safe-edge/sdk'
import { CheckCircle, Info, LockSimple, Robot, Tray, Warning, XCircle } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { CloseUp, closeUp, outlinesBaseline, SampleImage, type Box, type Scene } from '../../scenes'
import { AgentByline, AgentProblemLine, NeedsKey, useAgentRun } from '../shared/AgentRun'
import { Screen } from '../../shell/Shell'
import { onReset, refresh, rememberDone, useSignedIn, useStore, can, type Snapshot } from '../../store'
import './inbox.css'

const LABELS: ItemStatus[] = ['present', 'missing', 'changed', 'not_visible']
const LABEL_TEXT: Record<ItemStatus, string> = {
  present: 'Present',
  missing: 'Missing',
  changed: 'Changed',
  not_visible: 'Not visible'
}
const STATE_TEXT = {
  candidate: 'Open',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  needs_recapture: 'Needs recapture'
} as const
// Core's uncertainty is how unsure the AI is; the card shows how sure it is.
const SURE = { low: 'high', medium: 'medium', high: 'low' } as const

// Every date and time the Inbox shows is Malaysian time, whatever the machine's zone.
const KL = 'Asia/Kuala_Lumpur'
const intl = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...o, timeZone: KL })
const fmt = (iso: string) => intl({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) + ' MYT'
const dayMonth = (iso: string) => intl({ day: 'numeric', month: 'short' }).format(new Date(iso))
const dayMonthYear = (iso: string) => intl({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
const weekdayDate = (iso: string) => intl({ weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso))
const clock = (iso: string) => intl({ hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

/** A lookup that must succeed: a missing record is a bug in the data flow, so say so instead of showing a fallback. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`)
  return value
}

/** Who produced the record. */
const Source = ({ r }: { r: { source: string } }) => <span className="chip">Source: {r.source}</span>

/** The five pass shapes of DESIGN.md: filled dot, half ring, slashed ring, square, hollow ring. */
export function StateMark({ state }: { state: EdgePass['state'] }) {
  const shape = {
    valid: <circle cx="9" cy="9" r="6" fill="currentColor" />,
    expiring: (
      <>
        <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M9 3.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
      </>
    ),
    suspended: <rect x="3" y="3" width="12" height="12" rx="1" fill="currentColor" />,
    expired: (
      <>
        <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M4 14L14 4" stroke="currentColor" strokeWidth="2" />
      </>
    ),
    none: <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
  }[state]
  return (
    <svg className={`mark ${state}`} viewBox="0 0 18 18" aria-hidden="true">
      {shape}
    </svg>
  )
}

/** What the pass means for this fence, in words; unknown is never worded as a pass. */
function passSentence(p: EdgePass) {
  const to = p.validTo ? dayMonthYear(p.validTo) : null
  switch (p.state) {
    case 'suspended':
      return 'The safety pass for this fence is paused until it is fixed'
    case 'valid':
      return `A safety pass is in force for this fence${to ? `, valid to ${to}` : ''}`
    case 'expiring':
      return `The safety pass ends${to ? ` on ${to}` : ' soon'}`
    case 'expired':
      return `The safety pass ran out${to ? ` on ${to}` : ''}`
    case 'none':
      return 'No pass yet for this fence: unknown'
  }
}

type Labels = Record<string, ItemStatus>

const isMachineGuess = (c: Candidate, users: Snapshot['users']) => {
  if (c.tier !== 1 && c.tier !== 2) return false
  if (c.raisedBy.type === 'agent' || c.raisedBy.type === 'provider') return true
  if (c.raisedBy.type === 'user') {
    const u = users.find((user) => user.id === c.raisedBy.id)
    return u?.role === 'provider'
  }
  return false
}

// In blind-first mode, every AI conclusion for machine tier 1/2 is hidden regardless of status or manager labels.
const isHidden = (c: Candidate, blind: boolean, users: Snapshot['users']) => blind && isMachineGuess(c, users)

/** The segment number from its name ("... segment 12"), for the code plate; nothing is made up when there is none. */
const segmentCode = (name: string) => {
  const n = /segment (\d+)/i.exec(name)?.[1]
  return n ? `S${n}` : null
}

/** "drone", "phone" or "drone and phone", from the observations' own capture sources. */
const sourcesOf = (evidence: CandidateEvidence[]) =>
  [...new Set(evidence.flatMap((e) => e.observations.map((o) => o.captureSource)))].sort().join(' and ')

export function Inbox() {
  const { snapshot: s } = useStore()
  if (!s) throw new Error('The Inbox renders only after the demo data loaded')
  return can('listCandidates') ? <Triage s={s} /> : <OtherRoles s={s} />
}

/** Someone who may not triage: the open tasks and work orders they can see, and who does the triage. */
function OtherRoles({ s }: { s: Snapshot }) {
  const { run, denied } = useRun()
  const finished = (wo: Snapshot['workOrders'][number]) => wo.status === 'completed' || wo.status === 'accepted'
  const openTasks = s.tasks.filter((t) => t.status === 'open')
  const openOrders = s.workOrders.filter((w) => !finished(w))
  const doneTasks = s.tasks.filter((t) => t.status === 'done')
  const doneOrders = s.workOrders.filter(finished)
  const orderCard = (wo: Snapshot['workOrders'][number]) => (
    <section className="rec" aria-label={`Work order ${wo.id}`} key={wo.id}>
      <div className="chips">
        <Source r={wo} />
        <span className="chip">{wo.status}</span>
      </div>
      <h3>Work order</h3>
      <p>
        ID {wo.id}. Status: {wo.status}.
      </p>
      {wo.status !== 'draft' && (
        <a className="btn" href={`#/retest/${wo.id}`}>
          Open the repair check
        </a>
      )}
    </section>
  )
  return (
    <Screen
      title="Inbox"
      context={`${openTasks.length} open ${openTasks.length === 1 ? 'task' : 'tasks'} · ${openOrders.length} open work ${openOrders.length === 1 ? 'order' : 'orders'}`}
    >
      <div className="work">
        <nav className="list island" aria-label="Inbox list">
          <div className="list-head">
            <h2>To review</h2>
          </div>
          <p className="banner info">
            <LockSimple size={20} weight="bold" aria-hidden="true" />
            <span>
              <b>Candidate triage is the park manager&apos;s step</b>
            </span>
          </p>
        </nav>
        <main className="detail island">
          <div className="d-head">
            <h2>Your open work</h2>
            <p className="sub">Tasks and work orders you can see.</p>
          </div>
          {denied && (
            <p className="state bad" role="alert">
              {denied}
            </p>
          )}
          <div className="records stack">
            {s.tasks.length === 0 && s.workOrders.length === 0 && (
              <div className="empty-state">
                <Tray size={24} weight="bold" aria-hidden="true" />
                <h3>No tasks or work orders yet</h3>
                <p>They appear after the park manager confirms a flag.</p>
              </div>
            )}
            {openTasks.map((t) => (
              <TaskCard key={t.id} t={t} s={s} run={run} />
            ))}
            {openOrders.map(orderCard)}
          </div>
          {(doneTasks.length > 0 || doneOrders.length > 0) && (
            <>
              <h3 className="grp">Done</h3>
              <div className="records stack">
                {doneTasks.map((t) => (
                  <TaskCard key={t.id} t={t} s={s} run={run} />
                ))}
                {doneOrders.map(orderCard)}
              </div>
            </>
          )}
        </main>
      </div>
    </Screen>
  )
}

function Triage({ s }: { s: Snapshot }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [blind, setBlind] = useState(false)
  const [labels, setLabels] = useState<Labels>({})
  const [resets, setResets] = useState(0)

  useEffect(
    () =>
      onReset(() => {
        setSelectedId(null)
        setBlind(false)
        setLabels({})
        setResets((n) => n + 1)
      }),
    []
  )
  const selected = selectedId ? s.evidence.find((e) => e.candidate.id === selectedId) : s.evidence[0]
  if (!selected) throw new Error(`Missing candidate ${selectedId ?? '(the first)'}: the sample layer raised none`)
  const group = (open: boolean) => s.evidence.filter((e) => (e.candidate.status === 'candidate') === open)
  const cardTitle = (e: CandidateEvidence) => {
    const meta = must(s.metas[e.candidate.id], `sample details for ${e.candidate.id}`)
    return isHidden(e.candidate, blind, s.users) ? meta.viewpointName : meta.title
  }
  const rowTitle = (e: CandidateEvidence) => {
    const meta = must(s.metas[e.candidate.id], `sample details for ${e.candidate.id}`)
    return meta.viewpointName
  }
  const firstSeen = s.evidence
    .flatMap((e) => e.observations.map((o) => o.capturedAt))
    .sort()
    .at(0)
  const patrol = firstSeen ? `${dayMonth(firstSeen)} ${sourcesOf(s.evidence)} images` : null
  const unknown = s.evidence.filter((e) => e.candidate.itemStatus === 'not_visible').length

  const context = firstSeen
    ? `${weekdayDate(firstSeen)} · ${s.evidence.length} ${s.evidence.length === 1 ? 'change' : 'changes'} from ${sourcesOf(s.evidence)} images`
    : undefined
  const blindSwitch = (
    <label className="switch">
      <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} />
      <span className="track" aria-hidden="true" />
      Blind-first mode
    </label>
  )

  return (
    <Screen title="Inbox" context={context} actions={blindSwitch}>
      <div className="work">
        <nav className="list island" aria-label="Inbox list">
          <div className="list-head">
            <h2>To review · {group(true).length}</h2>
            {patrol && <p>From the {patrol}</p>}
          </div>
          {([true, false] as const).map((open) => (
            <div key={String(open)}>
              {!open && <h2 className="grp">Decided · {group(false).length}</h2>}
              {open && group(true).length === 0 && (
                <div className="empty-state">
                  <Tray size={24} weight="bold" aria-hidden="true" />
                  <h3>No changes to review{patrol ? ` from the ${patrol}` : ''}</h3>
                  <p>
                    {unknown > 0
                      ? `${unknown} ${unknown === 1 ? 'spot the drone could not see stays' : 'spots the drone could not see stay'} unknown`
                      : 'The drone saw every spot in these images. That is not a safety pass.'}
                  </p>
                </div>
              )}
              {!open && group(false).length === 0 && <p className="empty">Nothing decided yet.</p>}
              <ul aria-label={open ? 'Open' : 'Decided'}>
                {group(open).map((e) => (
                  <li key={e.candidate.id}>
                    <button
                      className={`row${open ? '' : ' done'}`}
                      aria-current={e.candidate.id === selected.candidate.id}
                      onClick={() => setSelectedId(e.candidate.id)}
                    >
                      <span className="row-title">{rowTitle(e)}</span>
                      <span className="time">
                        {clock(must(e.observations[0], `observation of ${e.candidate.id}`).capturedAt)}
                      </span>
                      <span className="meta clamp">{e.segment.name}</span>
                      {!open && <span className="meta wide">{STATE_TEXT[e.candidate.status]}</span>}
                      {e.candidate.status === 'needs_recapture' && (
                        <span className="meta wide clamp">{e.candidate.decisionReason}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <main className="detail island">
          <CardDetail
            key={`${selected.candidate.id}-${resets}`}
            e={selected}
            s={s}
            hidden={isHidden(selected.candidate, blind, s.users)}
            label={labels[selected.candidate.id]}
            onLabel={(l) => setLabels({ ...labels, [selected.candidate.id]: l })}
            title={cardTitle(selected)}
          />
        </main>
      </div>
    </Screen>
  )
}

/** Runs a call as the signed-in person and shows core's refusal (with its rule) instead of failing silently. */
function useRun() {
  const [denied, setDenied] = useState<string | null>(null)
  const run = async (call: () => Promise<unknown>) => {
    setDenied(null)
    try {
      await call()
    } catch (error) {
      if (!(error instanceof SafeEdgeDeniedError)) throw error
      setDenied(`Core refused this (${error.rule}): ${error.message}`)
    }
    await refresh()
  }
  return { run, denied }
}

/** The dashed red outline and tag of a flagged region, `box` in percent of the image under it. */
function FlagOutline({ box, title, tagAbove = false }: { box: Box; title: string; tagAbove?: boolean }) {
  return (
    <div
      role="img"
      aria-label={`Flagged region: ${title}`}
      className={`ovl${tagAbove ? ' tag-above' : ''}`}
      style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
    >
      <span className="tag">{title}</span>
    </div>
  )
}

/**
 * The after image close up on the flagged region, with what the baseline shows there drawn faint and dotted. One
 * close-up with the outline reads at the panel's 280 px; a before and after pair would halve it, a fence panel to a
 * few pixels.
 */
function Zoom({
  scene,
  box,
  title,
  baseline
}: {
  scene: Scene
  box: Box
  title: string
  baseline: CandidateEvidence['baseline']
}) {
  const outlined = baseline !== null && outlinesBaseline(scene)
  const { region } = closeUp(box)
  return (
    <figure className="frame-photo crop-fig">
      <div className="after-wrap">
        <CloseUp scene={scene} box={box} baseline={outlined} name={`Close-up of the flagged region: ${title}`} />
        {/* Named by the close-up itself, so the after image keeps the one "Flagged region" image of the card. */}
        <div aria-hidden="true">
          <FlagOutline box={region} title={title} tagAbove={region.y + region.h > 86 && region.y >= 15} />
        </div>
      </div>
      <figcaption>
        <b className="legend">
          {outlined && (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2" y="2" width="12" height="12" />
            </svg>
          )}
          {baseline === null
            ? 'No baseline recorded to compare'
            : outlined
              ? `Dotted: as in the ${dayMonth(baseline.capturedAt)} baseline`
              : `Not in the ${dayMonth(baseline.capturedAt)} baseline`}
        </b>
      </figcaption>
    </figure>
  )
}

function CardDetail({
  e,
  s,
  hidden,
  label,
  onLabel,
  title
}: {
  e: CandidateEvidence
  s: Snapshot
  hidden: boolean
  label: ItemStatus | undefined
  onLabel: (l: ItemStatus) => void
  title: string
}) {
  const c = e.candidate
  const meta = must(s.metas[c.id], `sample details for ${c.id}`)
  const after = must(e.observations[0], `observation of ${c.id}`)
  const name = (id: string) =>
    must(
      s.users.find((u) => u.id === id),
      `user ${id}`
    ).name
  const pass = must(
    s.passes.find((p) => p.segmentId === c.segmentId),
    `pass of ${c.segmentId}`
  )
  const open = c.status === 'candidate'
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | null>(null)
  const severityPicked = selectedSeverity !== null
  const effectiveSeverity: Severity | null =
    selectedSeverity !== null ? selectedSeverity : hidden ? null : c.tier === 2 ? 'high' : 'medium'
  const { client } = useSignedIn()
  const { run, denied } = useRun()
  const agent = useAgentRun()

  const finding = s.findings.find((f) => f.candidateId === c.id)
  // Core's tasks name no candidate: an interim task names its finding; the field check was found when it was raised.
  const tasks = s.tasks.filter(
    (t) => (finding && t.findingId === finding.id) || t.id === meta.fieldTaskId || t.candidateId === c.id
  )
  const wo = finding ? s.workOrders.find((w) => w.findingId === finding.id) : undefined

  const code = segmentCode(e.segment.name)
  const sure = c.uncertainty ? SURE[c.uncertainty] : null
  const baseline = e.baseline
  const box = hidden ? null : meta.box
  // The agent may summarise a card awaiting a decision; blind-first keeps it away like every other AI conclusion.
  const summarise = open && !hidden && can('draftInbox')
  const keyHint = `agent-key-${c.id}`

  return (
    <>
      <article aria-label={`Card ${c.id}`}>
        <div className="d-head">
          <h2>{title}</h2>
          <p className="sub">
            <span>{e.segment.name}</span>
            {code && (
              <span className="plate">
                <span aria-hidden="true">{code}</span>
                <span className="sr">Segment {e.segment.id}</span>
              </span>
            )}
            {c.tier === 3 ? (
              <span className="chip">
                <StateMark state="none" />
                Unknown: nothing was seen
              </span>
            ) : (
              sure && !hidden && <span className="chip">How sure: {sure}</span>
            )}
          </p>
          <p className="sub">
            Viewpoint: {meta.viewpointName} ({after.viewpointId})
          </p>
        </div>

        {!open && (
          <p
            className={`state ${c.status === 'confirmed' ? 'ok' : c.status === 'needs_recapture' ? 'warn' : 'neutral'}`}
          >
            {c.status === 'confirmed' ? (
              <CheckCircle size={20} weight="bold" aria-hidden="true" />
            ) : c.status === 'needs_recapture' ? (
              <Warning size={20} weight="bold" aria-hidden="true" />
            ) : (
              <XCircle size={20} weight="bold" aria-hidden="true" />
            )}
            {`${STATE_TEXT[c.status]} by ${name(c.decidedBy!)}${
              c.status === 'rejected'
                ? `. Reason: ${c.decisionReason}`
                : c.status === 'needs_recapture'
                  ? `. ${c.decisionReason}`
                  : ''
            }`}
          </p>
        )}

        <div className="frames">
          <figure className="frame-photo">
            <SampleImage scene={meta.scene} variant="before" />
            <figcaption>
              <div className="cap-line">
                <b>{baseline ? `Before · ${dayMonth(baseline.capturedAt)}` : 'Before · no baseline recorded'}</b>
                <span>
                  {baseline?.acceptedBy ? `Accepted by ${name(baseline.acceptedBy)}` : 'Not accepted by a person'}
                </span>
              </div>
            </figcaption>
          </figure>
          <figure className="frame-photo">
            <div className="after-wrap">
              <SampleImage scene={meta.scene} variant="after" />
              {box && <FlagOutline box={box} title={meta.title} />}
            </div>
            <figcaption>
              <div className="cap-line">
                <b>{fmt(after.capturedAt)}</b>
                <span>{after.captureSource === 'drone' ? 'Drone' : 'Phone'}</span>
              </div>
            </figcaption>
          </figure>
        </div>

        {c.tier === 3 && (
          <p className="banner info">
            <Info size={20} weight="bold" aria-hidden="true" />
            <span>
              <b>Not visible: unknown, never a pass.</b> A person must check this spot on site.
            </span>
          </p>
        )}
        {!hidden && (c.agentSummary || c.tier !== 3 || summarise) && (
          <div className="summary">
            {c.agentSummary ? (
              <>
                <p className="why-text">{c.agentSummary.text}</p>
                <AgentByline model={c.agentSummary.model} citations={c.agentSummary.citations} />
              </>
            ) : (
              c.tier !== 3 && (
                <p className="why-text">{`Sample summary, not written by the agent: ${meta.summary} Evidence: ${after.id}, ${c.id}.`}</p>
              )
            )}
            {summarise && (
              <div className="summarise">
                <button
                  className="btn"
                  disabled={!agent.ready || agent.busy}
                  aria-describedby={agent.ready ? undefined : keyHint}
                  onClick={async () => {
                    const done = await agent.run((a, signal) => a.draftInbox(c, finding ?? null, signal))
                    // Core emits no event when it stores a summary, so the card reads it back itself.
                    if (done) await refresh()
                  }}
                >
                  <Robot size={20} weight="bold" aria-hidden="true" />
                  {agent.busy ? 'Summarising…' : 'Summarise with the agent'}
                </button>
                {agent.busy && (
                  <button className="btn" onClick={agent.stop}>
                    Stop
                  </button>
                )}
              </div>
            )}
            {summarise && !agent.ready && <NeedsKey id={keyHint} />}
            {agent.problem && <AgentProblemLine problem={agent.problem} />}
          </div>
        )}
        {c.tier !== 3 && (
          <p className="passline">
            <StateMark state={pass.state} />
            <span>{passSentence(pass)}</span>
          </p>
        )}

        <div className="panel">
          {c.tier === 3 ? (
            <>
              <h3>What the AI saw</h3>
              <p>Nothing could be checked here, so nothing can be confirmed or rejected.</p>
              {tasks
                .filter((t) => t.kind === 'field_check')
                .map((t) => (
                  <TaskCard key={t.id} t={t} s={s} run={run} />
                ))}
            </>
          ) : hidden ? (
            <div role="group" aria-labelledby={`blind-${c.id}`} className="hidden-box">
              {!open ? (
                <>
                  <p id={`blind-${c.id}`} className="blind-title">
                    AI answer hidden while blind mode is on
                  </p>
                  {label && <p className="blind-title">Your label: {label.replace('_', ' ')}</p>}
                </>
              ) : !label ? (
                <>
                  <p id={`blind-${c.id}`} className="blind-title">
                    Pick your own label. The AI answer stays hidden while blind mode is on.
                  </p>
                  <div className="radios">
                    {LABELS.map((l) => (
                      <label key={l}>
                        <input type="radio" name={`label-${c.id}`} onChange={() => onLabel(l)} />
                        {LABEL_TEXT[l]}
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p id={`blind-${c.id}`} className="blind-title">
                    AI answer hidden while blind mode is on
                  </p>
                  <p className="blind-title">Your label: {label.replace('_', ' ')}</p>
                </>
              )}
            </div>
          ) : (
            <>
              <h3>Zoom on the flagged item</h3>
              <div className="ai-panel">
                <Zoom
                  scene={meta.scene}
                  box={must(meta.box ?? undefined, `flagged region of ${c.id}`)}
                  title={meta.title}
                  baseline={baseline}
                />
                <div className="ai-box">
                  <p className="label">AI suggestion, unvalidated</p>
                  <p className="big">AI label: {c.itemStatus?.replace('_', ' ') ?? 'general change'}</p>
                  <p>AI confidence {Math.round(c.score * 100)}%</p>
                  <div className="bar" aria-hidden="true">
                    <i style={{ width: `${Math.round(c.score * 100)}%` }} />
                  </div>
                  <p>Uncertainty: {c.uncertainty}</p>
                  <p>Reason: {c.rationale}</p>
                  {label && (
                    <p>
                      <b>{`Your label: ${label.replace('_', ' ')}. The AI said ${c.itemStatus?.replace('_', ' ') ?? 'general change'}.`}</b>
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
          <dl className="facts">
            <dt>Captured</dt>
            <dd>{fmt(after.capturedAt)}</dd>
            <dt>Source</dt>
            <dd>{c.source}</dd>
          </dl>
        </div>
      </article>

      {denied && (
        <p className="state bad" role="alert">
          {denied}
        </p>
      )}

      <div className="records">
        {finding && (
          <section className="rec" aria-label={`Finding ${finding.id}`}>
            <div className="chips">
              <Source r={finding} />
              <span className="chip">{finding.status}</span>
            </div>
            <h3>Finding</h3>
            <p>
              ID {finding.id}. Status: {finding.status}. Severity: {finding.severity}. Owner:{' '}
              {name(finding.custodianUserId)}. Confirmed by {name(finding.confirmedBy)}.
            </p>
            <a className="btn" href={`#/fix-lens/${finding.id}`}>
              Choose a fix
            </a>
          </section>
        )}
        {tasks
          .filter((t) => t.kind === 'interim_protection' || t.kind === 'recapture')
          .filter((t) => !hidden || t.kind === 'recapture')
          .map((t) => (
            <TaskCard key={t.id} t={t} s={s} run={run} />
          ))}
        {!hidden && wo && finding && (
          <WorkOrderPanel key={`${wo.id}-${wo.status}-${wo.notes}`} wo={wo} finding={finding} s={s} run={run} />
        )}
      </div>

      {open && rejecting && (!hidden || !!label) && (
        <form
          className={`reason${reason.trim() ? '' : ' empty'}`}
          onSubmit={(ev) => {
            ev.preventDefault()
            void run(() => client.decideCandidate({ params: { id: c.id }, body: { decision: 'reject', reason } })).then(
              () =>
                // The rejected banner sits at the top; the form that scrolled the pane is gone.
                document.querySelector('main')?.scrollTo({ top: 0 })
            )
          }}
        >
          <label>
            Reason for rejecting
            <textarea
              autoFocus
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              aria-describedby="reject-hint"
            />
          </label>
          {!reason.trim() && (
            <span className="err" id="reject-hint">
              <Warning size={16} weight="bold" aria-hidden="true" />
              Type a reason to enable this.
            </span>
          )}
          <div className="actions">
            <button className="btn danger" type="submit" disabled={!reason.trim()}>
              Submit rejection
            </button>
            <button className="btn" type="button" onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {open && (
        <div role="group" aria-label="Decision" className="decide">
          {c.tier !== 3 && (
            <>
              <label className="sev">
                Severity
                {!hidden && !severityPicked && (
                  <span>
                    {' '}
                    (pre-filled<span className="sr">, you can change it</span>)
                  </span>
                )}
                <select
                  value={effectiveSeverity ?? ''}
                  onChange={(ev) => {
                    setSelectedSeverity(ev.target.value as Severity)
                  }}
                >
                  {effectiveSeverity === null && <option value="" disabled hidden />}
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <button
                className="btn primary"
                disabled={hidden ? !label || effectiveSeverity === null : false}
                onClick={() =>
                  void run(() =>
                    client.decideCandidate({
                      params: { id: c.id },
                      body: { decision: 'confirm', severity: effectiveSeverity! }
                    })
                  )
                }
              >
                Confirm: needs a fix
              </button>
              {hidden && !label && <span className="hint">Pick your own label first.</span>}
              {hidden && label && effectiveSeverity === null && (
                <span className="hint">Pick a severity to confirm.</span>
              )}
            </>
          )}
          <button
            className="btn"
            disabled={hidden && !label}
            onClick={() =>
              void run(() =>
                client.decideCandidate({
                  params: { id: c.id },
                  body: {
                    decision: 'recapture',
                    reason: `Re-shoot viewpoint: ${meta.viewpointName} (${after.viewpointId})`
                  }
                })
              )
            }
          >
            Look again
          </button>
          {c.tier !== 3 && (
            <button className="btn danger apart" disabled={hidden && !label} onClick={() => setRejecting(true)}>
              Not a problem
            </button>
          )}
          {c.tier === 3 && <span className="hint">Only a recapture is possible: nothing was seen.</span>}
        </div>
      )}
    </>
  )
}

type Task = Snapshot['tasks'][number]

function TaskCard({ t, s, run }: { t: Task; s: Snapshot; run: (call: () => Promise<unknown>) => Promise<void> }) {
  const { client } = useSignedIn()
  const name = (id: string) =>
    must(
      s.users.find((u) => u.id === id),
      `user ${id}`
    ).name
  const title = {
    interim_protection: 'Interim protection task',
    field_check: 'Field check task',
    recapture: 'Recapture task'
  }[t.kind]
  const by = s.doneBy[t.id]
  return (
    <section className="rec" aria-label={`Task ${t.id}`}>
      <div className="chips">
        <Source r={t} />
        <span className="chip">{t.status}</span>
      </div>
      <h3>{title}</h3>
      <p>{t.reason}</p>
      <p>
        Status: {t.status}. ID {t.id}.{t.assigneeUserId && ` Assigned to ${name(t.assigneeUserId)}.`}
      </p>
      {t.kind === 'interim_protection' &&
        (t.status === 'done' ? (
          <p className="state ok">
            <CheckCircle size={20} weight="bold" aria-hidden="true" />
            {by ? `Marked done by ${by}` : 'Marked done'}
          </p>
        ) : can('completeTask') ? (
          <button
            className="btn primary"
            onClick={() =>
              void run(async () => {
                await client.completeTask({ params: { id: t.id } })
                rememberDone(t.id, name(client.actor.id))
              })
            }
          >
            Mark done
          </button>
        ) : (
          <p className="banner info">
            <LockSimple size={20} weight="bold" aria-hidden="true" />
            <span>The park manager, walk crew or installer marks this done</span>
          </p>
        ))}
    </section>
  )
}

function WorkOrderPanel({
  wo,
  finding,
  s,
  run
}: {
  wo: Snapshot['workOrders'][number]
  finding: Snapshot['findings'][number]
  s: Snapshot
  run: (call: () => Promise<unknown>) => Promise<void>
}) {
  const { client } = useSignedIn()
  const [notes, setNotes] = useState(wo.notes)
  const installers = s.users.filter((u) => u.role === 'installer')
  const firstInstaller = installers[0]
  if (!firstInstaller) throw new Error('The seed has no installer user')
  const [installer, setInstaller] = useState(firstInstaller.id)
  const [due, setDue] = useState(() => new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10))
  const nameOf = (id: string) =>
    must(
      s.users.find((u) => u.id === id),
      `user ${id}`
    ).name
  // What core requires before a manager can submit (work.ts submitWorkOrder); no button does another person's step.
  const missing = [
    wo.remedyId === null && 'Needs a repair approved by the engineer in Fix Lens (#81).',
    finding.status !== 'interim_protected' &&
      finding.status !== 'reopened' &&
      'Interim protection is not done yet (the crew completes that task).',
    !notes.trim() && 'Add work order text.'
  ].filter((m): m is string => m !== false)

  return (
    <section className="rec" aria-label={`Work order ${wo.id}`}>
      <div className="chips">
        <Source r={wo} />
        <span className="chip">{wo.status}</span>
        <span className={wo.draftedBy.type === 'agent' ? 'drafted' : 'chip'}>Drafted by {nameOf(wo.draftedBy.id)}</span>
      </div>
      <h3>Work order</h3>
      <p>
        ID {wo.id}. Status: {wo.status}. Drafted by {nameOf(wo.draftedBy.id)}
        {wo.draftedBy.type === 'agent' && ' (agent)'}.{wo.submittedBy && ` Submitted by ${nameOf(wo.submittedBy)}.`}
      </p>
      {wo.status === 'draft' ? (
        <>
          <label>
            Work order text <textarea value={notes} onChange={(ev) => setNotes(ev.target.value)} />
          </label>
          <label>
            Installer
            <select value={installer} onChange={(ev) => setInstaller(ev.target.value)}>
              {installers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input type="date" value={due} onChange={(ev) => setDue(ev.target.value)} />
          </label>
          <button
            className="btn primary"
            disabled={missing.length > 0}
            aria-describedby={`missing-${wo.id}`}
            onClick={() =>
              void run(async () => {
                if (notes !== wo.notes) await client.updateWorkOrder({ params: { id: wo.id }, body: { notes } })
                await client.submitWorkOrder({
                  params: { id: wo.id },
                  body: { installerUserId: installer, dueAt: `${due}T09:00:00.000Z` }
                })
              })
            }
          >
            Submit work order
          </button>
          {missing.length > 0 && (
            <ul id={`missing-${wo.id}`} className="missing">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {missing.length === 0 && (
            <p className="note">
              Core checks the engineer&apos;s approval of the repair when you submit, and shows its answer here.
            </p>
          )}
          {notes !== wo.notes && (
            <button
              className="btn"
              onClick={() => void run(() => client.updateWorkOrder({ params: { id: wo.id }, body: { notes } }))}
            >
              Save text
            </button>
          )}
        </>
      ) : (
        <>
          <pre>{wo.notes}</pre>
          <a className="btn" href={`#/retest/${wo.id}`}>
            Open the repair check
          </a>
        </>
      )}
    </section>
  )
}
