import type { Candidate, CandidateEvidence, ItemStatus, Severity } from '@safe-edge/contracts'
import { SafeEdgeDeniedError } from '@safe-edge/sdk'
import { useEffect, useState } from 'react'
import { HandleRoot, Item, Provider, Root } from 'react-compare-slider/components'
import { useReactCompareSlider } from 'react-compare-slider/hooks'
import { SampleImage, type Box, type Scene } from './scenes'
import { demo, refresh, resetAll, start, useStore, type Snapshot } from './store'

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
const TIER = ['', 'Tier 1 Watch', 'Tier 2 Confirm', 'Tier 3 Field']
const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' }).format(
    new Date(iso)
  ) + ' MYT'

/** A lookup that must succeed: a missing record is a bug in the data flow, so say so instead of showing a fallback. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`)
  return value
}

/** The "Sample" badge comes from the record's own simulated flag; the source says who produced it. */
const Sample = ({ r, source = false }: { r: { simulated: boolean; source: string }; source?: boolean }) => (
  <>
    {r.simulated && <span className="chip sample">Sample</span>}
    {source && <span className="chip plain">Source: {r.source}</span>}
  </>
)

type Labels = Record<string, ItemStatus>

// Blind-first: until the manager picks a label, a Tier 2 card shows nothing the AI concluded, title included.
const isHidden = (c: Candidate, blind: boolean, labels: Labels) =>
  blind && c.tier === 2 && c.status === 'candidate' && !labels[c.id]

export function App() {
  const { snapshot: s, error } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [blind, setBlind] = useState(false)
  const [labels, setLabels] = useState<Labels>({})
  const [resets, setResets] = useState(0)

  useEffect(() => {
    void start()
  }, [])
  if (error) return <p role="alert">The demo could not load: {error.message}</p>
  if (!s) return <p role="status">Loading the sample data</p>

  const manager = must(
    s.users.find((u) => u.id === demo.actor.id),
    `user ${demo.actor.id}`
  )
  const selected = selectedId ? s.evidence.find((e) => e.candidate.id === selectedId) : s.evidence[0]
  if (!selected) throw new Error(`Missing candidate ${selectedId ?? '(the first)'}: the sample layer raised none`)
  const group = (open: boolean) => s.evidence.filter((e) => (e.candidate.status === 'candidate') === open)
  const title = (e: CandidateEvidence) => {
    const meta = must(s.metas[e.candidate.id], `sample details for ${e.candidate.id}`)
    return isHidden(e.candidate, blind, labels) ? `Tier 2 flag: ${meta.viewpointName}` : meta.title
  }

  return (
    <>
      <div className="banner">
        SAMPLE DATA<span>Every image, card and record here is made up for the demo.</span>
      </div>
      <header className="topbar">
        <h1 className="brand">
          Safe Edge <small>Edge Inbox</small>
        </h1>
        <span className="grow" />
        <label className="switch">
          <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} />
          <span className="track" aria-hidden="true" />
          Blind-first mode
        </label>
        <button
          className="btn"
          onClick={async () => {
            await resetAll()
            setSelectedId(null)
            setBlind(false)
            setLabels({})
            setResets((n) => n + 1)
          }}
        >
          Reset demo
        </button>
        <span className="who">
          Signed in as <b>{manager.name}</b>
        </span>
      </header>
      <div className="split">
        <nav className="list" aria-label="Inbox list">
          {([true, false] as const).map((open) => (
            <div key={String(open)}>
              <h2 className="grp">
                {open ? 'Open' : 'Decided'} ({group(open).length})
              </h2>
              {group(open).length === 0 && <p className="empty">{open ? 'Nothing open.' : 'Nothing decided yet.'}</p>}
              <ul aria-label={open ? 'Open' : 'Decided'}>
                {group(open).map((e) => (
                  <li key={e.candidate.id}>
                    <button
                      className={`row t${e.candidate.tier}${open ? '' : ' done'}`}
                      aria-current={e.candidate.id === selected.candidate.id}
                      onClick={() => setSelectedId(e.candidate.id)}
                    >
                      <span className="row-title">{title(e)}</span>
                      <span className="meta">{e.segment.name}</span>
                      {e.candidate.status === 'needs_recapture' && (
                        <span className="meta">{e.candidate.decisionReason}</span>
                      )}
                      <span className="chips">
                        <span className={`chip t${e.candidate.tier}`}>Tier {e.candidate.tier}</span>
                        {!open && <span className="chip ok">{STATE_TEXT[e.candidate.status]}</span>}
                        <Sample r={e.candidate} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <main className="detail">
          <CardDetail
            key={`${selected.candidate.id}-${resets}`}
            e={selected}
            s={s}
            hidden={isHidden(selected.candidate, blind, labels)}
            label={labels[selected.candidate.id]}
            onLabel={(l) => setLabels({ ...labels, [selected.candidate.id]: l })}
            title={title(selected)}
          />
        </main>
      </div>
    </>
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
  const [severity, setSeverity] = useState<Severity>(c.tier === 2 ? 'high' : 'medium')
  const [denied, setDenied] = useState<string | null>(null)

  const finding = s.findings.find((f) => f.candidateId === c.id)
  // Core's tasks name no candidate: an interim task names its finding; the field check was found when it was raised.
  const tasks = s.tasks.filter(
    (t) => (finding && t.findingId === finding.id) || t.id === meta.fieldTaskId || t.candidateId === c.id
  )
  const wo = finding ? s.workOrders.find((w) => w.findingId === finding.id) : undefined

  /** Runs a call as the manager and shows core's refusal (with its rule) instead of failing silently. */
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

  return (
    <>
      <article aria-label={`Card ${c.id}`}>
        <div className="d-head">
          <div>
            <h2>{title}</h2>
            <p className="sub">
              {e.segment.name} ({e.segment.id})
            </p>
            <p className="sub">
              Viewpoint: {meta.viewpointName} ({after.viewpointId})
            </p>
          </div>
          <div className="chips">
            {open && <span className="chip plain">State: Open</span>}
            <span className={`chip t${c.tier}`}>{TIER[c.tier]}</span>
            {c.tier !== 3 && (
              <span className={`chip ${pass.state === 'suspended' ? 'sus' : pass.state === 'valid' ? 'ok' : 'plain'}`}>
                Pass {pass.state}
              </span>
            )}
            <Sample r={c} />
          </div>
        </div>

        {!open && (
          <p className={`state ${c.status === 'confirmed' ? 'ok' : c.status === 'needs_recapture' ? 'warn' : 'bad'}`}>
            {`State: ${STATE_TEXT[c.status]} by ${name(c.decidedBy!)}${
              c.status === 'rejected'
                ? `. Reason: ${c.decisionReason}`
                : c.status === 'needs_recapture'
                  ? `. ${c.decisionReason}`
                  : ''
            }`}
          </p>
        )}

        <div className="evidence">
          <div className="panel">
            <h3>Before and after, same viewpoint</h3>
            <BeforeAfter scene={meta.scene} box={hidden ? null : meta.box} boxName={`Flagged region: ${meta.title}`} />
            <dl className="facts">
              <dt>Captured</dt>
              <dd>{fmt(after.capturedAt)}</dd>
              <dt>Record</dt>
              <dd>
                {c.simulated ? 'Simulated' : 'Real'}, source {c.source}
              </dd>
            </dl>
          </div>
          <div className="panel">
            {c.tier === 3 ? (
              <>
                <h3>What the AI saw</h3>
                <p className="unknown">Not visible: unknown, never a pass</p>
                <p>Nothing could be checked here, so nothing can be confirmed or rejected.</p>
                {tasks
                  .filter((t) => t.kind === 'field_check')
                  .map((t) => (
                    <TaskCard key={t.id} t={t} name={name} />
                  ))}
              </>
            ) : hidden ? (
              <div role="group" aria-labelledby={`blind-${c.id}`} className="hidden-box">
                <p id={`blind-${c.id}`} className="blind-title">
                  Blind-first: pick your own label before the AI suggestion is shown
                </p>
                <div className="radios">
                  {LABELS.map((l) => (
                    <label key={l}>
                      <input type="radio" name={`label-${c.id}`} onChange={() => onLabel(l)} />
                      {LABEL_TEXT[l]}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <h3>Zoom on the flagged item</h3>
                <figure className="crop-fig" aria-label="Zoomed crop">
                  <div className="crop">
                    <SampleImage
                      scene={meta.scene}
                      variant="after"
                      focus={meta.box!}
                      name="Zoomed crop of the flagged region"
                    />
                  </div>
                  <figcaption>Zoomed crop of the flagged region</figcaption>
                </figure>
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
                      <b>{`Your label: ${label.replace('_', ' ')}. ${label === c.itemStatus ? 'Agrees' : 'Differs'} with the AI label.`}</b>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {!hidden && (
          <div className="summary">
            <span className="drafted">Sample summary</span>
            <p>{`Sample summary, not written by the agent: ${meta.summary} Evidence: ${after.id}, ${c.id}.`}</p>
          </div>
        )}
      </article>

      {denied && (
        <p className="state bad" role="alert">
          {denied}
        </p>
      )}

      {open && rejecting && !hidden && (
        <form
          className={`reason${reason.trim() ? ' filled' : ''}`}
          onSubmit={(ev) => {
            ev.preventDefault()
            void run(() => demo.decideCandidate({ params: { id: c.id }, body: { decision: 'reject', reason } }))
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
              Type a reason to enable this.
            </span>
          )}
          <button className="btn danger" type="submit" disabled={!reason.trim()}>
            Submit rejection
          </button>
        </form>
      )}

      {open && (
        <div role="group" aria-label="Decision" className="decide">
          {c.tier !== 3 && (
            <>
              <label className="sev">
                Severity (pre-filled, you can change it)
                <select value={severity} onChange={(ev) => setSeverity(ev.target.value as Severity)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <button
                className="btn primary"
                disabled={hidden}
                onClick={() =>
                  void run(() =>
                    demo.decideCandidate({ params: { id: c.id }, body: { decision: 'confirm', severity } })
                  )
                }
              >
                Confirm
              </button>
              <button className="btn danger" disabled={hidden} onClick={() => setRejecting(true)}>
                Reject
              </button>
            </>
          )}
          <button
            className="btn"
            disabled={hidden}
            onClick={() =>
              void run(() =>
                demo.decideCandidate({
                  params: { id: c.id },
                  body: {
                    decision: 'recapture',
                    reason: `Re-shoot viewpoint: ${meta.viewpointName} (${after.viewpointId})`
                  }
                })
              )
            }
          >
            Recapture
          </button>
          {hidden && <span className="why">Pick your own label first.</span>}
          {c.tier === 3 && <span className="why">Only a recapture is possible: nothing was seen.</span>}
        </div>
      )}

      <div className="records">
        {finding && (
          <section className="rec" aria-label={`Finding ${finding.id}`}>
            <div className="chips">
              <Sample r={finding} source />
              <span className="chip t2">{finding.status}</span>
            </div>
            <h3>Finding</h3>
            <p>
              ID {finding.id}. Status: {finding.status}. Severity: {finding.severity}. Owner:{' '}
              {name(finding.custodianUserId)}. Confirmed by {name(finding.confirmedBy)}.
            </p>
          </section>
        )}
        {tasks
          .filter((t) => t.kind === 'interim_protection' || t.kind === 'recapture')
          .map((t) => (
            <TaskCard key={t.id} t={t} name={name} />
          ))}
        {wo && finding && (
          <WorkOrderPanel key={`${wo.id}-${wo.status}-${wo.notes}`} wo={wo} finding={finding} s={s} run={run} />
        )}
      </div>
    </>
  )
}

function BeforeAfter({ scene, box, boxName }: { scene: Scene; box: Box | null; boxName: string }) {
  const slider = useReactCompareSlider({ defaultPosition: 38 })
  return (
    <Provider {...slider}>
      <div className="cmp">
        <span className="lab l">Before</span>
        <span className="lab r">After</span>
        <Root>
          <Item item="itemOne">
            <SampleImage scene={scene} variant="before" />
          </Item>
          <Item item="itemTwo">
            <div className="after-wrap">
              <SampleImage scene={scene} variant="after" tagRight />
              {box && (
                <div
                  role="img"
                  aria-label={boxName}
                  className="ovl"
                  style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                />
              )}
            </div>
          </Item>
          <HandleRoot aria-label="Compare before and after: move the divider with the arrow keys">
            <span className="rcs-line" />
            <span className="knob" aria-hidden="true">
              &lt;&gt;
            </span>
          </HandleRoot>
        </Root>
      </div>
    </Provider>
  )
}

type Task = Snapshot['tasks'][number]

function TaskCard({ t, name }: { t: Task; name: (id: string) => string }) {
  const title = {
    interim_protection: 'Interim protection task',
    field_check: 'Field check task',
    recapture: 'Recapture task'
  }[t.kind]
  return (
    <section className="rec" aria-label={`Task ${t.id}`}>
      <div className="chips">
        <Sample r={t} source />
        <span className="chip t2">{t.status}</span>
      </div>
      <h3>{title}</h3>
      <p>{t.reason}</p>
      <p>
        Status: {t.status}. ID {t.id}.{t.assigneeUserId && ` Assigned to ${name(t.assigneeUserId)}.`}
      </p>
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
        <Sample r={wo} source />
        <span className="chip t1">{wo.status}</span>
        <span className={wo.draftedBy.type === 'agent' ? 'drafted' : 'chip plain'}>
          Drafted by {nameOf(wo.draftedBy.id)}
        </span>
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
                if (notes !== wo.notes) await demo.updateWorkOrder({ params: { id: wo.id }, body: { notes } })
                await demo.submitWorkOrder({
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
              onClick={() => void run(() => demo.updateWorkOrder({ params: { id: wo.id }, body: { notes } }))}
            >
              Save text
            </button>
          )}
        </>
      ) : (
        <pre>{wo.notes}</pre>
      )}
    </section>
  )
}
