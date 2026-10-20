import {
  createElminaScene,
  type ControlMode,
  type ElminaLayers,
  type EdgeAssetView,
  type ElminaScene as Scene,
  type SegmentView
} from '@safe-edge/scene'
import { useCallback, useEffect, useRef, useState } from 'react'
import buildingsUrl from '../../../data/elmina/osm/buildings.geojson?url'
import parksUrl from '../../../data/elmina/osm/parks.geojson?url'
import pathsUrl from '../../../data/elmina/osm/paths.geojson?url'
import waterUrl from '../../../data/elmina/osm/water.geojson?url'
import seedUrl from '../../../data/elmina/fixtures/seed.json?url'
import { Legend } from './Legend.tsx'
import { ScenarioPanel } from './ScenarioPanel.tsx'
import { SegmentCard } from './SegmentCard.tsx'

const layerUrls = { water: waterUrl, parks: parksUrl, paths: pathsUrl, buildings: buildingsUrl }
/** `?record` opens recording mode: the camera follows a fixed path and the user's camera controls are off. */
const recording = new URLSearchParams(location.search).has('record')

async function loadLayers(): Promise<ElminaLayers> {
  const entries = await Promise.all(
    Object.entries(layerUrls).map(async ([name, url]) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${name} layer answered ${response.status}`)
      return [name, await response.json()] as const
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

async function loadSegments(): Promise<{ segments: SegmentView[]; assets: EdgeAssetView[] }> {
  const response = await fetch(seedUrl)
  if (!response.ok) throw new Error(`seed answered ${response.status}`)
  const seed = (await response.json()) as SeedSlice
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

/** The Elmina base scene from the OSM extract, with a switch between orbit and map controls. */
export function ElminaScene() {
  const container = useRef<HTMLDivElement>(null)
  const scene = useRef<Scene>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | Error>('loading')
  const [mode, setMode] = useState<ControlMode>('orbit')
  const [segments, setSegments] = useState<SegmentView[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [ready, setReady] = useState<Scene | null>(null)

  useEffect(() => {
    let disposed = false
    Promise.all([loadLayers(), loadSegments()])
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
        const query = new URLSearchParams(location.search)
        const linked = query.get('segment')
        if (linked) {
          const distance = query.get('distance')
          scene.current.select(linked, { focus: true, ...(distance ? { distanceM: Number(distance) } : {}) })
          setSelected(linked)
        }
        setStatus('ready')
      })
      .catch((error: Error) => setStatus(error))
    return () => {
      disposed = true
      scene.current?.dispose()
      scene.current = null
    }
  }, [])

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

  const toggle = () => {
    const next = mode === 'orbit' ? 'map' : 'orbit'
    scene.current?.setControlMode(next)
    setMode(next)
  }

  return (
    <div ref={container} style={{ position: 'relative', width: '100%', height: '100dvh' }} data-testid="elmina-scene">
      {status === 'loading' && <p>Loading the Elmina map…</p>}
      {status instanceof Error && <p role="alert">The Elmina map did not load: {status.message}</p>}
      {status === 'ready' && !recording && (
        <button type="button" onClick={toggle} style={{ position: 'absolute', top: 8, left: 8 }}>
          {mode === 'orbit' ? 'Orbit controls' : 'Map controls'}: switch to {mode === 'orbit' ? 'map' : 'orbit'}
        </button>
      )}
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
          Simulation · every flight, photo, flag and repair here
        </p>
      )}
      {status === 'ready' && <Legend />}
      {status === 'ready' && ready && <ScenarioPanel scene={ready} onPasses={onPasses} recording={recording} />}
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
