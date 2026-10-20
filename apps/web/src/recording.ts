import type { CameraShot } from '@safe-edge/scene'
import { elminaSeed, type Scenario } from '@safe-edge/sdk'

/** The recording's frame rate: each frame moves the scenario on by exactly this fraction of a second of playback. */
export const RECORDING_FPS = 30

/** Fence panel 4 by the playground path, where S1 to S3 happen. */
const STORY_SEGMENT = elminaSeed.story.s1.segmentId

/**
 * The recording's fixed camera path. On the ground the camera sweeps a third of a circle around the story segment over
 * the scenario; in the air it rides behind and above the drone. The shot depends only on the scenario's time and the
 * drone, so every take frames the same.
 */
export function recordingShot(scenario: Scenario, now: string, airborne: boolean): CameraShot {
  if (airborne) return { target: 'drone', distanceM: 110, bearingDeg: 200, pitchDeg: 28 }
  const start = Date.parse(scenario.start)
  const progress = (Date.parse(now) - start) / (Date.parse(scenario.end) - start)
  return { target: { segmentId: STORY_SEGMENT }, distanceM: 520, bearingDeg: 150 + 120 * progress, pitchDeg: 35 }
}

/**
 * Frames for the scenario player that each move it on by 1/`fps` of a second, at most `fps` times a second. A slow
 * machine plays the scenario slower instead of skipping ahead, so a recording stays smooth.
 */
export function steadyFrames(fps = RECORDING_FPS) {
  const stepMs = 1000 / fps
  return (onFrame: (elapsedMs: number) => void) => {
    let last = -Infinity
    let id = requestAnimationFrame(function frame(now) {
      // A millisecond's slack, so a 60 Hz display steps on every second frame rather than every third.
      if (now - last >= stepMs - 1) {
        last = now
        onFrame(stepMs)
      }
      id = requestAnimationFrame(frame)
    })
    return () => cancelAnimationFrame(id)
  }
}
