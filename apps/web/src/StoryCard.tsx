import { passStateColours } from '@safe-edge/scene'
import type { StoryChapter } from '@safe-edge/sdk'
import { useState, type CSSProperties } from 'react'
import { button } from './button.ts'
import { Recorder } from './Recorder.tsx'
import type { Playback } from './usePlayback.ts'

/** How long the story plays at 8× with its caption holds: 89 s from Play to the end card, measured 20 Oct 2026. */
const STORY_SECONDS = 90

const chapters: Array<{ id: StoryChapter; label: string }> = [
  { id: 'spot', label: 'Spot' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'fix', label: 'Fix' },
  { id: 'prove', label: 'Prove' }
]

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit'
})
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const card: CSSProperties = {
  position: 'absolute',
  bottom: 48,
  boxSizing: 'border-box',
  display: 'grid',
  gap: 12,
  padding: 16,
  borderRadius: 12,
  background: '#fbfcfb',
  color: '#1c2925',
  font: '14px/20px "Atkinson Hyperlegible Next", system-ui, sans-serif',
  boxShadow: '0 4px 12px rgb(22 27 26 / 0.10), 0 1px 2px rgb(22 27 26 / 0.06)'
}
const left: CSSProperties = { ...card, left: 12, width: 'min(400px, calc(100% - 24px))' }
const centre: CSSProperties = {
  ...card,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(560px, calc(100% - 24px))'
}

/**
 * The scene's story, S1 to S3: a first screen that states the problem and the answer, then one caption at a time in
 * four chapters, ending on the proven pass. "Look around" puts it away behind a small button.
 */
export function StoryCard({ playback, recording }: { playback: Playback; recording: boolean }) {
  const [stage, setStage] = useState<'intro' | 'story' | 'away'>('intro')
  const { player } = playback
  const ready = player !== null && !(player instanceof Error)

  if (player instanceof Error)
    return (
      <section aria-label="Story" style={left}>
        <p role="alert" style={{ margin: 0 }}>
          The story did not load: {player.message}
        </p>
      </section>
    )

  const lookAround = () => {
    playback.pause()
    setStage('away')
  }

  if (stage === 'away')
    return (
      <button
        type="button"
        onClick={() => setStage('intro')}
        style={{ ...button(true), position: 'absolute', left: 12, bottom: 48 }}
      >
        Play the story
      </button>
    )

  if (stage === 'intro')
    return (
      <section aria-label="Story" style={left}>
        <p style={{ margin: 0, fontSize: 12, lineHeight: '16px', color: '#5d6b66' }}>
          Central Park Lake, by the playground
        </p>
        <h1 style={{ margin: 0, font: '700 20px/26px "Atkinson Hyperlegible Next", system-ui, sans-serif' }}>
          A fence panel is missing. A child on the path can reach deep water.
        </h1>
        <p style={{ margin: 0, color: '#5d6b66' }}>
          Safe Edge finds gaps like this, gets them fixed, and proves the fix before the edge counts as safe.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {recording && ready ? (
            <Recorder
              player={player}
              name="safe-edge-story"
              play={playback.play}
              pause={playback.pause}
              onStart={() => setStage('story')}
            />
          ) : (
            <button
              type="button"
              disabled={!ready}
              onClick={() => {
                setStage('story')
                playback.play()
              }}
              style={button(true)}
            >
              {`Play the story · about ${STORY_SECONDS} s`}
            </button>
          )}
          <button type="button" onClick={lookAround} style={button(false)}>
            Look around
          </button>
        </div>
      </section>
    )

  if (!ready) return null
  const start = Date.parse(player.start)
  const end = Date.parse(player.end)
  const now = Date.parse(player.now)
  const story = playback.current?.event.story
  const chapter = story?.chapter ?? 'spot'
  const finished = now >= end

  return (
    <section aria-label="Story" style={centre}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <ol
          aria-label="Chapters"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}
        >
          {chapters.map((c, i) => {
            const on = c.id === chapter
            return (
              <li
                key={c.id}
                aria-current={on ? 'step' : undefined}
                style={{
                  padding: '2px 10px',
                  borderRadius: 999,
                  border: `1px solid ${on ? '#17302a' : '#cfd6d2'}`,
                  background: on ? '#17302a' : '#fbfcfb',
                  color: on ? '#ffffff' : '#5d6b66',
                  fontSize: 12,
                  lineHeight: '18px',
                  fontWeight: 700
                }}
              >
                {i + 1} {c.label}
              </li>
            )
          })}
        </ol>
        <time
          dateTime={player.now}
          style={{ marginLeft: 'auto', color: '#5d6b66', fontVariantNumeric: 'tabular-nums' }}
        >
          {clock.format(now)}
        </time>
      </div>

      {finished ? (
        <p key="end" style={{ margin: 0, fontSize: 16, lineHeight: '22px', fontWeight: 600 }}>
          {playback.storyPass?.state === 'valid' && playback.storyPass.validTo
            ? `Safety pass issued, valid to ${day.format(Date.parse(playback.storyPass.validTo))}`
            : 'The story is over.'}
        </p>
      ) : (
        <p
          key="caption"
          data-testid="caption"
          aria-live="polite"
          style={{ margin: 0, fontSize: 16, lineHeight: '22px', fontWeight: 600 }}
        >
          {story?.caption}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {finished ? (
          <>
            <button
              type="button"
              onClick={() => void playback.reset().then(() => playback.play())}
              style={button(true)}
            >
              Play again
            </button>
            <button type="button" onClick={lookAround} style={button(false)}>
              Look around
            </button>
          </>
        ) : (
          !recording && (
            <button
              type="button"
              onClick={playback.playing ? playback.pause : playback.play}
              style={{ ...button(true), minWidth: 88 }}
            >
              {playback.playing ? 'Pause' : 'Play'}
            </button>
          )
        )}
        <progress
          aria-label="Story progress"
          max={end - start}
          value={now - start}
          style={{ flex: 1, minWidth: 120, height: 6, accentColor: '#17302a' }}
        />
        <span style={{ display: 'flex', gap: 10, fontSize: 12, color: '#5d6b66' }}>
          <Key colour={passStateColours.valid} label="safe" />
          <Key colour={passStateColours.suspended} label="not safe" />
          <Key colour={passStateColours.none} label="unknown" dashed />
        </span>
      </div>
    </section>
  )
}

function Key({ colour, label, dashed = false }: { colour: number; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width="16" height="6" aria-hidden="true">
        <line
          x1="1"
          y1="3"
          x2="15"
          y2="3"
          stroke={`#${colour.toString(16).padStart(6, '0')}`}
          strokeWidth="4"
          strokeDasharray={dashed ? '3 2' : undefined}
        />
      </svg>
      {label}
    </span>
  )
}
