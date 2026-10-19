import {
  DRONE_DRAWN_SCALE,
  type ElminaScene,
  type FlightPoint,
  type FlightState,
  type PassState,
  type SceneMarkers
} from '@safe-edge/scene'
import {
  createScenarioPlayer,
  elminaScenarios,
  elminaSeed,
  type Played,
  type Scenario,
  type ScenarioPlayer
} from '@safe-edge/sdk'
import { useEffect, useRef, useState } from 'react'
import { loadPlanner } from './planner.ts'

const SPEEDS = [1, 8, 30] as const
/** The simulated aircraft every scenario flies (`hostDroneSim` names them `sim-1`, …). */
const DRONE = 'sim-1'

const localTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})
const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' })

const phaseWords: Record<FlightState['phase'], string> = {
  docked: 'On the dock',
  takeoff: 'Taking off',
  transit: 'Flying to the next segment',
  station: 'Photographing the edge',
  return: 'Flying back to the dock',
  landing: 'Landing',
  landed: 'Landed'
}

interface PlanResult {
  id: string
  dockId: string
  droneProfileId: string
  waypoints: FlightPoint[]
}

/** The last patrol plan played so far, if any. */
function latestPlan(played: readonly Played[]): PlanResult | null {
  for (let i = played.length - 1; i >= 0; i--) {
    const p = played[i]!
    if (p.event.operationId === 'createPatrolPlan' && p.outcome === 'done') return p.result as PlanResult
  }
  return null
}

const itemLabels = new Map(elminaSeed.segments.flatMap((s) => s.expectedInventory.map((i) => [i.id, i.label] as const)))
const statusWords = { missing: 'missing', changed: 'changed', not_visible: 'not visible', present: 'present' } as const

/** What the scene marks for the demo's state: every candidate as a pin, dropped frames and unseen stretches. */
async function markersOf(client: ScenarioPlayer['client']): Promise<SceneMarkers> {
  const [candidates, audit, patrols] = await Promise.all([
    client.listCandidates({}),
    client.listAudit({}),
    client.listPatrols()
  ])
  const live = candidates.filter((c) => c.status !== 'rejected')
  const what = (c: (typeof candidates)[number]) =>
    c.inventoryItemId
      ? `${itemLabels.get(c.inventoryItemId) ?? c.inventoryItemId} ${statusWords[c.itemStatus ?? 'changed']}`
      : c.rationale
  return {
    pins: live.map((c) => ({
      id: c.id,
      segmentId: c.segmentId,
      itemId: c.inventoryItemId,
      tier: c.tier,
      label: what(c)
    })),
    dropped: audit
      .filter((e) => e.action === 'recordObservation')
      .map((e) => e.after as { id: string; privacyAction: string; pose: { lon: number; lat: number; altM: number } })
      .filter((o) => o.privacyAction === 'discarded')
      .map((o) => ({ id: o.id, pose: o.pose, label: 'frame dropped: person' })),
    unknowns: [
      ...live
        .filter((c) => c.itemStatus === 'not_visible')
        .map((c) => ({ id: c.id, segmentId: c.segmentId, itemId: c.inventoryItemId, label: 'Unknown: field check' })),
      ...patrols.flatMap((p) =>
        p.coverage
          .filter((c) => c.unknownM > 0)
          .map((c) => ({
            id: `${p.id}-${c.segmentId}`,
            segmentId: c.segmentId,
            itemId: null,
            label: 'Unknown: not inspected'
          }))
      )
    ]
  }
}

function flightView(plan: PlanResult) {
  const dock = elminaSeed.docks.find((d) => d.id === plan.dockId)
  const drone = elminaSeed.droneProfiles.find((d) => d.id === plan.droneProfileId)
  if (!dock || !drone) throw new Error(`${plan.id} names a dock or drone the seed lacks`)
  return {
    dock: dock.position,
    waypoints: plan.waypoints,
    usableBatteryWh: drone.usableBatteryWh,
    camera: drone.camera
  }
}

/**
 * Plays S1 to S6 into the scene through the scenario player: the demo's own core on the SDK's memory transport, on a
 * fixed-step clock. The scene draws the planned patrol and the drone where drone-sim has it, and recolours segments
 * as their passes change.
 */
export function ScenarioPanel({
  scene,
  onPasses
}: {
  scene: ElminaScene
  /** The demo's passes after every step, for the screens beside the scene. */
  onPasses: (passes: Array<{ segmentId: string; state: PassState; validTo: string | null }>) => void
}) {
  const [id, setId] = useState<Scenario['id']>(() => {
    const asked = new URLSearchParams(location.search).get('scenario')
    return elminaScenarios.some((s) => s.id === asked) ? (asked as Scenario['id']) : 's1'
  })
  const [player, setPlayer] = useState<ScenarioPlayer | Error | null>(null)
  const [, setVersion] = useState(0)
  const [flight, setFlight] = useState<FlightState | null>(null)
  const [scrubTo, setScrubTo] = useState<number | null>(null)
  const shown = useRef<{ planId: string | null; now: string; flying: boolean }>({
    planId: null,
    now: '',
    flying: false
  })

  useEffect(() => {
    let cancelled = false
    let unsubscribe = () => {}
    setPlayer(null)
    scene.showFlight(null)
    shown.current = { planId: null, now: '', flying: false }
    setFlight(null)
    loadPlanner()
      .then((planner) => createScenarioPlayer({ scenarios: elminaScenarios, id, planner, speed: 8 }))
      .then((created) => {
        if (cancelled) return
        // Each update reads the demo after the seek that caused it; a newer update supersedes an older one.
        let latest = 0
        const sync = async () => {
          const mine = ++latest
          const plan = latestPlan(created.played)
          const rewound = created.now < shown.current.now
          if (plan && (plan.id !== shown.current.planId || rewound)) scene.showFlight(flightView(plan))
          if (!plan && shown.current.planId !== null) scene.showFlight(null)
          shown.current = { ...shown.current, planId: plan?.id ?? null, now: created.now }
          const [status, passes, markers] = await Promise.all([
            plan ? created.client.droneStatus(DRONE) : null,
            created.client.listPasses({}),
            markersOf(created.client)
          ])
          if (mine !== latest) return
          scene.setMarkers(markers)
          const placed = status ? scene.placeDrone(status) : null
          // The camera picks up the drone when it leaves the dock during playback.
          const flying = status?.state === 'in_flight'
          if (flying && !shown.current.flying && created.playing) scene.followDrone(true)
          shown.current.flying = flying
          setFlight(placed)
          scene.setPassStates(
            Object.fromEntries(passes.map((p) => [p.segmentId, p.state as PassState])) as Record<string, PassState>
          )
          onPasses(passes.map((p) => ({ segmentId: p.segmentId, state: p.state as PassState, validTo: p.validTo })))
          setVersion((v) => v + 1)
        }
        unsubscribe = created.subscribe(() => void sync())
        setPlayer(created)
        void sync()
      })
      .catch((error: Error) => !cancelled && setPlayer(error))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [id, scene, onPasses])

  const card: React.CSSProperties = {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 'min(380px, calc(100% - 24px))',
    padding: 16,
    borderRadius: 12,
    background: '#fbfcfb',
    color: '#1c2925',
    font: '14px/20px "Atkinson Hyperlegible Next", system-ui, sans-serif',
    boxShadow: '0 4px 12px rgb(22 27 26 / 0.10), 0 1px 2px rgb(22 27 26 / 0.06)',
    boxSizing: 'border-box',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: 12
  }

  if (player instanceof Error)
    return (
      <section aria-label="Scenario player" style={card}>
        <p role="alert" style={{ margin: 0 }}>
          The scenario did not load: {player.message}
        </p>
      </section>
    )

  const scenario = elminaScenarios.find((s) => s.id === id)!
  const start = Date.parse(scenario.start)
  const end = Date.parse(scenario.end)
  const now = player ? Date.parse(player.now) : start
  const own = player ? player.played.filter((p) => Date.parse(p.event.at) >= start) : []
  const recent = own.slice(-4).reverse()

  const play = () => {
    if (!player) return
    if (player.airborne) scene.followDrone(true)
    player.play()
  }

  return (
    <section aria-label="Scenario player" style={card}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, lineHeight: '16px', color: '#5d6b66' }}>Scenario</span>
          <select
            value={id}
            onChange={(event) => setId(event.target.value as Scenario['id'])}
            style={{ font: 'inherit', fontWeight: 600, minHeight: 32, width: '100%', minWidth: 0 }}
          >
            {elminaScenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <span
          style={{
            alignSelf: 'end',
            padding: '0 6px',
            border: '1.5px solid #1c2925',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase'
          }}
        >
          Simulation
        </span>
      </header>

      <p style={{ margin: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        <time dateTime={new Date(now).toISOString()}>{localTime.format(now)}</time>
        {player === null && ' · loading the demo…'}
      </p>

      {flight && (
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <label htmlFor="battery">
              Drone: {phaseWords[flight.phase]}
              {flight.phase !== 'docked' && flight.phase !== 'landed' && `, ${Math.round(flight.altM)} m up`}
            </label>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(flight.batteryPercent)}% · {Math.round(flight.remainingWh)} Wh
            </span>
          </div>
          <meter id="battery" min={0} max={100} low={30} optimum={100} value={flight.batteryPercent} />
        </div>
      )}

      <ol aria-label="What happened" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
        {recent.length === 0 && <li style={{ color: '#5d6b66' }}>{scenario.summary.replace(/^Simulated\. /, '')}</li>}
        {recent.map((p, i) => (
          <li
            key={`${p.event.at}-${p.event.operationId}`}
            style={{ display: 'flex', gap: 10, opacity: i === 0 ? 1 : 0.75 }}
          >
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {hhmm.format(Date.parse(p.event.at))}
            </span>
            <span>
              {p.event.note}
              {p.outcome === 'refused' && ` Refused: ${p.rule.replaceAll('_', ' ')}.`}
              {p.outcome === 'needs_api' && ' (Plays against the API only.)'}
            </span>
          </li>
        ))}
      </ol>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={!player}
          onClick={player?.playing ? () => player.pause() : play}
          style={button(true)}
        >
          {player?.playing ? 'Pause' : now >= end ? 'Play again' : now > start ? 'Resume' : 'Play'}
        </button>
        <button type="button" disabled={!player} onClick={() => void player?.reset()} style={button(false)}>
          Reset
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Speed
          <select
            value={player?.speed ?? 8}
            disabled={!player}
            onChange={(event) => player?.setSpeed(Number(event.target.value))}
            style={{ font: 'inherit', minHeight: 32 }}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        type="range"
        aria-label="Scenario time"
        min={start}
        max={end}
        step={1000}
        value={scrubTo ?? now}
        disabled={!player}
        onChange={(event) => {
          if (!player) return
          // The slider holds the scrubbed time until the seek lands, so a re-render meanwhile cannot snap it back.
          const to = Number(event.target.value)
          setScrubTo(to)
          player.pause()
          void player.seek(new Date(to).toISOString()).finally(() => setScrubTo((held) => (held === to ? null : held)))
        }}
        style={{ width: '100%', accentColor: '#17302a', height: 24 }}
      />
      <p style={{ margin: 0, fontSize: 12, lineHeight: '16px', color: '#5d6b66' }}>
        The demo’s own core plays each step on a fixed-step clock. Holds on the ground pass at two hours a second. The
        drone is drawn {DRONE_DRAWN_SCALE}× life size; the dock’s roof is an assumed site.
      </p>
    </section>
  )
}

const button = (primary: boolean) =>
  ({
    minHeight: 32,
    padding: '0 14px',
    borderRadius: 8,
    border: primary ? 'none' : '1.5px solid #17302a',
    background: primary ? '#17302a' : '#fbfcfb',
    color: primary ? '#ffffff' : '#17302a',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer'
  }) as const
