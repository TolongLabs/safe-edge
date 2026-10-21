import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { DRONE_DRAWN_SCALE, type DayPhase, type FlightState } from '@safe-edge/scene'
import { elminaRainfall, elminaScenarios, rainAt, type Scenario } from '@safe-edge/sdk'
import { useState } from 'react'
import { button } from './button.ts'
import { Legend } from './Legend.tsx'
import { Recorder } from './Recorder.tsx'
import type { Playback, PlaybackMode } from './usePlayback.ts'

const SPEEDS = [1, 8, 30] as const

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

const dayWords: Record<DayPhase, string> = { night: 'Night', dawn: 'Dawn', day: 'Day', dusk: 'Dusk' }

/** A rain rate in the JPS one-hour bins: light 1–10 mm, moderate 11–30 mm, heavy 31–60 mm, very heavy above 60 mm. */
const rainWords = (mmH: number) =>
  mmH <= 0
    ? 'dry'
    : `${mmH <= 10 ? 'light' : mmH <= 30 ? 'moderate' : mmH <= 60 ? 'heavy' : 'very heavy'} rain, ${mmH} mm/h`

const realRain = elminaRainfall.reading
const realRainTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

const phaseWords: Record<FlightState['phase'], string> = {
  docked: 'On the dock',
  takeoff: 'Taking off',
  transit: 'Flying to the next segment',
  station: 'Photographing the edge',
  return: 'Flying back to the dock',
  landing: 'Landing',
  landed: 'Landed'
}

/**
 * Everything behind the story, in a menu top right: the scenario picker for the story or S1 to S6, the time, weather
 * and the real rainfall reading, the drone, what happened, the playback controls, the legend and the footnote.
 */
export function DetailsMenu({
  playback,
  mode,
  onMode,
  recording,
  defaultOpen
}: {
  playback: Playback
  mode: PlaybackMode
  onMode: (mode: PlaybackMode) => void
  recording: boolean
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [scrubTo, setScrubTo] = useState<number | null>(null)
  const { player, flight, day } = playback
  const ready = player !== null && !(player instanceof Error)
  const start = ready ? Date.parse(player.start) : 0
  const end = ready ? Date.parse(player.end) : 0
  const now = ready ? Date.parse(player.now) : 0
  const recent = ready
    ? player.played
        .filter((p) => Date.parse(p.event.at) >= start)
        .slice(-4)
        .reverse()
    : []

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="details"
        onClick={() => setOpen((o) => !o)}
        className={`${button(false)} float`}
        style={{ position: 'absolute', top: 8, right: 12 }}
      >
        Details
        {open ? (
          <CaretUp size={16} weight="bold" aria-hidden="true" />
        ) : (
          <CaretDown size={16} weight="bold" aria-hidden="true" />
        )}
      </button>
      {open && (
        <section
          id="details"
          aria-label="Details"
          style={{
            position: 'absolute',
            top: 52,
            right: 12,
            width: 'min(380px, calc(100% - 24px))',
            maxHeight: 'calc(100% - 64px)',
            overflowY: 'auto',
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
          }}
        >
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, lineHeight: '16px', color: '#5d6b66' }}>Scenario</span>
            <select
              value={mode.kind === 'story' ? 'story' : mode.id}
              onChange={(event) => {
                const value = event.target.value
                onMode(value === 'story' ? { kind: 'story' } : { kind: 'scenario', id: value as Scenario['id'] })
              }}
              className="scene-select"
              style={{ width: '100%', minWidth: 0 }}
            >
              <option value="story">The story, S1 to S3</option>
              {elminaScenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>

          {player instanceof Error && (
            <p role="alert" style={{ margin: 0 }}>
              The scenario did not load: {player.message}
            </p>
          )}

          {ready && (
            <>
              <p style={{ margin: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                <time dateTime={player.now}>{localTime.format(now)}</time>
              </p>

              <div style={{ display: 'grid', gap: 4 }}>
                <p style={{ margin: 0 }}>
                  {day && `${dayWords[day]}, `}
                  {rainWords(rainAt(elminaScenarios, player.scenario.id, player.now))}
                </p>
                <p style={{ margin: 0, fontSize: 12, lineHeight: '16px', color: '#5d6b66' }}>
                  Real reading:{' '}
                  <a href={realRain.url ?? undefined} target="_blank" rel="noreferrer" style={{ color: '#17302a' }}>
                    {realRain.value?.toFixed(1)} mm in the hour to{' '}
                    <time dateTime={realRain.observedAt}>{realRainTime.format(Date.parse(realRain.observedAt))}</time>
                  </a>{' '}
                  at {elminaRainfall.station}, {realRain.publisher} gauge {realRain.stationId}. Saved snapshot; the
                  scenario’s rain is simulated.
                </p>
              </div>

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

              <ol
                aria-label="What happened"
                style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}
              >
                {recent.length === 0 && (
                  <li style={{ color: '#5d6b66' }}>{player.scenario.summary.replace(/^Simulated\. /, '')}</li>
                )}
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

              {recording ? (
                <Recorder
                  key={player.scenario.id}
                  player={player}
                  name={`safe-edge-${player.scenario.id}`}
                  play={playback.play}
                  pause={playback.pause}
                />
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={playback.playing ? playback.pause : playback.play}
                      className={button(true)}
                    >
                      {playback.playing ? 'Pause' : now >= end ? 'Play again' : now > start ? 'Resume' : 'Play'}
                    </button>
                    <button type="button" onClick={() => void playback.reset()} className={button(false)}>
                      Reset
                    </button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      Speed
                      <select
                        value={player.speed}
                        onChange={(event) => player.setSpeed(Number(event.target.value))}
                        className="scene-select"
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
                    onChange={(event) => {
                      // The slider holds the scrubbed time until the seek lands, so a re-render cannot snap it back.
                      const to = Number(event.target.value)
                      setScrubTo(to)
                      void playback
                        .seek(new Date(to).toISOString())
                        .finally(() => setScrubTo((held) => (held === to ? null : held)))
                    }}
                    style={{ width: '100%', accentColor: '#17302a', height: 'var(--tap, 32px)' }}
                  />
                </>
              )}
            </>
          )}

          <Legend />
          <p style={{ margin: 0, fontSize: 12, lineHeight: '16px', color: '#5d6b66' }}>
            The demo’s own core plays each step on a fixed-step clock. Holds on the ground pass at two hours a second.
            The drone is drawn {DRONE_DRAWN_SCALE}× life size; the dock’s roof is an assumed site.
          </p>
        </section>
      )}
    </>
  )
}
