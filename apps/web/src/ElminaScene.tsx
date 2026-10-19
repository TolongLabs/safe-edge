import {
  createElminaScene,
  type ControlMode,
  type ElminaLayers,
  type ElminaScene as Scene,
  type SegmentView
} from '@safe-edge/scene'
import { useEffect, useRef, useState } from 'react'
import buildingsUrl from '../../../data/elmina/osm/buildings.geojson?url'
import parksUrl from '../../../data/elmina/osm/parks.geojson?url'
import pathsUrl from '../../../data/elmina/osm/paths.geojson?url'
import waterUrl from '../../../data/elmina/osm/water.geojson?url'
import seedUrl from '../../../data/elmina/fixtures/seed.json?url'
import { SegmentCard } from './SegmentCard.tsx'

const layerUrls = { water: waterUrl, parks: parksUrl, paths: pathsUrl, buildings: buildingsUrl }

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
  segments: Array<Omit<SegmentView, 'state' | 'owner' | 'validTo'> & { assetId: string; passId: string | null }>
  passes: Array<{ id: string; state: SegmentView['state']; validTo: string | null }>
}

async function loadSegments(): Promise<SegmentView[]> {
  const response = await fetch(seedUrl)
  if (!response.ok) throw new Error(`seed answered ${response.status}`)
  const seed = (await response.json()) as SeedSlice
  const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]))
  const users = byId(seed.users)
  const assets = byId(seed.assets)
  const passes = byId(seed.passes)
  return seed.segments.map((s) => {
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
}

/** The Elmina base scene from the OSM extract, with a switch between orbit and map controls. */
export function ElminaScene() {
  const container = useRef<HTMLDivElement>(null)
  const scene = useRef<Scene>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | Error>('loading')
  const [mode, setMode] = useState<ControlMode>('orbit')
  const [segments, setSegments] = useState<SegmentView[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    Promise.all([loadLayers(), loadSegments()])
      .then(([layers, views]) => {
        if (disposed) return
        scene.current = createElminaScene(container.current!, layers, { segments: views, onSelect: setSelected })
        setSegments(views)
        // ?segment=<id> opens the scene on one segment, for links from the Inbox and for recordings.
        const linked = new URLSearchParams(location.search).get('segment')
        if (linked) {
          scene.current.select(linked, { focus: true })
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

  const toggle = () => {
    const next = mode === 'orbit' ? 'map' : 'orbit'
    scene.current?.setControlMode(next)
    setMode(next)
  }

  return (
    <div ref={container} style={{ position: 'relative', width: '100%', height: '100dvh' }} data-testid="elmina-scene">
      {status === 'loading' && <p>Loading the Elmina map…</p>}
      {status instanceof Error && <p role="alert">The Elmina map did not load: {status.message}</p>}
      {status === 'ready' && (
        <button type="button" onClick={toggle} style={{ position: 'absolute', top: 8, left: 8 }}>
          {mode === 'orbit' ? 'Orbit controls' : 'Map controls'}: switch to {mode === 'orbit' ? 'map' : 'orbit'}
        </button>
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
