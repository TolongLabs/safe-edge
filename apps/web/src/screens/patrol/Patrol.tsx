import { CheckCircle, Drone, LockSimple, Warning, WarningCircle } from '@phosphor-icons/react'
import {
  CreatePatrolPlanRequest,
  type ContextSnapshot,
  type Dock,
  type DroneProfile,
  type Patrol as PatrolRecord,
  type PatrolPlan,
  type PlanHold,
  type ReplanTrigger,
  type Segment
} from '@safe-edge/contracts'
import { PRIORITY_WEIGHTS, SEPARATION_M } from '@safe-edge/planner'
import { elminaScenarios } from '@safe-edge/sdk'
import { useState } from 'react'
import { Screen } from '../../shell/Shell'
import { can, client, loadPatrolPlanner, useSignedIn, useStore } from '../../store'
import { CodeBlock } from '../shared/CodeBlock'
import { fmt, peopleWho, useAction, useCoreRead } from '../shared/core'
import './patrol.css'

type Data = {
  plans: PatrolPlan[]
  patrols: PatrolRecord[]
  segments: Segment[]
  docks: Dock[]
  drones: DroneProfile[]
}

/** Everything the screen shows, read from core as the signed-in person. */
const readPatrol = async (): Promise<Data> => {
  const me = client()
  const [plans, patrols, segments, docks, drones] = await Promise.all([
    me.listPatrolPlans(),
    me.listPatrols(),
    me.listSegments(),
    me.listDocks(),
    me.listDroneProfiles()
  ])
  // Newest first: a re-plan comes after the plan it replaces.
  return { plans: [...plans].reverse(), patrols, segments, docks, drones }
}

/** S1's own plan request from `data/elmina/scenarios/`: its segments, dock, drone and simulated readings. */
const S1 = (() => {
  const scenario = elminaScenarios.find((s) => s.id === 's1')
  const event = scenario?.events.find((e) => e.operationId === 'createPatrolPlan')
  if (!scenario || !event) throw new Error('Scenario S1 has no createPatrolPlan event')
  return { title: scenario.title, body: CreatePatrolPlanRequest.parse(event.input.body) }
})()

const WINDOW_REASON = {
  first_light: 'first light',
  next_dry_window: 'the next dry window',
  requested: 'the time asked for'
} as const
const HOLD_KIND = { weather: 'Weather', lightning: 'Lightning', separation: 'Separation' } as const
/** Core writes the times inside a reason as ISO strings; show them in MYT like the rest of the screen, as a sentence. */
const readable = (reason: string) =>
  reason
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z/g, (iso) => fmt(iso))
    .replace(/^./, (c) => c.toUpperCase())
const TRIGGER: Record<ReplanTrigger['kind'], string> = {
  heavy_rain: 'heavy rain',
  weather_warning: 'a weather warning',
  flag_confirmed: 'a confirmed flag',
  recapture_requested: 'a recapture request',
  pass_expiring: 'a pass starting to expire',
  repair_completed: 'a finished repair'
}
const READING: Record<ContextSnapshot['kind'], string> = {
  rainfall: 'Rainfall',
  water_level: 'Water level',
  lightning_warning: 'Lightning warning',
  weather_warning: 'Weather warning'
}
const PARTS = [
  { key: 'expiry', label: 'Expiry' },
  { key: 'reviewedFlag', label: 'Reviewed flag' },
  { key: 'rain', label: 'Rain' },
  { key: 'waterLevel', label: 'Water level' }
] as const

const planTitle = (plan: PatrolPlan) =>
  plan.replan
    ? `Re-plan after ${TRIGGER[plan.replan.trigger.kind]}`
    : `Patrol of ${plan.tasks.length} ${plan.tasks.length === 1 ? 'segment' : 'segments'}`

/** A score part, or "unknown" for a stale or missing input: never shown as zero. */
const part = (value: number | null) => (value === null ? 'unknown' : value.toFixed(2))

const readingValue = (c: ContextSnapshot) =>
  c.kind === 'rainfall' ? `${c.value} mm/h` : c.kind === 'water_level' ? `${c.value} m` : `“${c.text}”`

/** The segment number from its name ("... segment 12"), for the code plate, as the Inbox does. */
const segmentCode = (name: string) => {
  const n = /segment (\d+)/i.exec(name)?.[1]
  return n ? `S${n}` : null
}

const Skeleton = () => (
  <Screen title="Patrol" context="Loading the patrol plans">
    <div className="work skeleton" role="status">
      <span className="sr">Loading the patrol plans</span>
      <div className="list island" aria-hidden="true">
        <i />
        <i />
      </div>
      <div className="detail island" aria-hidden="true">
        <i className="tall" />
      </div>
    </div>
  </Screen>
)

export function Patrol() {
  const { data, error, reload } = useCoreRead(readPatrol)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (!data && !error) return <Skeleton />
  const failed = error && (
    <div className="banner error" role="alert">
      <WarningCircle size={20} weight="bold" aria-hidden="true" />
      <p>
        The patrol plans could not be read: {error.message}. Nothing was changed, and the other screens still work.{' '}
        <button className="btn small" onClick={reload}>
          Try again
        </button>
      </p>
    </div>
  )
  if (!data)
    return (
      <Screen title="Patrol" context="The patrol plans did not load">
        <main className="detail island patrol-screen">{failed}</main>
      </Screen>
    )
  if (data.plans.length === 0)
    return (
      <Screen title="Patrol" context="No patrol plan in this session">
        <main className="detail island patrol-screen">
          {failed}
          <NoPlan data={data} onPlanned={(id) => (setSelectedId(id), reload())} />
        </main>
      </Screen>
    )
  const plan = data.plans.find((p) => p.id === selectedId) ?? data.plans[0]!
  return (
    <Screen
      title="Patrol"
      context={`${data.plans.length} ${data.plans.length === 1 ? 'plan' : 'plans'} · ${data.patrols.filter((p) => p.status === 'in_flight').length} in flight`}
    >
      <div className="work patrol-work patrol-screen">
        <nav className="list island" aria-label="Patrol plans">
          <div className="patrol-list-head">
            <h2>Plans</h2>
            <p>Newest first. A pilot approves each before it flies.</p>
          </div>
          <ul>
            {data.plans.map((p) => (
              <li key={p.id}>
                <button
                  className="patrol-row"
                  aria-current={p.id === plan.id ? 'true' : undefined}
                  onClick={() => setSelectedId(p.id)}
                >
                  <span className="patrol-row-title">{planTitle(p)}</span>
                  <span className="plate">{p.id}</span>
                  <span className="patrol-row-meta">
                    {statusWords(p, data)} · window opens {fmt(p.window.start)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="detail island patrol-detail">
          {failed}
          <PlanDetail key={plan.id} plan={plan} data={data} onChanged={reload} />
        </main>
      </div>
    </Screen>
  )
}

/** The re-plan that replaced this plan's uncommitted stops, if any. */
const supersededBy = (plan: PatrolPlan, data: Data) =>
  data.plans.find((p) => p.replan?.supersedes?.planId === plan.id) ?? null

function statusWords(plan: PatrolPlan, data: Data) {
  const flying = data.patrols.find((p) => p.planId === plan.id && p.status === 'in_flight')
  if (flying) return 'In flight'
  if (supersededBy(plan, data)) return 'Replaced by a re-plan'
  return plan.status === 'approved' ? 'Approved' : 'Waits for a pilot'
}

/** No plan yet: say what stays unknown, and let the manager ask core for S1's patrol. */
function NoPlan({ data, onPlanned }: { data: Data; onPlanned: (id: string) => void }) {
  const { snapshot: s } = useStore()
  if (!s) throw new Error('Patrol renders only after the demo data loaded')
  const { run, refused, busy } = useAction()
  const [loadFailed, setLoadFailed] = useState<string | null>(null)
  const dock = data.docks.find((d) => d.id === S1.body.dockId)
  if (!dock) throw new Error(`S1 plans from ${S1.body.dockId}, which core does not list`)
  const plan = async () => {
    setLoadFailed(null)
    try {
      await loadPatrolPlanner()
    } catch (error) {
      // The planner's map layers are files the page fetches; say so and let the person retry.
      setLoadFailed(error instanceof Error ? error.message : String(error))
      return
    }
    let id: string | null = null
    if (await run(async () => void (id = (await client().createPatrolPlan({ body: S1.body })).id))) onPlanned(id!)
  }
  return (
    <>
      <div className="empty-state left">
        <span className="icon-tile">
          <Drone size={24} weight="bold" aria-hidden="true" />
        </span>
        <h2>No patrol plan yet</h2>
        <p>
          No drone patrol is planned in this session, so no segment has been looked at from the air today. Their state
          stays unknown until a drone or a walk crew covers them.
        </p>
      </div>
      <section className="panel" aria-label="Plan S1's patrol">
        <h3>{S1.title}</h3>
        <p className="patrol-note">
          Asks core&apos;s planner for scenario S1&apos;s patrol: {S1.body.segmentIds.length} lake segments from the{' '}
          {dock.name.toLowerCase()}, with S1&apos;s simulated readings. It comes back proposed; a pilot still approves
          it.
        </p>
        <ul className="patrol-readings">
          {S1.body.context.map((c) => (
            <li key={c.kind}>
              <b>{READING[c.kind]}</b> {readingValue(c)} · {c.publisher}
              {c.simulated && <span className="chip sample">Sample</span>}
            </li>
          ))}
        </ul>
        {loadFailed && (
          <p className="banner error" role="alert">
            <WarningCircle size={20} weight="bold" aria-hidden="true" />
            <span>
              The planner&apos;s map layers did not load: {loadFailed}. Nothing was planned. Try again; if it keeps
              failing, reload the page.
            </span>
          </p>
        )}
        {refused && (
          <p className="state warn" role="alert">
            <Warning size={20} weight="bold" aria-hidden="true" />
            <span>{refused}</span>
          </p>
        )}
        {can('createPatrolPlan') ? (
          <div className="patrol-actions">
            <button className="btn primary" onClick={() => void plan()} disabled={busy}>
              {busy ? 'Planning…' : 'Plan the after-rain patrol'}
            </button>
          </div>
        ) : (
          <p className="banner info">
            <LockSimple size={20} weight="bold" aria-hidden="true" />
            <span>
              <b>Asking for a patrol plan is the park manager&apos;s step.</b> {peopleWho('createPatrolPlan', s.users)}{' '}
              can ask for one.
            </span>
          </p>
        )}
      </section>
    </>
  )
}

function PlanDetail({ plan, data, onChanged }: { plan: PatrolPlan; data: Data; onChanged: () => void }) {
  const { snapshot: s } = useStore()
  if (!s) throw new Error('Patrol renders only after the demo data loaded')
  const { user: me } = useSignedIn()
  const { run, refused, busy } = useAction()
  const segment = (id: string) => {
    const found = data.segments.find((x) => x.id === id)
    if (!found) throw new Error(`Plan ${plan.id} names segment ${id}, which core does not list`)
    return found
  }
  const dock = data.docks.find((d) => d.id === plan.dockId)
  const returnDock = data.docks.find((d) => d.id === plan.returnDockId)
  const drone = data.drones.find((d) => d.id === plan.droneProfileId)
  if (!dock || !returnDock || !drone) throw new Error(`Plan ${plan.id} names a dock or drone core does not list`)
  const replacedBy = supersededBy(plan, data)
  const patrols = data.patrols.filter((p) => p.planId === plan.id)
  // Core records who approved, flew or cleared by user ID; one the seed does not know is a bug in the data flow.
  const person = (id: string | null) => {
    const user = s.users.find((u) => u.id === id)
    if (!user) throw new Error(`Plan ${plan.id} names user ${id}, who is not in the seed`)
    return user.name
  }
  const stations = plan.tasks.reduce((n, t) => n + t.stations.length, 0)
  // Ranked by the priority total; unknown totals keep the planner's route order after the known ones.
  const ranked = plan.tasks
    .map((task, stop) => ({ task, stop: stop + 1 }))
    .sort((a, b) => (b.task.priority.total ?? -1) - (a.task.priority.total ?? -1))
  const anyUnknown = plan.tasks.some((t) => t.priority.total === null)

  const act = (call: () => Promise<unknown>) => void run(call).then((done) => done && onChanged())
  let action
  if (replacedBy || patrols.length > 0) action = null
  else if (plan.status === 'proposed')
    action = can('approvePatrolPlan') ? (
      <>
        <button
          className="btn primary"
          disabled={busy}
          onClick={() => act(() => client().approvePatrolPlan({ params: { id: plan.id } }))}
        >
          Approve this plan
        </button>
        <p className="patrol-note">Lets it fly. Approval lifts no hold: each still has to clear.</p>
      </>
    ) : (
      <p className="banner info">
        <LockSimple size={20} weight="bold" aria-hidden="true" />
        <span>
          <b>Approving a plan is the remote pilot&apos;s step.</b> {peopleWho('approvePatrolPlan', s.users)} approves
          it; you are signed in as {me.name}.
        </span>
      </p>
    )
  else
    action = can('startPatrol') ? (
      <>
        <button
          className="btn primary"
          disabled={busy}
          onClick={() =>
            act(() => client().startPatrol({ body: { planId: plan.id, provider: 'sim', droneId: 'sim-1' } }))
          }
        >
          Start the simulated patrol
        </button>
        <p className="patrol-note">
          Flies drone-sim&apos;s sim-1 on this plan. Core refuses while a hold is on or outside the window.
        </p>
      </>
    ) : (
      <p className="banner info">
        <LockSimple size={20} weight="bold" aria-hidden="true" />
        <span>
          <b>Starting a patrol is the remote pilot&apos;s step.</b> {peopleWho('startPatrol', s.users)} starts it.
        </span>
      </p>
    )

  return (
    <article className="patrol-plan">
      <header className="patrol-head">
        <h2>{planTitle(plan)}</h2>
        <div className="chips">
          <span className="plate">{plan.id}</span>
          {plan.simulated && <span className="chip sample">Sample</span>}
          <span className="chip">Source: {plan.source}</span>
          <span className="chip">Planned {fmt(plan.createdAt)}</span>
        </div>
      </header>

      {replacedBy ? (
        <p className="state neutral">
          A re-plan replaced this plan&apos;s stops that had not flown yet: {replacedBy.id}. Approve that one instead.
        </p>
      ) : plan.status === 'approved' ? (
        <p className="state ok">
          <CheckCircle size={20} weight="bold" aria-hidden="true" />
          <span>
            Approved by {person(plan.approvedBy)}
            {plan.approvedAt && `, ${fmt(plan.approvedAt)}`}.
          </span>
        </p>
      ) : (
        <p className="state warn">
          <Warning size={20} weight="bold" aria-hidden="true" />
          <span>Proposed. It cannot fly until a pilot approves it.</span>
        </p>
      )}

      <section aria-labelledby="pp-window">
        <h3 id="pp-window">When it can fly</h3>
        <dl className="patrol-facts">
          <dt>Window</dt>
          <dd>
            {fmt(plan.window.start)} to {fmt(plan.window.end)}, from {WINDOW_REASON[plan.window.reason]}
          </dd>
          <dt>Altitude cap</dt>
          <dd>{plan.altitudeCapM} m, as agreed with air traffic control</dd>
        </dl>
        {plan.holds.length === 0 ? (
          <p className="patrol-note">No holds.</p>
        ) : (
          <ul className="patrol-holds">
            {plan.holds.map((h, i) => (
              <Hold key={i} hold={h} where={h.segmentId ? segment(h.segmentId).name : 'The whole launch'} by={person} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pp-segments">
        <h3 id="pp-segments">Segments by priority</h3>
        <p className="patrol-note">
          Priority = {PRIORITY_WEIGHTS.expiry} × expiry + {PRIORITY_WEIGHTS.reviewedFlag} × reviewed flag +{' '}
          {PRIORITY_WEIGHTS.rain} × rain + {PRIORITY_WEIGHTS.waterLevel} × water level, each part 0 to 1. A missing or
          stale input is unknown, never zero, and leaves the total unknown for a person to review.
          {anyUnknown && ' Unknown totals keep the order the route flies them.'}
        </p>
        <div className="patrol-table-wrap" tabIndex={0} role="region" aria-label="Segments by priority">
          <table className="patrol-table">
            <thead>
              <tr>
                <th scope="col">Segment</th>
                <th scope="col">Total</th>
                {PARTS.map((p) => (
                  <th scope="col" key={p.key}>
                    {p.label}
                  </th>
                ))}
                <th scope="col">Stations</th>
                <th scope="col">Route stop</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ task, stop }) => {
                const seg = segment(task.segmentId)
                const code = segmentCode(seg.name)
                return (
                  <tr key={task.segmentId}>
                    <th scope="row">
                      {seg.name} {code && <span className="plate">{code}</span>}
                    </th>
                    <td className={task.priority.total === null ? 'unknown' : undefined}>
                      {part(task.priority.total)}
                    </td>
                    {PARTS.map((p) => (
                      <td key={p.key} className={task.priority[p.key] === null ? 'unknown' : undefined}>
                        {part(task.priority[p.key])}
                      </td>
                    ))}
                    <td>{task.stations.length}</td>
                    <td>{stop}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {plan.rejected.length > 0 ? (
          <ul className="patrol-holds">
            {plan.rejected.map((r) => (
              <li key={r.segmentId}>
                <b>Left out: {segment(r.segmentId).name}</b> <span className="chip">{r.code}</span>
                <p>{readable(r.reason)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="patrol-note">No segment was left out.</p>
        )}
      </section>

      <section aria-labelledby="pp-route">
        <h3 id="pp-route">Route and battery</h3>
        <dl className="patrol-facts">
          <dt>From</dt>
          <dd>
            {dock.name}
            {returnDock.id !== dock.id && `, landing at ${returnDock.name}`}
          </dd>
          <dt>Drone</dt>
          <dd>{drone.name}</dd>
          <dt>Stops</dt>
          <dd>
            {stations} camera stations on {plan.tasks.length} segments, {plan.waypoints.length} waypoints
          </dd>
          <dt>Energy</dt>
          <dd>
            {plan.energyWh.toFixed(1)} Wh of {drone.usableBatteryWh} Wh usable
          </dd>
          <dt>Battery reserve</dt>
          <dd>
            {plan.reserveWh.toFixed(1)} Wh left on landing; the drone keeps at least {drone.reserveWh} Wh
          </dd>
          <dt>Separation</dt>
          <dd>
            Stations keep {SEPARATION_M} m from people, vessels, vehicles and structures not under the pilot&apos;s
            control. A segment the plan cannot keep clear waits for the pilot or observer to see the path clear.
          </dd>
          {plan.authorisation && (
            <>
              <dt>Authorisation</dt>
              <dd>
                {plan.authorisation.ref}
                {plan.authorisation.simulated && <span className="chip sample">Sample</span>}
              </dd>
            </>
          )}
        </dl>
      </section>

      <section aria-labelledby="pp-readings">
        <h3 id="pp-readings">Readings the plan used</h3>
        {plan.context.length === 0 ? (
          <p className="patrol-note">None: the rain and water-level parts are unknown.</p>
        ) : (
          <ul className="patrol-readings">
            {plan.context.map((c, i) => (
              <li key={i}>
                <b>{READING[c.kind]}</b> {readingValue(c)} · {c.publisher}
                {c.stationId && ` station ${c.stationId}`} · observed {fmt(c.observedAt)}
                {c.simulated && <span className="chip sample">Sample</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {patrols.length > 0 && (
        <section aria-labelledby="pp-patrols">
          <h3 id="pp-patrols">Patrols of this plan</h3>
          <ul className="patrol-holds">
            {patrols.map((p) => (
              <li key={p.id}>
                <b>
                  {p.status === 'in_flight' ? 'In flight' : 'Landed'} · {p.droneId} ({p.provider})
                </b>{' '}
                <span className="plate">{p.id}</span>
                <p>
                  Started {fmt(p.startedAt)} by {person(p.pilotUserId)}
                  {p.completedAt && `, landed ${fmt(p.completedAt)}`}.
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="pp-export">
        <h3 id="pp-export">Mission export</h3>
        <p className="patrol-note">
          This demo does not export missions. From a checkout of the repository, the command below plans its own demo
          patrol over all 47 Elmina segments and writes a DJI WPML KMZ and a QGroundControl .plan, both marked
          &ldquo;not flight-ready&rdquo;.
        </p>
        <CodeBlock label="Export a mission" code="bun run export:mission <outDir>" />
      </section>

      {(action || refused) && (
        <footer className="patrol-actions sticky">
          {refused && (
            <p className="state warn" role="alert">
              <Warning size={20} weight="bold" aria-hidden="true" />
              <span>{refused}</span>
            </p>
          )}
          {action}
        </footer>
      )}
    </article>
  )
}

function Hold({ hold, where, by }: { hold: PlanHold; where: string; by: (id: string | null) => string }) {
  return (
    <li>
      <b>
        {HOLD_KIND[hold.kind]} · {where}
      </b>{' '}
      <span className="chip">
        {hold.releasedAt
          ? `Recorded clear by ${by(hold.releasedBy)}, ${fmt(hold.releasedAt)}`
          : hold.until
            ? // The demo core runs on the wall clock, so a time already past has ended.
              `${Date.parse(hold.until) <= Date.now() ? 'Ended' : 'Until'} ${fmt(hold.until)}`
            : 'Until the pilot records the path clear'}
      </span>
      <p>{readable(hold.reason)}</p>
    </li>
  )
}
