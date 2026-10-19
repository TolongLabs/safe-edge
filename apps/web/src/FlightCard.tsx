import { DRONE_DRAWN_SCALE, type ElminaScene, type FlightPhase, type FlightState } from '@safe-edge/scene'
import { useEffect, useMemo, useState } from 'react'
import type { S1Flight } from './s1.ts'

/** The flight plays this many times faster than the plan. */
const SPEED = 8
/** Seconds of playback for the night-long weather hold before the launch window. */
const HOLD_S = 6
/** Seconds of playback after landing, so the drone is seen back on the dock. */
const AFTER_S = 2

const localTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

/** Playback seconds to scenario time: the hold runs fast, then the flight runs at `SPEED`. */
function timeline({ startsAt, flight }: S1Flight) {
  const holdFrom = Date.parse(startsAt)
  const takeoff = Date.parse(flight.waypoints[0]!.eta)
  const landing = Date.parse(flight.waypoints.at(-1)!.eta)
  const flightS = (landing - takeoff) / 1000 / SPEED
  return {
    endS: HOLD_S + flightS + AFTER_S,
    at(playS: number) {
      if (playS <= HOLD_S) return holdFrom + (takeoff - holdFrom) * (playS / HOLD_S)
      return takeoff + (playS - HOLD_S) * 1000 * SPEED
    }
  }
}

const phaseWords: Record<Exclude<FlightPhase, 'docked' | 'landed'>, string> = {
  takeoff: 'Taking off from the dock on the facility roof.',
  transit: 'Flying to the next edge segment.',
  station: 'Photographing the edge from its camera stations.',
  return: 'Flying back to the dock.',
  landing: 'Landing on the dock.'
}

const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' })
const dayTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
})

/** Plays S1 in the scene: the weather hold, take-off, the patrol and landing, with the drone's battery. */
export function FlightCard({
  scene,
  s1,
  segmentName
}: {
  scene: ElminaScene
  s1: S1Flight
  segmentName: (id: string) => string
}) {
  const { endS, at } = useMemo(() => timeline(s1), [s1])
  const [playS, setPlayS] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [state, setState] = useState<FlightState>(() => scene.setFlightTime(at(0)))
  const now = at(playS)

  useEffect(() => setState(scene.setFlightTime(now)), [scene, now])

  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    let frame = requestAnimationFrame(function step(time) {
      const delta = (time - last) / 1000
      last = time
      setPlayS((s) => Math.min(endS, s + delta))
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [playing, endS])

  useEffect(() => {
    if (playS >= endS) setPlaying(false)
  }, [playS, endS])

  const play = () => {
    if (playS >= endS) setPlayS(0)
    scene.followDrone(true)
    setPlaying(true)
  }

  const { rain } = s1
  const status =
    state.phase === 'docked'
      ? `Weather hold. ${rain.mmPerH} mm/h of rain at ${hhmm.format(Date.parse(rain.observedAt))} is above the dock’s ${rain.dockLimitMmPerH} mm/h limit, so the launch waits for a morning that is dry from first light.`
      : state.phase === 'landed'
        ? `Landed on the dock. The patrol used ${Math.round(s1.energyWh)} Wh.`
        : phaseWords[state.phase]
  const holdLabel = (hold: S1Flight['holds'][number]) => {
    if (hold.kind === 'weather') return `Rain: until ${dayTime.format(Date.parse(hold.until!))}`
    if (hold.kind === 'lightning') return `Thunderstorm warning: until ${dayTime.format(Date.parse(hold.until!))}`
    return hold.segmentId
      ? `People near ${segmentName(hold.segmentId)}: it waits for the pilot to record the path clear`
      : 'People on the footway by the route: take-off waits for the pilot to record it clear'
  }

  return (
    <section
      aria-label="S1 patrol"
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        width: 'min(360px, calc(100% - 24px))',
        padding: 16,
        borderRadius: 12,
        background: '#fbfcfb',
        color: '#1c2925',
        font: '14px/20px "Atkinson Hyperlegible Next", system-ui, sans-serif',
        boxShadow: '0 4px 12px rgb(22 27 26 / 0.10), 0 1px 2px rgb(22 27 26 / 0.06)',
        display: 'grid',
        gap: 12
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, lineHeight: '22px', fontWeight: 600 }}>S1 · dawn patrol</h2>
        <span
          style={{
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
      </p>
      <p style={{ margin: 0 }} aria-live="polite">
        {status}
      </p>
      {state.phase === 'docked' && (
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 2, color: '#5d6b66' }}>
          {s1.holds.map((hold, i) => (
            <li key={i}>{holdLabel(hold)}</li>
          ))}
        </ul>
      )}

      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <label htmlFor="battery">Battery</label>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(state.batteryPercent)}% · {Math.round(state.remainingWh)} Wh
            {state.phase !== 'docked' && state.phase !== 'landed' && ` · ${Math.round(state.altM)} m up`}
          </span>
        </div>
        <meter
          id="battery"
          min={0}
          max={100}
          low={30}
          optimum={100}
          value={state.batteryPercent}
          style={{ width: '100%', height: 12 }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={playing ? () => setPlaying(false) : play} style={buttonStyle}>
          {playing ? 'Pause' : playS >= endS ? 'Play again' : playS > 0 ? 'Resume' : 'Play S1'}
        </button>
        <input
          type="range"
          aria-label="Scenario time"
          min={0}
          max={endS}
          step={0.1}
          value={playS}
          onChange={(event) => {
            setPlaying(false)
            setPlayS(Number(event.target.value))
          }}
          style={{ flex: 1, accentColor: '#17302a', height: 32 }}
        />
      </div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: '16px', color: '#5d6b66' }}>
        Plan from the Elmina planner, played at {SPEED}× speed. The drone is drawn {DRONE_DRAWN_SCALE}× life size; the
        dock’s roof is an assumed site.
      </p>
    </section>
  )
}

const buttonStyle = {
  minHeight: 32,
  padding: '0 14px',
  borderRadius: 8,
  border: 'none',
  background: '#17302a',
  color: '#ffffff',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer'
} as const
