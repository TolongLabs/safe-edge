import {
  createElminaScene,
  type ElminaLayers,
  type EdgeAssetView,
  type ElminaScene as Scene,
  type SegmentView
} from '@safe-edge/scene'
import { elminaScenarios, type Scenario } from '@safe-edge/sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import buildingsUrl from '../../../data/elmina/osm/buildings.geojson?url'
import parksUrl from '../../../data/elmina/osm/parks.geojson?url'
import pathsUrl from '../../../data/elmina/osm/paths.geojson?url'
import waterUrl from '../../../data/elmina/osm/water.geojson?url'
import seedUrl from '../../../data/elmina/fixtures/seed.json?url'
import { ControlsHint } from './ControlsHint.tsx'
import { DetailsMenu } from './DetailsMenu.tsx'
import { LoadingCard, type LoadState } from './LoadingCard.tsx'
import { SegmentCard } from './SegmentCard.tsx'
import { StoryCard } from './StoryCard.tsx'
import { usePlayback, type PlaybackMode } from './usePlayback.ts'

const layerUrls = { water: waterUrl, parks: parksUrl, paths: pathsUrl, buildings: buildingsUrl }
/** What inline styles cannot say: a shorter badge on narrow screens, and tap-sized controls on touch screens. */
const sceneCss = `
.sim-short { display: none }
@media (max-width: 640px) { .sim-long { display: none } .sim-short { display: inline } }
[data-testid="elmina-scene"] { --tap: 32px }
@media (pointer: coarse) { [data-testid="elmina-scene"] { --tap: 44px } }
`

const query = new URLSearchParams(location.search)
/** `?record` opens recording mode: the camera follows a fixed path and the user's camera controls are off. */
const recording = query.has('record')
/** `?scenario=<id>` plays one scenario from the details menu; otherwise the scene tells the story. */
const linkedScenario = elminaScenarios.find((s) => s.id === query.get('scenario'))?.id as Scenario['id'] | undefined

/** The four OSM layers and the seed: what the loading card counts. */
const LOAD_TOTAL = Object.keys(layerUrls).length + 1

async function loadLayers(onLoaded: () => void): Promise<ElminaLayers> {
  const entries = await Promise.all(
    Object.entries(layerUrls).map(async ([name, url]) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${name} layer answered ${response.status}`)
      const layer = await response.json()
      onLoaded()
      return [name, layer] as const
    })
  )
  return Object.fromEntries(entries) as unknown as ElminaLayers
}

// The parts of data/elmina/fixtures/seed.json the scene reads; the full schema is Seed in @safe-edge/core.
interface SeedSlice {
  users: Array<{ id: string; name: string }>
  assets: Array<{ id: string; custodianUserId: string }>
  segments: Array<
    Omit<SegmentView, 'state' | 'owner' | 'validTo'> & {
      assetId: string
      passId: string | null
      side: EdgeAssetView['side']
      expectedInventory: EdgeAssetView['items']
    }
  >
  passes: Array<{ id: string; state: SegmentView['state']; validTo: string | null }>
}

async function loadSegments(onLoaded: () => void): Promise<{ segments: SegmentView[]; assets: EdgeAssetView[] }> {
  const response = await fetch(seedUrl)
  if (!response.ok) throw new Error(`seed answered ${response.status}`)
  const seed = (await response.json()) as SeedSlice
  onLoaded()
  const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]))
  const users = byId(seed.users)
  const assets = byId(seed.assets)
  const passes = byId(seed.passes)
  const segments = seed.segments.map((s) => {
    const asset = assets.get(s.assetId)
    if (!asset) throw new Error(`${s.id} names unknown asset ${s.assetId}`)
    const owner = users.get(asset.custodianUserId)
    if (!owner) throw new Error(`${asset.id} names unknown custodian ${asset.custodianUserId}`)
    const pass = s.passId === null ? null : passes.get(s.passId)
    if (pass === undefined) throw new Error(`${s.id} names unknown pass ${s.passId}`)
    return {
      id: s.id,
      name: s.name,
      geometry: s.geometry,
      state: pass?.state ?? 'none',
      owner: owner.name,
      lastPatrolledAt: s.lastPatrolledAt,
      validTo: pass?.validTo ?? null
    }
  })
  // Segments with an expected inventory get their fences, covers, gates, buoys and signs modelled.
  const modelled = seed.segments
    .filter((s) => s.expectedInventory.length > 0)
    .map((s) => ({ segmentId: s.id, geometry: s.geometry, side: s.side, items: s.expectedInventory }))
  return { segments, assets: modelled }
}

/** The Elmina base scene from the OSM extract, behind a loading card until its layers and seed arrive. */
export function ElminaScene() {
  const container = useRef<HTMLDivElement>(null)
  const scene = useRef<Scene>(null)
  const [status, setStatus] = useState<{ loaded: number } | 'ready' | Error>({ loaded: 0 })
  // Retry bumps the attempt, which runs the load again.
  const [attempt, setAttempt] = useState(0)
  const [segments, setSegments] = useState<SegmentView[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [ready, setReady] = useState<Scene | null>(null)
  const [mode, setMode] = useState<PlaybackMode>(() =>
    linkedScenario ? { kind: 'scenario', id: linkedScenario } : { kind: 'story' }
  )

  useEffect(() => {
    let disposed = false
    let failed = false
    let loaded = 0
    // A layer that arrives after another failed must not cover the error with progress.
    const onLoaded = () => !disposed && !failed && setStatus({ loaded: ++loaded })
    setStatus({ loaded: 0 })
    Promise.all([loadLayers(onLoaded), loadSegments(onLoaded)])
      .then(([layers, { segments: views, assets }]) => {
        if (disposed) return
        scene.current = createElminaScene(container.current!, layers, {
          segments: views,
          assets,
          onSelect: setSelected
        })
        setSegments(views)
        setReady(scene.current)
        // ?segment=<id>[&distance=<m>] opens the scene on one segment, for links from the Inbox and for recordings.
        const linked = query.get('segment')
        if (linked) {
          const distance = query.get('distance')
          scene.current.select(linked, { focus: true, ...(distance ? { distanceM: Number(distance) } : {}) })
          setSelected(linked)
        }
        setStatus('ready')
      })
      .catch((error: Error) => {
        failed = true
        if (!disposed) setStatus(error)
      })
    return () => {
      disposed = true
      scene.current?.dispose()
      scene.current = null
    }
  }, [attempt])

  const selectedSegment = segments.find((s) => s.id === selected)
  // The card shows the pass the scenario has reached, not the seed's.
  const onPasses = useCallback(
    (passes: Array<{ segmentId: string; state: SegmentView['state']; validTo: string | null }>) =>
      setSegments((views) =>
        views.map((v) => {
          const pass = passes.find((p) => p.segmentId === v.id)
          return pass ? { ...v, state: pass.state, validTo: pass.validTo } : v
        })
      ),
    []
  )
  const playback = usePlayback(ready, mode, { recording, onPasses, keepCamera: query.has('segment') })

  const load: LoadState | null =
    status === 'ready'
      ? null
      : status instanceof Error
        ? { kind: 'error', message: status.message, onRetry: () => setAttempt((a) => a + 1) }
        : { kind: 'loading', loaded: status.loaded, total: LOAD_TOTAL }

  return (
    <div
      ref={container}
      style={{
        position: 'relative',
        width: '100%',
        height: '100dvh',
        overflow: 'hidden',
        // Controls outside the cards inherit the design font from here.
        font: '14px/20px "Atkinson Hyperlegible Next", system-ui, sans-serif',
        color: '#1c2925'
      }}
      data-testid="elmina-scene"
    >
      <style>{sceneCss}</style>
      {load && <LoadingCard state={load} />}
      {status === 'ready' && <ControlsHint hidden={recording} />}
      {status === 'ready' && (
        <p
          role="note"
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            margin: 0,
            padding: '4px 10px',
            borderRadius: 4,
            border: '1.5px solid #1c2925',
            background: '#fbfcfb',
            color: '#1c2925',
            font: '700 12px/16px "Atkinson Hyperlegible Next", system-ui, sans-serif',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap'
          }}
        >
          <span className="sim-long">Simulation · every flight, photo, flag and repair here</span>
          <span className="sim-short">Simulation</span>
        </p>
      )}
      {status === 'ready' && ready && mode.kind === 'story' && <StoryCard playback={playback} recording={recording} />}
      {status === 'ready' && ready && !(recording && mode.kind === 'story') && (
        <DetailsMenu
          playback={playback}
          mode={mode}
          onMode={setMode}
          recording={recording}
          defaultOpen={mode.kind === 'scenario'}
        />
      )}
      {selectedSegment && (
        <SegmentCard
          segment={selectedSegment}
          onClose={() => {
            scene.current?.select(null)
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}
