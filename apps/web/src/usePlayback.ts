import type { DayPhase, ElminaScene, FlightPoint, FlightState, PassState, SceneMarkers } from '@safe-edge/scene'
import {
  createScenarioPlayer,
  elminaScenarios,
  elminaSeed,
  rainAt,
  type Played,
  type Scenario,
  type ScenarioPlayer
} from '@safe-edge/sdk'
import { useEffect, useRef, useState } from 'react'
import { loadPlanner } from './planner.ts'
import { recordingShot, steadyFrames } from './recording.ts'

/** The story (S1 to S3 as one run, held on each caption) or one scenario, as the details menu plays it. */
export type PlaybackMode = { kind: 'story' } | { kind: 'scenario'; id: Scenario['id'] }

/** Fence panel 4 by the playground path, where the story happens. */
export const STORY_SEGMENT = elminaSeed.story.s1.segmentId
/** How long each caption stays before the story goes on, counting only time the tab is visible. */
export const CAPTION_HOLD_MS = 3_000
/** Close enough to see the gap in the fence. */
const STORY_DISTANCE_M = 170
/** The simulated aircraft every scenario flies (`hostDroneSim` names them `sim-1`, …). */
const DRONE = 'sim-1'

export interface Playback {
  player: ScenarioPlayer | Error | null
  flight: FlightState | null
  day: DayPhase | null
  /** The caption on screen: the latest story event played, or null outside the story. */
  current: Played | null
  /** The story segment's pass now. */
  storyPass: { state: PassState; validTo: string | null } | null
  /** Whether playback is going, or held on a caption, as the user asked. */
  playing: boolean
  play(): void
  pause(): void
  reset(): Promise<void>
  seek(iso: string): Promise<void>
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

/** The last story event played so far, if any. */
function latestCaption(played: readonly Played[]): Played | null {
  for (let i = played.length - 1; i >= 0; i--) if (played[i]!.event.story) return played[i]!
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

const markerIds = (markers: SceneMarkers) =>
  new Set([...markers.pins, ...markers.dropped, ...markers.unknowns].map((m) => m.id))

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

/** A caption's hold: what is left of it, and its timer while the tab is visible. */
interface Hold {
  at: string
  remainingMs: number
  startedAt: number
  timer: ReturnType<typeof setTimeout> | null
}

/**
 * Plays the story or a scenario into the scene through the scenario player: the demo's own core on the SDK's memory
 * transport, on a fixed-step clock. The scene draws the planned patrol and the drone where drone-sim has it, the
 * markers, the weather and the light, and recolours segments as their passes change. In the story, each caption holds
 * for `CAPTION_HOLD_MS` before play goes on, and the camera follows what the caption is about.
 */
export function usePlayback(
  scene: ElminaScene | null,
  mode: PlaybackMode,
  {
    recording,
    onPasses
  }: {
    recording: boolean
    /** The demo's passes after every change, for the screens beside the scene. */
    onPasses: (passes: Array<{ segmentId: string; state: PassState; validTo: string | null }>) => void
  }
): Playback {
  const [player, setPlayer] = useState<ScenarioPlayer | Error | null>(null)
  const [, setVersion] = useState(0)
  const [flight, setFlight] = useState<FlightState | null>(null)
  const [day, setDay] = useState<DayPhase | null>(null)
  const [current, setCurrent] = useState<Played | null>(null)
  const [storyPass, setStoryPass] = useState<Playback['storyPass']>(null)
  // The controls act on the player the effect made; they are set with it.
  const controls = useRef<Pick<Playback, 'play' | 'pause' | 'reset' | 'seek'>>({
    play: () => {},
    pause: () => {},
    reset: async () => {},
    seek: async () => {}
  })
  const wanted = useRef(false)
  const story = mode.kind === 'story'
  const key = story ? 'story' : mode.id

  useEffect(() => {
    if (!scene) return
    let cancelled = false
    let unsubscribe = () => {}
    let made: ScenarioPlayer | null = null
    let hold: Hold | null = null
    // What the scene shows now: markers as JSON, so an unchanged set is not rebuilt; how many steps had played when
    // the lists were last read; the caption and the chapter on screen, and the markers there were before it.
    const shown = {
      planId: null as string | null,
      now: '',
      flying: false,
      markers: '',
      played: -1,
      ids: new Set<string>(),
      caption: '',
      chapter: '',
      before: new Set<string>()
    }
    wanted.current = false
    setPlayer(null)
    setFlight(null)
    setCurrent(null)
    scene.showFlight(null)
    if (story && !recording) scene.focus(STORY_SEGMENT, { distanceM: STORY_DISTANCE_M })

    loadPlanner()
      .then((planner) =>
        createScenarioPlayer({
          scenarios: elminaScenarios,
          ...(story ? { id: 's3', from: 's1', holdOnStory: true } : { id: mode.id }),
          planner,
          speed: 8,
          ...(recording && { frames: steadyFrames() })
        })
      )
      .then((created) => {
        if (cancelled) return
        made = created

        const clearHold = () => {
          if (hold?.timer) clearTimeout(hold.timer)
          hold = null
        }
        const runHold = () => {
          if (!hold || hold.timer || document.hidden) return
          const held = hold
          held.startedAt = performance.now()
          held.timer = setTimeout(() => {
            hold = null
            if (wanted.current) created.play()
          }, held.remainingMs)
        }
        const stopHold = () => {
          if (!hold?.timer) return
          clearTimeout(hold.timer)
          hold.timer = null
          hold.remainingMs -= performance.now() - hold.startedAt
        }
        const onVisibility = () => (document.hidden ? stopHold() : runHold())
        document.addEventListener('visibilitychange', onVisibility)

        // Each update reads the demo after the seek that caused it; a newer update supersedes an older one.
        let latest = 0
        const sync = async () => {
          const mine = ++latest
          const plan = latestPlan(created.played)
          const rewound = created.now < shown.now
          if (rewound) shown.chapter = ''
          if (plan && (plan.id !== shown.planId || rewound)) scene.showFlight(flightView(plan))
          if (!plan && shown.planId !== null) scene.showFlight(null)
          shown.planId = plan?.id ?? null
          shown.now = created.now
          setDay(
            scene.setConditions({ at: created.now, rainMmH: rainAt(elminaScenarios, created.scenario.id, created.now) })
          )

          // A caption marks the markers that came with it; the ones from before wear compact chips.
          const caption = story ? latestCaption(created.played) : null
          const captionKey = caption ? `${caption.event.at} ${caption.event.operationId}` : ''
          const newCaption = captionKey !== shown.caption
          if (newCaption) {
            shown.caption = captionKey
            shown.before = rewound ? new Set() : shown.ids
            setCurrent(caption)
          }

          // In flight only the drone moves between steps, so the lists are read again only when a step played
          // something, the clock went back, or the drone took off or landed.
          const played = created.played.length
          const stale = rewound || played !== shown.played || !(created.airborne && shown.flying)
          const [status, lists] = await Promise.all([
            plan ? created.client.droneStatus(DRONE) : null,
            stale ? Promise.all([created.client.listPasses({}), markersOf(created.client)]) : null
          ])
          if (mine !== latest) return
          if (lists) {
            const [passes, markers] = lists
            shown.ids = markerIds(markers)
            const fresh = story ? new Set([...shown.ids].filter((id) => !shown.before.has(id))) : undefined
            const markersJson = JSON.stringify([markers, fresh && [...fresh]])
            if (markersJson !== shown.markers) {
              scene.setMarkers(markers, fresh ? { current: fresh } : {})
              shown.markers = markersJson
            }
            scene.setPassStates(
              Object.fromEntries(passes.map((p) => [p.segmentId, p.state as PassState])) as Record<string, PassState>
            )
            onPasses(passes.map((p) => ({ segmentId: p.segmentId, state: p.state as PassState, validTo: p.validTo })))
            const pass = passes.find((p) => p.segmentId === STORY_SEGMENT)
            setStoryPass(pass ? { state: pass.state as PassState, validTo: pass.validTo } : null)
            shown.played = played
          }
          const placed = status ? scene.placeDrone(status) : null
          const flying = status?.state === 'in_flight'
          const chapter = caption?.event.story?.chapter ?? ''
          if (recording) scene.setCameraShot(recordingShot(created, created.now, created.airborne))
          else if (story && chapter !== shown.chapter && chapter !== 'spot' && chapter !== '')
            // After the patrol, each chapter is about the fence again.
            scene.focus(STORY_SEGMENT, { distanceM: STORY_DISTANCE_M })
          else if (flying && !shown.flying && created.playing) scene.followDrone(true)
          shown.chapter = chapter
          shown.flying = flying
          setFlight(placed)

          // Held on a caption the user did not pause on: it stays for its time, then the story goes on.
          if (created.now >= created.end) wanted.current = false
          if (story && wanted.current && !created.playing && hold?.at !== created.now) {
            clearHold()
            hold = { at: created.now, remainingMs: CAPTION_HOLD_MS, startedAt: 0, timer: null }
            runHold()
          }
          setVersion((v) => v + 1)
        }

        controls.current = {
          play() {
            wanted.current = true
            clearHold()
            if (created.airborne && !recording) scene.followDrone(true)
            created.play()
          },
          pause() {
            wanted.current = false
            clearHold()
            created.pause()
          },
          async reset() {
            wanted.current = false
            clearHold()
            await created.reset()
            if (story && !recording) scene.focus(STORY_SEGMENT, { distanceM: STORY_DISTANCE_M })
          },
          async seek(iso) {
            wanted.current = false
            clearHold()
            created.pause()
            await created.seek(iso)
          }
        }
        unsubscribe = () => {
          clearHold()
          document.removeEventListener('visibilitychange', onVisibility)
          offPlayer()
        }
        const offPlayer = created.subscribe(() => void sync())
        setPlayer(created)
        void sync()
      })
      .catch((error: Error) => !cancelled && setPlayer(error))
    return () => {
      cancelled = true
      unsubscribe()
      made?.pause()
      if (recording) scene.setCameraShot(null)
    }
    // `mode` is read through `key`, so a new mode object for the same scenario keeps the player.
  }, [key, scene, onPasses, recording])

  return {
    player,
    flight,
    day,
    current,
    storyPass,
    playing: wanted.current,
    play: () => controls.current.play(),
    pause: () => controls.current.pause(),
    reset: () => controls.current.reset(),
    seek: (iso) => controls.current.seek(iso)
  }
}
