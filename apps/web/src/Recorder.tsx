import type { Scenario, ScenarioPlayer } from '@safe-edge/sdk'
import { useEffect, useRef, useState } from 'react'
import { button } from './button.ts'
import { RECORDING_FPS } from './recording.ts'

type Take =
  { state: 'idle' } | { state: 'recording' } | { state: 'done'; url: string } | { state: 'failed'; error: Error }

/**
 * Records the scenario from its start to its end. It captures the tab with `getDisplayMedia`, because a canvas stream
 * would miss the HTML labels drawn over the scene.
 */
export function Recorder({ player, scenario }: { player: ScenarioPlayer; scenario: Scenario }) {
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
        player.pause()
        if (recorder.state !== 'inactive') recorder.stop()
      }
      // Sharing stopped from the browser's own bar ends the take too.
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stop.current())
      await player.reset()
      recorder.start()
      setTake({ state: 'recording' })
      unsubscribe = player.subscribe(() => {
        if (!player.playing) stop.current()
      })
      player.play()
    } catch (error) {
      setTake({ state: 'failed', error: error as Error })
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {take.state === 'recording' ? (
        <button type="button" onClick={() => stop.current()} style={button(false)}>
          Stop recording
        </button>
      ) : (
        <button type="button" onClick={() => void record()} style={button(true)}>
          {take.state === 'done' ? 'Record again' : 'Record'}
        </button>
      )}
      {take.state === 'done' && (
        <a href={take.url} download={`safe-edge-${scenario.id}.webm`} style={{ color: '#17302a', fontWeight: 600 }}>
          Download the recording
        </a>
      )}
      {take.state === 'failed' && <span role="alert">The recording did not start: {take.error.message}</span>}
    </div>
  )
}
