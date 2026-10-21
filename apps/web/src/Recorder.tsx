import type { ScenarioPlayer } from '@safe-edge/sdk'
import { useEffect, useRef, useState } from 'react'
import { button } from './button.ts'
import { RECORDING_FPS } from './recording.ts'

type Take =
  { state: 'idle' } | { state: 'recording' } | { state: 'done'; url: string } | { state: 'failed'; error: Error }

/**
 * Records what the player plays, from its start to its end. It captures the tab with `getDisplayMedia`, because a
 * canvas stream would miss the HTML labels drawn over the scene. `play` and `pause` are the playback's own, so the
 * story's caption holds stay in the take.
 */
export function Recorder({
  player,
  name,
  play,
  pause,
  onStart
}: {
  player: ScenarioPlayer
  /** The take's file name, without `.webm`. */
  name: string
  play: () => void
  pause: () => void
  onStart?: () => void
}) {
  const [take, setTake] = useState<Take>({ state: 'idle' })
  const stop = useRef<() => void>(() => {})
  useEffect(() => () => stop.current(), [])
  useEffect(() => () => (take.state === 'done' ? URL.revokeObjectURL(take.url) : undefined), [take])

  const record = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: RECORDING_FPS },
        audio: false,
        preferCurrentTab: true
      } as DisplayMediaStreamOptions)
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => chunks.push(event.data)
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setTake({ state: 'done', url: URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })) })
      }
      let unsubscribe = () => {}
      stop.current = () => {
        unsubscribe()
        pause()
        if (recorder.state !== 'inactive') recorder.stop()
      }
      // Sharing stopped from the browser's own bar ends the take too.
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stop.current())
      await player.reset()
      recorder.start()
      setTake({ state: 'recording' })
      onStart?.()
      unsubscribe = player.subscribe(() => {
        if (player.now >= player.end) stop.current()
      })
      play()
    } catch (error) {
      setTake({ state: 'failed', error: error as Error })
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {take.state === 'recording' ? (
        <button type="button" onClick={() => stop.current()} className={button(false)}>
          Stop recording
        </button>
      ) : (
        <button type="button" onClick={() => void record()} className={button(true)}>
          {take.state === 'done' ? 'Record again' : 'Record'}
        </button>
      )}
      {take.state === 'done' && (
        <a href={take.url} download={`${name}.webm`} style={{ color: '#17302a', fontWeight: 600 }}>
          Download the recording
        </a>
      )}
      {take.state === 'failed' && <span role="alert">The recording did not start: {take.error.message}</span>}
    </div>
  )
}
